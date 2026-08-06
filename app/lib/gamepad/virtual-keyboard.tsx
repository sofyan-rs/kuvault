import { useEffect, useRef } from "react"
import { useGamepadKeyboardState, useIsGamepadConnected } from "./gamepad-navigation-provider"
import { BACKSPACE_KEY, DONE_KEY, LETTERS_KEY, rowsForMode, SHIFT_KEY, SYMBOLS_KEY } from "./keyboard-layout"
import { cn } from "~/lib/utils"

// Xbox controller face-button colors: A green, B red, X blue, Y yellow.
const XBOX_BUTTON_COLORS: Record<string, string> = {
  A: "border-[#5fb547] text-[#5fb547]",
  B: "border-[#d6393a] text-[#d6393a]",
  X: "border-[#3a8ec4] text-[#3a8ec4]",
  Y: "border-[#e8b131] text-[#e8b131]",
}

function ButtonGlyph({ children }: { children: string }) {
  return (
    <span
      className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border bg-muted-foreground/10 px-1.5 text-sm font-semibold ${XBOX_BUTTON_COLORS[children] ?? "border-transparent text-foreground"}`}
    >
      {children}
    </span>
  )
}

// Small shortcut badge pinned to a key's corner (e.g. "B" on Delete/OK, "Y" on Shift) —
// mirrors the Switch on-screen keyboard's per-key shortcut hints.
function CornerBadge({ children }: { children: string }) {
  return (
    <span
      className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-background text-[10px] font-semibold ${XBOX_BUTTON_COLORS[children] ?? "border-transparent text-foreground"}`}
    >
      {children}
    </span>
  )
}

// Keeps focus on the text field being typed into instead of letting the tap steal it.
function preventFocusSteal(event: React.PointerEvent) {
  event.preventDefault()
}

const KEY_LABELS: Record<string, string> = {
  [BACKSPACE_KEY]: "⌫",
  [DONE_KEY]: "OK",
  [SHIFT_KEY]: "⇧",
}

// Shortcut badge shown on a key's corner when a gamepad is connected — these keys are also
// instantly triggerable from anywhere via the matching face button.
const KEY_SHORTCUT_BADGE: Record<string, string> = {
  [BACKSPACE_KEY]: "X",
  [DONE_KEY]: "B",
  [SHIFT_KEY]: "Y",
}

export function VirtualKeyboard() {
  const { visible, minimized, row, col, shift, mode, previewValue, actions } = useGamepadKeyboardState()
  const gamepadConnected = useIsGamepadConnected()
  const previewRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = previewRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [previewValue])

  if (!visible) return null

  if (minimized) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-60 flex justify-center pb-2">
        <div className="rounded-full border border-border bg-background/95 px-3 py-1 text-sm text-muted-foreground shadow-md backdrop-blur-xs">
          Keyboard minimized — LB to restore
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-60 flex justify-center pb-4">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-background/95 p-5 shadow-lg backdrop-blur-xs">
        <input
          ref={previewRef}
          type="text"
          readOnly
          tabIndex={-1}
          value={previewValue}
          placeholder="Typing…"
          className="mb-1 rounded-lg border border-border bg-muted px-3 py-1.5 text-lg text-foreground outline-none placeholder:text-muted-foreground"
        />
        {rowsForMode(mode).map((keys, r) => (
          <div key={r} className="flex justify-center gap-2.5">
            {keys.map((key, c) => {
              const isActive = r === row && c === col
              const isSpace = key === " "
              const isModeToggle = key === SYMBOLS_KEY || key === LETTERS_KEY
              const isControl = key in KEY_LABELS
              const isShiftOn = key === SHIFT_KEY && shift
              const isDone = key === DONE_KEY
              const label = isSpace
                ? "Space"
                : isControl
                  ? KEY_LABELS[key]
                  : isModeToggle
                    ? key
                    : shift
                      ? key.toUpperCase()
                      : key
              const badge = gamepadConnected ? KEY_SHORTCUT_BADGE[key] : undefined
              return (
                <button
                  key={c}
                  type="button"
                  onPointerDown={preventFocusSteal}
                  onClick={() => actions.pressKey(key, r, c)}
                  className={cn(
                    "relative flex h-12 items-center justify-center rounded-lg border font-medium transition-colors",
                    isSpace ? "w-72 text-lg" : "w-12",
                    isModeToggle || isControl ? "text-sm" : "text-lg",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isShiftOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-foreground",
                    isActive && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  )}
                >
                  {label}
                  {badge && <CornerBadge>{badge}</CornerBadge>}
                </button>
              )
            })}
          </div>
        ))}
        {gamepadConnected && (
          <div className="mt-1.5 flex items-center justify-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ButtonGlyph>LB</ButtonGlyph>
              Minimize
            </span>
            <span className="flex items-center gap-1.5">
              <ButtonGlyph>A</ButtonGlyph>
              Select
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
