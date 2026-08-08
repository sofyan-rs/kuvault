import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "~/components/ui/button"
import { checkForUpdate, downloadAndInstallUpdate, isPortableInstall } from "~/lib/tauri/updater"

export function UpdateCheckButton() {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      if (await isPortableInstall()) {
        toast.info("Portable builds don't support auto-update. Download the latest release manually.")
        return
      }

      const update = await checkForUpdate()
      if (!update) {
        toast.success("You're on the latest version")
        return
      }

      toast.info(`Installing v${update.version}. KuVault will restart.`)
      await downloadAndInstallUpdate(update)
    } catch (error) {
      toast.error(`Update check failed: ${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy}>
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {busy ? "Checking..." : "Check for Update"}
    </Button>
  )
}
