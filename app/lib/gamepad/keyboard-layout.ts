export type KeyboardMode = "letters" | "symbols"

// "#+=" / "ABC" toggle key sits at the start of the bottom letter row, matching the
// Switch/Xbox/PS5 on-screen keyboard convention shown in the reference screenshots.
export const SYMBOLS_KEY = "#+="
export const LETTERS_KEY = "ABC"

export const LETTER_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  [SYMBOLS_KEY, "z", "x", "c", "v", "b", "n", "m"],
  [" "],
]

export const SYMBOL_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "_", "=", "+", "[", "]", "{", "}", "\\"],
  [LETTERS_KEY, ";", ":", "'", "\"", ",", ".", "/", "?"],
  [" "],
]

export function rowsForMode(mode: KeyboardMode): string[][] {
  return mode === "symbols" ? SYMBOL_ROWS : LETTER_ROWS
}

export function clampCol(rows: string[][], row: number, col: number): number {
  const len = rows[row].length
  return Math.min(Math.max(col, 0), len - 1)
}

// Matches the rendered layout in virtual-keyboard.tsx: each row is centered independently,
// keys are 48px wide (space bar 288px) with a 10px gap. Moving up/down should land on whichever
// key is horizontally nearest on screen, not the proportionally-scaled index.
const KEY_WIDTH_PX = 48
const SPACE_WIDTH_PX = 288
const GAP_PX = 10

function keyWidth(rows: string[][], row: number): number {
  return rows[row].length === 1 ? SPACE_WIDTH_PX : KEY_WIDTH_PX
}

function keyCenterX(rows: string[][], row: number, col: number): number {
  const width = keyWidth(rows, row)
  const len = rows[row].length
  const rowWidth = len * width + (len - 1) * GAP_PX
  return -rowWidth / 2 + col * (width + GAP_PX) + width / 2
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
