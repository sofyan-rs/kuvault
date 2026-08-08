import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"

export function RunAsAdminToggle() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<boolean>("get_run_as_admin")
      .then(setEnabled)
      .finally(() => setLoading(false))
  }, [])

  async function handleChange(checked: boolean) {
    setEnabled(checked)
    try {
      await invoke("set_run_as_admin", { enabled: checked })
      toast.success(
        checked
          ? "KuVault will relaunch as administrator next time it starts"
          : "KuVault will run normally next time it starts",
      )
    } catch (error) {
      setEnabled(!checked)
      toast.error(`Failed to update admin setting: ${String(error)}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="run-as-admin"
        checked={enabled}
        disabled={loading}
        onCheckedChange={(checked) => handleChange(checked === true)}
      />
      <Label htmlFor="run-as-admin">Run KuVault as Administrator</Label>
    </div>
  )
}
