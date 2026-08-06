export const KEYBOARD_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
  [" "],
]

export function clampCol(row: number, col: number): number {
  const len = KEYBOARD_ROWS[row].length
  return Math.min(Math.max(col, 0), len - 1)
}

// Matches the rendered layout in virtual-keyboard.tsx: each row is centered independently,
// keys are 48px wide (space bar 288px) with a 10px gap. Moving up/down should land on whichever
// key is horizontally nearest on screen, not the proportionally-scaled index.
const KEY_WIDTH_PX = 48
const SPACE_WIDTH_PX = 288
const GAP_PX = 10

function keyWidth(row: number): number {
  return KEYBOARD_ROWS[row].length === 1 ? SPACE_WIDTH_PX : KEY_WIDTH_PX
}

function keyCenterX(row: number, col: number): number {
  const width = keyWidth(row)
  const len = KEYBOARD_ROWS[row].length
  const rowWidth = len * width + (len - 1) * GAP_PX
  return -rowWidth / 2 + col * (width + GAP_PX) + width / 2
}

export function nearestCol(fromRow: number, fromCol: number, toRow: number): number {
  const x = keyCenterX(fromRow, fromCol)
  const toLen = KEYBOARD_ROWS[toRow].length

  let best = 0
  let bestDist = Infinity
  for (let j = 0; j < toLen; j++) {
    const dist = Math.abs(keyCenterX(toRow, j) - x)
    if (dist < bestDist) {
      bestDist = dist
      best = j
    }
  }
  return best
}
