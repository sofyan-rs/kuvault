import { useEffect, useState } from "react"
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
import { toast } from "sonner"

import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"

export function AutostartToggle() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    isEnabled()
      .then(setEnabled)
      .finally(() => setLoading(false))
  }, [])

  async function handleChange(checked: boolean) {
    setEnabled(checked)
    try {
      await (checked ? enable() : disable())
    } catch (error) {
      setEnabled(!checked)
      toast.error(`Failed to update startup setting: ${String(error)}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="autostart"
        checked={enabled}
        disabled={loading}
        onCheckedChange={(checked) => handleChange(checked === true)}
      />
      <Label htmlFor="autostart">Run KuVault automatically at Windows startup</Label>
    </div>
  )
}
