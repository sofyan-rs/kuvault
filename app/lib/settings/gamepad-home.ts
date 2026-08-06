const STORAGE_KEY = "kuvault-gamepad-home-focus"

export function getHomeButtonReturnsFocus(): boolean {
  if (typeof localStorage === "undefined") return true
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === null ? true : stored === "true"
}

export function setHomeButtonReturnsFocus(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
}
