import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Update } from "@tauri-apps/plugin-updater"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { invoke } from "@tauri-apps/api/core"
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  isPortableInstall,
} from "~/lib/tauri/updater"

/** Silent startup check: prompts before installing, skips portable/elevated runs entirely. */
export function UpdateChecker() {
  const [pending, setPending] = useState<Update | null>(null)
  const [installing, setInstalling] = useState(false)
  const checkedOnce = useRef(false)

  useEffect(() => {
    if (checkedOnce.current) return
    checkedOnce.current = true

    const timer = setTimeout(async () => {
      const [portable, elevated] = await Promise.all([
        isPortableInstall(),
        invoke<boolean>("is_running_elevated").catch(() => false),
      ])
      if (portable || elevated) return

      const update = await checkForUpdate()
      if (update) setPending(update)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!pending) return
    setInstalling(true)
    try {
      await downloadAndInstallUpdate(pending)
    } catch (error) {
      setInstalling(false)
      toast.error(`Update failed: ${String(error)}`)
    }
  }, [pending])

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update available: v{pending?.version}</AlertDialogTitle>
          <AlertDialogDescription>
            KuVault will close and restart to install this update.
            {pending?.body ? <div className="mt-2 whitespace-pre-wrap">{pending.body}</div> : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={installing}>Later</AlertDialogCancel>
          <AlertDialogAction disabled={installing} onClick={handleInstall}>
            {installing && <Loader2 className="size-3.5 animate-spin" />}
            {installing ? "Installing..." : "Restart & Install"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
