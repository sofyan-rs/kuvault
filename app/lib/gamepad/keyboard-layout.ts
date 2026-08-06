export type KeyboardMode = "letters" | "symbols"

// "#+=" / "ABC" toggle key sits at the start of the bottom letter row, matching the
// Switch/Xbox/PS5 on-screen keyboard convention shown in the reference screenshots.
export const SYMBOLS_KEY = "#+="
export const LETTERS_KEY = "ABC"

// Control-key tokens folded into the grid so they're D-pad navigable (Switch-style), while
// Y/X/B still trigger them instantly as shortcuts from anywhere.
export const BACKSPACE_KEY = "⌫"
export const DONE_KEY = "OK"
export const SHIFT_KEY = "⇧"

export const LETTER_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", BACKSPACE_KEY],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  [SHIFT_KEY, SYMBOLS_KEY, "z", "x", "c", "v", "b", "n", "m"],
  [" ", DONE_KEY],
]

export const SYMBOL_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", BACKSPACE_KEY],
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "_", "=", "+", "[", "]", "{", "}", "\\"],
  [LETTERS_KEY, ";", ":", "'", "\"", ",", ".", "/", "?"],
  [" ", DONE_KEY],
]

export function rowsForMode(mode: KeyboardMode): string[][] {
  return mode === "symbols" ? SYMBOL_ROWS : LETTER_ROWS
}

export function clampCol(rows: string[][], row: number, col: number): number {
  const len = rows[row].length
  return Math.min(Math.max(col, 0), len - 1)
}

// Matches the rendered layout in virtual-keyboard.tsx: keys are 48px wide (space bar 288px)
// with a 10px gap, each row centered independently. Moving up/down should land on whichever
// key is horizontally nearest on screen, not the proportionally-scaled index. Rows can now mix
// a wide space key with standard-width neighbors (e.g. `[" ", DONE_KEY]`), so widths are
// computed per key rather than assumed uniform per row.
const KEY_WIDTH_PX = 48
const SPACE_WIDTH_PX = 288
const GAP_PX = 10

function keyWidth(key: string): number {
  return key === " " ? SPACE_WIDTH_PX : KEY_WIDTH_PX
}

function keyCenterX(rows: string[][], row: number, col: number): number {
  const keys = rows[row]
  const widths = keys.map(keyWidth)
  const rowWidth = widths.reduce((sum, w) => sum + w, 0) + (keys.length - 1) * GAP_PX
  let x = -rowWidth / 2
  for (let j = 0; j < col; j++) x += widths[j] + GAP_PX
  return x + widths[col] / 2
}

export function nearestCol(rows: string[][], fromRow: number, fromCol: number, toRow: number): number {
  const x = keyCenterX(rows, fromRow, fromCol)
  const toLen = rows[toRow].length

  let best = 0
  let bestDist = Infinity
  for (let j = 0; j < toLen; j++) {
    const dist = Math.abs(keyCenterX(rows, toRow, j) - x)
    if (dist < bestDist) {
      bestDist = dist
      best = j
    }
  }
  return best
}
