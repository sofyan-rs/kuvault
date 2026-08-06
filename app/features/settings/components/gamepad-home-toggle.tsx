import { useState } from "react"

import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"
import { getHomeButtonReturnsFocus, setHomeButtonReturnsFocus } from "~/lib/settings/gamepad-home"

export function GamepadHomeToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => getHomeButtonReturnsFocus())

  function handleChange(checked: boolean) {
    setEnabled(checked)
    setHomeButtonReturnsFocus(checked)
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="gamepad-home-focus"
        checked={enabled}
        onCheckedChange={(checked) => handleChange(checked === true)}
      />
      <Label htmlFor="gamepad-home-focus">
        Gamepad Home button returns to KuVault while a game is running
      </Label>
    </div>
  )
}
