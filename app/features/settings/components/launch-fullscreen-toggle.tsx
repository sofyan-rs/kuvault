import { useState } from "react"

import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"
import { getLaunchFullscreen, setLaunchFullscreen } from "~/lib/settings/launch-fullscreen"

export function LaunchFullscreenToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => getLaunchFullscreen())

  function handleChange(checked: boolean) {
    setEnabled(checked)
    setLaunchFullscreen(checked)
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="launch-fullscreen"
        checked={enabled}
        onCheckedChange={(checked) => handleChange(checked === true)}
      />
      <Label htmlFor="launch-fullscreen">Open KuVault in fullscreen on launch</Label>
    </div>
  )
}
