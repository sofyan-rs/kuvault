import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import { getHomeButtonReturnsFocus } from "~/lib/settings/gamepad-home"
import { trackedInvoke } from "~/lib/tauri/tauri"
import { useRunningGameIds } from "~/lib/tauri/running-games"

import {
  BACKSPACE_KEY,
  clampCol,
  DONE_KEY,
  LETTERS_KEY,
  nearestCol,
  rowsForMode,
  SHIFT_KEY,
  SYMBOLS_KEY,
  type KeyboardMode,
} from "./keyboard-layout"
import { deleteBeforeCursor, insertAtCursor, isTextField } from "./text-input"
import { useGamepadPoll } from "./use-gamepad-poll"
import { findNearestInDirection, findNextFocusable, getFocusableIn } from "./spatial-nav"
import { playBackSfx, playConfirmSfx, playErrorSfx, playMoveSfx } from "./sfx"
import { ZONE_ADJACENCY, type Direction, type ZoneId } from "./types"

interface ZoneRegistry {
  register: (id: ZoneId, element: HTMLElement) => void
  unregister: (id: ZoneId) => void
}

const ZoneRegistryContext = createContext<ZoneRegistry | null>(null)

export function useGamepadZoneRegistry(): ZoneRegistry {
  const registry = useContext(ZoneRegistryContext)
  if (!registry) throw new Error("useGamepadZoneRegistry must be used inside GamepadNavigationProvider")
  return registry
}

const GamepadConnectedContext = createContext(false)

export function useIsGamepadConnected(): boolean {
  return useContext(GamepadConnectedContext)
}

const BumpersActiveContext = createContext(false)

/** Whether some mounted component currently owns the LB/RB bumper handlers (e.g. sidebar section cycling). */
export function useAreGamepadBumpersActive(): boolean {
  return useContext(BumpersActiveContext)
}

interface BumperHandlers {
  onBumperLeft: () => void
  onBumperRight: () => void
}

const BumperRegistryContext = createContext<((handlers: BumperHandlers | null) => void) | null>(
  null,
)

/** Registers LB/RB handlers (e.g. cycling a sidebar filter) while the calling component is mounted. */
export function useGamepadBumpers(onBumperLeft: () => void, onBumperRight: () => void) {
  const setBumperHandlers = useContext(BumperRegistryContext)
  const handlersRef = useRef({ onBumperLeft, onBumperRight })
  handlersRef.current = { onBumperLeft, onBumperRight }

  useEffect(() => {
    if (!setBumperHandlers) return
    setBumperHandlers({
      onBumperLeft: () => handlersRef.current.onBumperLeft(),
      onBumperRight: () => handlersRef.current.onBumperRight(),
    })
    return () => setBumperHandlers(null)
  }, [setBumperHandlers])
}

const SearchRegistryContext = createContext<((available: boolean) => void) | null>(null)

const SearchAvailableContext = createContext(false)

/** Whether some mounted component currently exposes a `[data-gamepad-search]` input for the Y button to focus. */
export function useIsGamepadSearchAvailable(): boolean {
  return useContext(SearchAvailableContext)
}

/** Marks a `[data-gamepad-search]` input as reachable by the Y button while the calling component is mounted. */
export function useRegisterGamepadSearch() {
  const setAvailable = useContext(SearchRegistryContext)

  useEffect(() => {
    setAvailable?.(true)
    return () => setAvailable?.(false)
  }, [setAvailable])
}

interface KeyboardActions {
  pressKey: (key: string, row: number, col: number) => void
}

interface KeyboardRenderState {
  visible: boolean
  minimized: boolean
  row: number
  col: number
  shift: boolean
  mode: KeyboardMode
  previewValue: string
  actions: KeyboardActions
}

const KEYBOARD_ACTIONS_NOOP: KeyboardActions = {
  pressKey: () => {},
}

const KEYBOARD_STATE_DEFAULT: KeyboardRenderState = {
  visible: false,
  minimized: false,
  row: 0,
  col: 0,
  shift: false,
  mode: "letters",
  previewValue: "",
  actions: KEYBOARD_ACTIONS_NOOP,
}

const KeyboardStateContext = createContext<KeyboardRenderState>(KEYBOARD_STATE_DEFAULT)

/** Render-only snapshot of the virtual keyboard, for the overlay component to draw. */
export function useGamepadKeyboardState(): KeyboardRenderState {
  return useContext(KeyboardStateContext)
}


const SliderAdjustContext = createContext(false)

