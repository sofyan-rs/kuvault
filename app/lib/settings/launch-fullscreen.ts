const STORAGE_KEY = "kuvault-launch-fullscreen"

export function getLaunchFullscreen(): boolean {
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) === "true"
}

export function setLaunchFullscreen(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
}
