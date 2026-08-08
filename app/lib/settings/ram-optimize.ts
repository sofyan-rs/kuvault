const STORAGE_KEY = "kuvault-ram-optimize"

export function getRamOptimize(): boolean {
  if (typeof localStorage === "undefined") return true
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === null ? true : stored === "true"
}

export function setRamOptimize(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
}
