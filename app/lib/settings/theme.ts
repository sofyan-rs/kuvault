export type Theme = "dark" | "light" | "system"

const STORAGE_KEY = "kuvault-theme"

export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark"
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "light" || stored === "system" ? stored : "dark"
}

export function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme

  document.documentElement.classList.toggle("dark", resolved === "dark")
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

// Inline script string injected into <head> so the correct theme applies
// before first paint (avoids a light-mode flash on a dark-default app).
export const themeInitScript = `
(function () {
  var stored = localStorage.getItem("${STORAGE_KEY}") || "dark";
  var resolved = stored === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : stored;
  if (resolved === "dark") document.documentElement.classList.add("dark");
})();
`