/** Whether a range slider is currently in gamepad "adjust" mode (entered via A, exited via B). */
export function useIsGamepadSliderAdjusting(): boolean {
  return useContext(SliderAdjustContext)
}

function getOpenDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[role="dialog"][data-open], [role="alertdialog"][data-open]',
  )
}

// Base UI menu/select popups (dropdown menu, sort select, platform select, etc.) manage their
// own roving-tabindex arrow-key navigation internally — we dispatch real key events into them
// instead of reimplementing traversal.
function getOpenPopup(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="dropdown-menu-content"][data-open], [data-slot="select-content"][data-open]',
  )
}

const DIRECTION_KEYS: Record<Direction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
}

function dispatchKey(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true }))
}

export function GamepadNavigationProvider({ children }: { children: React.ReactNode }) {
  const zonesRef = useRef(new Map<ZoneId, HTMLElement>())
  const lastFocusedRef = useRef(new Map<ZoneId, HTMLElement>())
  // Mirrors lastFocusedRef by a stable `href` key instead of the DOM element, since elements
  // (e.g. game cards) get destroyed and recreated when navigating away and back (route remount).
  const lastFocusedKeyRef = useRef(new Map<ZoneId, string>())
  const activeElementRef = useRef<HTMLElement | null>(null)
  const bumperHandlersRef = useRef<BumperHandlers | null>(null)
  const [bumpersActive, setBumpersActive] = useState(false)
  const [searchAvailable, setSearchAvailable] = useState(false)
  const isConnectedRef = useRef(false)
  const lastPointerTypeRef = useRef<string>("mouse")
  const keyboardTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardMinimized, setKeyboardMinimized] = useState(false)
  const [keyboardRow, setKeyboardRow] = useState(1)
  const [keyboardCol, setKeyboardCol] = useState(0)
  const [keyboardShift, setKeyboardShift] = useState(false)
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>("letters")
  const [keyboardPreview, setKeyboardPreview] = useState("")
  const sliderTargetRef = useRef<HTMLInputElement | null>(null)
  const [sliderAdjustActive, setSliderAdjustActive] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const setBumperHandlers = useCallback((handlers: BumperHandlers | null) => {
    bumperHandlersRef.current = handlers
    setBumpersActive(handlers !== null)
  }, [])

  const closeKeyboard = useCallback(() => {
    keyboardTargetRef.current = null
    setKeyboardVisible(false)
    setKeyboardMinimized(false)
    setKeyboardMode("letters")
    setKeyboardPreview("")
  }, [])

  const exitSliderAdjust = useCallback(() => {
    sliderTargetRef.current?.removeAttribute("data-gamepad-adjusting")
    sliderTargetRef.current = null
    setSliderAdjustActive(false)
  }, [])

  const focusElement = useCallback((element: HTMLElement, options?: { silent?: boolean }) => {
    activeElementRef.current?.removeAttribute("data-gamepad-active")
    if (!options?.silent) document.body.setAttribute("data-gamepad-focus", "true")
    element.setAttribute("data-gamepad-active", "true")
    activeElementRef.current = element
    element.focus({ preventScroll: options?.silent })
    element.scrollIntoView({ block: "nearest", behavior: options?.silent ? "instant" : "smooth" })
    if (options?.silent) return
    playMoveSfx()
  }, [])

  const openKeyboardFor = useCallback((element: HTMLInputElement | HTMLTextAreaElement) => {
    element.select()
    keyboardTargetRef.current = element
    setKeyboardVisible(true)
    setKeyboardMinimized(false)
    setKeyboardRow(1)
    setKeyboardCol(0)
    setKeyboardShift(false)
    setKeyboardMode("letters")
    setKeyboardPreview(element.value)
  }, [])

  const register = useCallback(
    (id: ZoneId, element: HTMLElement) => {
      zonesRef.current.set(id, element)

      // Zone just (re)mounted (e.g. navigated back from game detail to the library grid) —
      // restore the previously focused card by its remembered href key, since the actual DOM
      // element from before is gone.
      const key = lastFocusedKeyRef.current.get(id)
      if (key) {
        const restored = element.querySelector<HTMLElement>(
          `[href="${CSS.escape(key)}"]`,
        )
        if (restored) {
          lastFocusedRef.current.set(id, restored)
          // Silent (no sfx/scroll-jump/gamepad-focus-mode) unless we were already in gamepad
          // focus mode, e.g. mouse-clicked a card, went to detail, came back with mouse — just
          // reapply the visual highlight without hijacking focus/scroll for a mouse user.
          const wasGamepadFocus = document.body.getAttribute("data-gamepad-focus") === "true"
          focusElement(restored, { silent: !wasGamepadFocus })
        }
      }
    },
    [focusElement],
  )
  const unregister = useCallback((id: ZoneId) => {
    zonesRef.current.delete(id)
  }, [])
  const registry = useMemo(() => ({ register, unregister }), [register, unregister])

  const findCurrentZone = useCallback((activeElement: HTMLElement): ZoneId | null => {
    for (const [id, element] of zonesRef.current) {
      if (element.contains(activeElement)) return id
    }
    return null
  }, [])

  const handleDirection = useCallback(
    (direction: Direction) => {
      if (keyboardVisible && !keyboardMinimized) {
        const rows = rowsForMode(keyboardMode)
        if (direction === "up" || direction === "down") {
          setKeyboardRow((row) => {
            const nextRow =
              direction === "up" ? Math.max(row - 1, 0) : Math.min(row + 1, rows.length - 1)
            setKeyboardCol((col) => nearestCol(rows, row, col, nextRow))
            return nextRow
          })
        } else {
          const delta = direction === "left" ? -1 : 1
          setKeyboardCol((col) => clampCol(rows, keyboardRow, col + delta))
        }
        playMoveSfx()
        return
      }

      // While "adjusting" a range slider (entered via A, like typing mode for text fields),
      // dispatch arrow keys to it natively instead of moving focus off it.
      if (sliderAdjustActive) {
        const target = sliderTargetRef.current
        if (target) dispatchKey(target, DIRECTION_KEYS[direction])
        playMoveSfx()
        return
      }

      const popup = getOpenPopup()
      if (popup) {
        dispatchKey(document.activeElement ?? popup, DIRECTION_KEYS[direction])
        playMoveSfx()
        return
      }

      const dialog = getOpenDialog()
      const active = document.activeElement as HTMLElement | null

      if (dialog) {
        const candidates = getFocusableIn(dialog)
        if (candidates.length === 0) return
        const current = active && dialog.contains(active) ? active : candidates[0]
        const next = findNextFocusable(current, candidates, direction)
        if (next) focusElement(next)
        return
      }

      const zoneId = active ? findCurrentZone(active) : null

      if (zoneId && active) {
        const zoneElement = zonesRef.current.get(zoneId)
        if (zoneElement) {
          const candidates = getFocusableIn(zoneElement)
          const next = findNearestInDirection(active, candidates, direction)
          if (next) {
            lastFocusedRef.current.set(zoneId, next)
            const key = next.getAttribute("href")
            if (key) lastFocusedKeyRef.current.set(zoneId, key)
            focusElement(next)
            return
          }
        }

        const nextZoneId = ZONE_ADJACENCY[zoneId]?.[direction]
        if (nextZoneId) {
          const nextZoneElement = zonesRef.current.get(nextZoneId)
          if (nextZoneElement) {
            const remembered = lastFocusedRef.current.get(nextZoneId)
            const candidates = getFocusableIn(nextZoneElement)
            const target =
              remembered && candidates.includes(remembered) ? remembered : candidates[0]
            if (target) {
              lastFocusedRef.current.set(nextZoneId, target)
              const key = target.getAttribute("href")
              if (key) lastFocusedKeyRef.current.set(nextZoneId, key)
              focusElement(target)
            }
          }
        }
        return
      }

      // No registered zone contains the current focus (e.g. routes like the game detail/edit
      // pages that don't opt into zones) — fall back to page-wide spatial navigation.
      if (active) {
        const candidates = getFocusableIn(document.body)
        const next = findNearestInDirection(active, candidates, direction)
        if (next) {
          focusElement(next)
          return
        }
      }

      const gridElement = zonesRef.current.get("grid")
      const fallbackContainer = gridElement ?? document.body
      const candidates = getFocusableIn(fallbackContainer)
      if (candidates[0]) focusElement(candidates[0])
    },
    [
      keyboardVisible,
      keyboardMinimized,
      keyboardRow,
      keyboardMode,
      sliderAdjustActive,
      findCurrentZone,
      focusElement,
    ],
  )

  // What pressing a given on-screen key does — shared by the gamepad A button (using the
  // D-pad cursor position) and touch taps (which pass the tapped key directly).
  const activateKey = useCallback(
    (key: string) => {
      const target = keyboardTargetRef.current
      if (!target) return
      if (key === SYMBOLS_KEY || key === LETTERS_KEY) {
        setKeyboardMode(key === SYMBOLS_KEY ? "symbols" : "letters")
        setKeyboardCol(0)
        playConfirmSfx()
        return
      }
      if (key === BACKSPACE_KEY) {
        deleteBeforeCursor(target)
        playBackSfx()
        return
      }
      if (key === DONE_KEY) {
        closeKeyboard()
        return
      }
      if (key === SHIFT_KEY) {
        setKeyboardShift((s) => !s)
        playConfirmSfx()
        return
      }
      insertAtCursor(target, key === " " ? " " : keyboardShift ? key.toUpperCase() : key)
      playConfirmSfx()
    },
    [keyboardShift, closeKeyboard],
  )

  const handleButtonA = useCallback(() => {
    if (keyboardVisible && !keyboardMinimized) {
      const key = rowsForMode(keyboardMode)[keyboardRow][keyboardCol]
      activateKey(key)
      return
    }

    const active = document.activeElement as HTMLElement | null
    if (!active) {
      playErrorSfx()
      return
    }
    if (active instanceof HTMLInputElement && active.type === "range") {
      active.setAttribute("data-gamepad-adjusting", "true")
      sliderTargetRef.current = active
      setSliderAdjustActive(true)
      playConfirmSfx()
      return
    }
    if (getOpenPopup()) {
      dispatchKey(active, "Enter")
      playConfirmSfx()
      return
    }
    if (isConnectedRef.current && isTextField(active)) {
      openKeyboardFor(active)
      playConfirmSfx()
      return
    }
    active.click()
    playConfirmSfx()
  }, [
    keyboardVisible,
    keyboardMinimized,
    keyboardRow,
    keyboardCol,
    keyboardMode,
    activateKey,
    openKeyboardFor,
  ])

  const handleButtonX = useCallback(() => {
    if (!keyboardVisible || keyboardMinimized) return
    const target = keyboardTargetRef.current
    if (target) {
      deleteBeforeCursor(target)
      playBackSfx()
    }
  }, [keyboardVisible, keyboardMinimized])

  // Touch/mouse tap on an on-screen keyboard key — moves the gamepad row/col cursor to the
  // tapped key so the highlight follows the finger instead of staying wherever the D-pad last
  // left it, then runs the same activation logic as the A button.
  const pressKey = useCallback(
    (key: string, row: number, col: number) => {
      setKeyboardRow(row)
      setKeyboardCol(col)
      activateKey(key)
    },
    [activateKey],
  )

  const handleButtonB = useCallback(() => {
    playBackSfx()

    if (sliderAdjustActive) {
      exitSliderAdjust()
      return
    }

    if (keyboardVisible) {
      closeKeyboard()
      return
    }

    const overlay = getOpenDialog() ?? getOpenPopup()
    if (overlay) {
      dispatchKey(overlay, "Escape")
      return
    }
    navigate(-1)
  }, [sliderAdjustActive, exitSliderAdjust, keyboardVisible, closeKeyboard, navigate])

  const handleButtonY = useCallback(() => {
    if (keyboardVisible) {
      setKeyboardShift((s) => !s)
      playConfirmSfx()
      return
    }

    if (getOpenDialog() || getOpenPopup()) return
    const input = document.querySelector<HTMLInputElement>("[data-gamepad-search]")
    if (!input) return
    focusElement(input)
    openKeyboardFor(input)
    playConfirmSfx()
  }, [keyboardVisible, focusElement, openKeyboardFor])

  const handleBumperLeft = useCallback(() => {
    if (keyboardVisible) {
      setKeyboardMinimized((m) => !m)
      playConfirmSfx()
      return
    }
    if (getOpenDialog() || getOpenPopup()) return
    if (!bumperHandlersRef.current) return
    bumperHandlersRef.current.onBumperLeft()
    playMoveSfx()
  }, [keyboardVisible])

  const handleBumperRight = useCallback(() => {
    if (keyboardVisible) return
    if (getOpenDialog() || getOpenPopup()) return
    if (!bumperHandlersRef.current) return
    bumperHandlersRef.current.onBumperRight()
    playMoveSfx()
  }, [keyboardVisible])

  const runningGameIds = useRunningGameIds()
  const runningGameIdsRef = useRef(runningGameIds)
  runningGameIdsRef.current = runningGameIds

  const handleButtonHome = useCallback(() => {
    if (!getHomeButtonReturnsFocus()) return
    if (runningGameIdsRef.current.size === 0) return

    trackedInvoke("focus_main_window")
    playConfirmSfx()
  }, [])

  const { isConnected } = useGamepadPoll({
    onDirection: handleDirection,
    onButtonA: handleButtonA,
    onButtonB: handleButtonB,
    onButtonX: handleButtonX,
    onButtonY: handleButtonY,
    onBumperLeft: handleBumperLeft,
    onBumperRight: handleBumperRight,
    onButtonHome: handleButtonHome,
  })

  useEffect(() => {
    isConnectedRef.current = isConnected
    if (!isConnected) {
      closeKeyboard()
      exitSliderAdjust()
    }
  }, [isConnected, closeKeyboard, exitSliderAdjust])

  // Closes the keyboard/slider-adjust mode whenever focus leaves their target (mouse click
  // elsewhere, gamepad nav moving to a non-text element, dialog closing, etc.) — not just via B.
  useEffect(() => {
    function handleFocusIn(event: FocusEvent) {
      if (keyboardTargetRef.current && event.target !== keyboardTargetRef.current) closeKeyboard()
      if (sliderTargetRef.current && event.target !== sliderTargetRef.current) exitSliderAdjust()

      // Touch tap into a text field with no gamepad involved — open the on-screen keyboard,
      // independent of gamepad connection state.
      const target = event.target as HTMLElement | null
      if (
        lastPointerTypeRef.current === "touch" &&
        isTextField(target) &&
        keyboardTargetRef.current !== target
      ) {
        openKeyboardFor(target)
      }

      // Remember focus by a stable href key (not the DOM element, which gets destroyed and
      // recreated on route remount) so it can be restored e.g. after navigating to game detail
      // and back, however focus got there (gamepad move, mouse click, tab).
      if (target) {
        const zoneId = findCurrentZone(target)
        const key = target.getAttribute("href")
        if (zoneId && key) {
          lastFocusedRef.current.set(zoneId, target)
          lastFocusedKeyRef.current.set(zoneId, key)
        }
      }
    }
    document.addEventListener("focusin", handleFocusIn)
    return () => document.removeEventListener("focusin", handleFocusIn)
  }, [closeKeyboard, exitSliderAdjust, openKeyboardFor, findCurrentZone])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      lastPointerTypeRef.current = event.pointerType
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  // Mirrors the keyboard target's live value into keyboardPreview, so the overlay can show a
  // copy of the field even when it's covered by the keyboard panel itself.
  useEffect(() => {
    function handleInput(event: Event) {
      if (event.target !== keyboardTargetRef.current) return
      setKeyboardPreview((event.target as HTMLInputElement | HTMLTextAreaElement).value)
    }
    document.addEventListener("input", handleInput)
    return () => document.removeEventListener("input", handleInput)
  }, [])

  useEffect(() => {
    closeKeyboard()
    exitSliderAdjust()
  }, [location.pathname, closeKeyboard, exitSliderAdjust])

  useEffect(() => {
    function clearGamepadFocus() {
      document.body.removeAttribute("data-gamepad-focus")
      activeElementRef.current?.removeAttribute("data-gamepad-active")
      activeElementRef.current = null
    }
    window.addEventListener("mousemove", clearGamepadFocus)
    return () => window.removeEventListener("mousemove", clearGamepadFocus)
  }, [])

  const keyboardActions = useMemo<KeyboardActions>(() => ({ pressKey }), [pressKey])

  const keyboardState = useMemo<KeyboardRenderState>(
    () => ({
      visible: keyboardVisible,
      minimized: keyboardMinimized,
      row: keyboardRow,
      col: keyboardCol,
      shift: keyboardShift,
      mode: keyboardMode,
      previewValue: keyboardPreview,
      actions: keyboardActions,
    }),
    [
      keyboardVisible,
      keyboardMinimized,
      keyboardRow,
      keyboardCol,
      keyboardShift,
      keyboardMode,
      keyboardPreview,
      keyboardActions,
    ],
  )

  return (
    <ZoneRegistryContext.Provider value={registry}>
      <BumperRegistryContext.Provider value={setBumperHandlers}>
        <SearchRegistryContext.Provider value={setSearchAvailable}>
          <GamepadConnectedContext.Provider value={isConnected}>
            <BumpersActiveContext.Provider value={bumpersActive}>
              <SearchAvailableContext.Provider value={searchAvailable}>
                <KeyboardStateContext.Provider value={keyboardState}>
                  <SliderAdjustContext.Provider value={sliderAdjustActive}>
                    {children}
                  </SliderAdjustContext.Provider>
                </KeyboardStateContext.Provider>
              </SearchAvailableContext.Provider>
            </BumpersActiveContext.Provider>
          </GamepadConnectedContext.Provider>
        </SearchRegistryContext.Provider>
      </BumperRegistryContext.Provider>
    </ZoneRegistryContext.Provider>
  )
}
