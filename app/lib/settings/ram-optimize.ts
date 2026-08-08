const STORAGE_KEY = "kuvault-ram-optimize"

export function getRamOptimize(): boolean {
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) === "true"
}

export function setRamOptimize(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
}
