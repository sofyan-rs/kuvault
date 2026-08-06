import type { Direction } from "./types"

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])'

export function getFocusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true",
  )
}

/** Finds the nearest focusable element from `current` in `direction`, using 2D geometry. */
export function findNearestInDirection(
  current: HTMLElement,
  candidates: HTMLElement[],
  direction: Direction,
): HTMLElement | null {
  const from = current.getBoundingClientRect()
  const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 }

  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const candidate of candidates) {
    if (candidate === current) continue
    const rect = candidate.getBoundingClientRect()
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    const dx = center.x - fromCenter.x
    const dy = center.y - fromCenter.y

    const isCorrectAxis =
      (direction === "left" && dx < -1) ||
      (direction === "right" && dx > 1) ||
      (direction === "up" && dy < -1) ||
      (direction === "down" && dy > 1)
    if (!isCorrectAxis) continue

    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy)
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx)
    const score = primary + secondary * 2

    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

/** Simple linear next/previous-focusable traversal, used inside dialogs. */
export function findNextFocusable(
  current: HTMLElement,
  candidates: HTMLElement[],
  direction: Direction,
): HTMLElement | null {
  const index = candidates.indexOf(current)
  if (index === -1) return candidates[0] ?? null

  if (direction === "down" || direction === "right") {
    return candidates[index + 1] ?? candidates[candidates.length - 1] ?? null
  }
  if (direction === "up" || direction === "left") {
    return candidates[index - 1] ?? candidates[0] ?? null
  }
  return null
}
