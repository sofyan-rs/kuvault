const STORAGE_KEY = "kuvault-ui-scale"
const BASE_FONT_SIZE_PX = 17
const DEFAULT_SCALE = 100
export const MIN_SCALE = 70
export const MAX_SCALE = 150

export function getStoredUiScale(): number {
  if (typeof localStorage === "undefined") return DEFAULT_SCALE
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  if (!Number.isFinite(stored) || stored < MIN_SCALE || stored > MAX_SCALE) return DEFAULT_SCALE
  return stored
}

export function applyUiScale(scale: number) {
  document.documentElement.style.fontSize = `${(BASE_FONT_SIZE_PX * scale) / 100}px`
}

export function setUiScale(scale: number) {
  localStorage.setItem(STORAGE_KEY, String(scale))
  applyUiScale(scale)
}

// Inline script string injected into <head> so the correct scale applies before first paint.
export const uiScaleInitScript = `
(function () {
  var stored = Number(localStorage.getItem("${STORAGE_KEY}"));
  if (!isFinite(stored) || stored < ${MIN_SCALE} || stored > ${MAX_SCALE}) stored = ${DEFAULT_SCALE};
  document.documentElement.style.fontSize = (${BASE_FONT_SIZE_PX} * stored / 100) + "px";
})();
`
