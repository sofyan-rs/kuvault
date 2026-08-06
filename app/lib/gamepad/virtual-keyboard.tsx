import { useGamepadKeyboardState } from "./gamepad-navigation-provider"
import { KEYBOARD_ROWS } from "./keyboard-layout"
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

export function VirtualKeyboard() {
  const { visible, minimized, row, col, shift } = useGamepadKeyboardState()

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
        {KEYBOARD_ROWS.map((keys, r) => (
          <div key={r} className="flex justify-center gap-2.5">
            {keys.map((key, c) => {
              const isActive = r === row && c === col
              const isSpace = key === " "
              const label = isSpace ? "Space" : shift ? key.toUpperCase() : key
              return (
                <span
                  key={c}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-lg border text-lg font-medium transition-colors",
                    isSpace ? "w-72" : "w-12",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-foreground"
                  )}
                >
                  {label}
                </span>
              )
            })}
          </div>
        ))}
        <div className="mt-1.5 flex items-center justify-center gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ButtonGlyph>A</ButtonGlyph>
            Type
          </span>
          <span className="flex items-center gap-1.5">
            <ButtonGlyph>X</ButtonGlyph>
            Delete
          </span>
          <span className="flex items-center gap-1.5">
            <ButtonGlyph>Y</ButtonGlyph>
            Shift
          </span>
          <span className="flex items-center gap-1.5">
            <ButtonGlyph>B</ButtonGlyph>
            Done
          </span>
          <span className="flex items-center gap-1.5">
            <ButtonGlyph>LB</ButtonGlyph>
            Minimize
          </span>
        </div>
      </div>
    </div>
  )
}
