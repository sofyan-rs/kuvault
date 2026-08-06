import { useState } from "react"

import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { getStoredTheme, setTheme, type Theme } from "~/lib/settings/theme"

const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "Follow system",
}

export function ThemeSelect() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  function handleChange(value: Theme) {
    setThemeState(value)
    setTheme(value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="theme">Theme</Label>
      <Select value={theme} onValueChange={(v) => handleChange(v as Theme)}>
        <SelectTrigger id="theme" className="w-48">
          <SelectValue>{(value: Theme) => THEME_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="system">Follow system</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
