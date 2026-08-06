import {
  useAreGamepadBumpersActive,
  useGamepadKeyboardState,
  useIsGamepadConnected,
  useIsGamepadSearchAvailable,
} from "./gamepad-navigation-provider"

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
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted-foreground/10 text-sm font-semibold ${XBOX_BUTTON_COLORS[children] ?? "border-transparent text-foreground"}`}
    >
      {children}
    </span>
  )
}

function ButtonGlyphWide({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-6 min-w-8 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 px-2 text-sm font-semibold text-foreground">
      {children}
    </span>
  )
}

export function GamepadHintBar() {
  const isConnected = useIsGamepadConnected()
  const bumpersActive = useAreGamepadBumpersActive()
  const searchAvailable = useIsGamepadSearchAvailable()
  const keyboard = useGamepadKeyboardState()

  if (!isConnected || keyboard.visible) return null

  return (
    <div className="fixed right-3 bottom-3 z-40 flex items-center gap-4 rounded-lg border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur-xs">
      {bumpersActive ? (
        <span className="flex items-center gap-1.5">
          <ButtonGlyphWide>LB</ButtonGlyphWide>
          <ButtonGlyphWide>RB</ButtonGlyphWide>
          Section
        </span>
      ) : null}
      {searchAvailable ? (
        <span className="flex items-center gap-1.5">
          <ButtonGlyph>Y</ButtonGlyph>
          Search
        </span>
      ) : null}
      <span className="flex items-center gap-1.5">
        <ButtonGlyph>A</ButtonGlyph>
        OK
      </span>
      <span className="flex items-center gap-1.5">
        <ButtonGlyph>B</ButtonGlyph>
        Back
      </span>
    </div>
  )
}
