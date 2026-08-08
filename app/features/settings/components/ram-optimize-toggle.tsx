import { useState } from "react"

import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"
import { getRamOptimize, setRamOptimize } from "~/lib/settings/ram-optimize"

export function RamOptimizeToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => getRamOptimize())

  function handleChange(checked: boolean) {
    setEnabled(checked)
    setRamOptimize(checked)
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="ram-optimize"
        checked={enabled}
        onCheckedChange={(checked) => handleChange(checked === true)}
      />
      <Label htmlFor="ram-optimize">Free up RAM before launching a game</Label>
    </div>
  )
}
