import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import {
  clampCol,
  LETTERS_KEY,
  nearestCol,
  rowsForMode,
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

interface KeyboardRenderState {
  visible: boolean
  minimized: boolean
  row: number
  col: number
  shift: boolean
  mode: KeyboardMode
}

const KEYBOARD_STATE_DEFAULT: KeyboardRenderState = {
  visible: false,
  minimized: false,
  row: 0,
  col: 0,
  shift: false,
  mode: "letters",
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
  const activeElementRef = useRef<HTMLElement | null>(null)
  const bumperHandlersRef = useRef<BumperHandlers | null>(null)
  const [bumpersActive, setBumpersActive] = useState(false)
  const [searchAvailable, setSearchAvailable] = useState(false)
  const isConnectedRef = useRef(false)
  const keyboardTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardMinimized, setKeyboardMinimized] = useState(false)
  const [keyboardRow, setKeyboardRow] = useState(1)
  const [keyboardCol, setKeyboardCol] = useState(0)
  const [keyboardShift, setKeyboardShift] = useState(false)
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>("letters")
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
  }, [])

  const exitSliderAdjust = useCallback(() => {
    sliderTargetRef.current?.removeAttribute("data-gamepad-adjusting")
    sliderTargetRef.current = null
    setSliderAdjustActive(false)
  }, [])

  const focusElement = useCallback((element: HTMLElement) => {
    activeElementRef.current?.removeAttribute("data-gamepad-active")
    document.body.setAttribute("data-gamepad-focus", "true")
    element.setAttribute("data-gamepad-active", "true")
    activeElementRef.current = element
    element.focus()
    element.scrollIntoView({ block: "nearest", behavior: "smooth" })
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
  }, [])

  const register = useCallback((id: ZoneId, element: HTMLElement) => {
    zonesRef.current.set(id, element)
  }, [])
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

  const handleButtonA = useCallback(() => {
    if (keyboardVisible && !keyboardMinimized) {
      const target = keyboardTargetRef.current
      if (!target) return
      const key = rowsForMode(keyboardMode)[keyboardRow][keyboardCol]
      if (key === SYMBOLS_KEY || key === LETTERS_KEY) {
        setKeyboardMode(key === SYMBOLS_KEY ? "symbols" : "letters")
        setKeyboardRow(1)
        setKeyboardCol(0)
        playConfirmSfx()
        return
      }
      insertAtCursor(target, key === " " ? " " : keyboardShift ? key.toUpperCase() : key)
      playConfirmSfx()
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
    keyboardShift,
    keyboardMode,
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

  const { isConnected } = useGamepadPoll({
    onDirection: handleDirection,
    onButtonA: handleButtonA,
    onButtonB: handleButtonB,
    onButtonX: handleButtonX,
    onButtonY: handleButtonY,
    onBumperLeft: handleBumperLeft,
    onBumperRight: handleBumperRight,
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
    }
    document.addEventListener("focusin", handleFocusIn)
    return () => document.removeEventListener("focusin", handleFocusIn)
  }, [closeKeyboard, exitSliderAdjust])

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

  const keyboardState = useMemo<KeyboardRenderState>(
    () => ({
      visible: keyboardVisible,
      minimized: keyboardMinimized,
      row: keyboardRow,
      col: keyboardCol,
      shift: keyboardShift,
      mode: keyboardMode,
    }),
    [keyboardVisible, keyboardMinimized, keyboardRow, keyboardCol, keyboardShift, keyboardMode],
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
