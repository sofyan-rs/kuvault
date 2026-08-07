import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { cn } from "~/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function PowerMenuItem({
  label,
  onClick,
  destructive,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted",
        destructive && "text-destructive"
      )}
    >
      {label}
    </button>
  )
}

export function PowerDialog({ open, onOpenChange }: Props) {
  async function run(command: string, label: string) {
    try {
      await invoke(command)
    } catch (error) {
      toast.error(`Failed to ${label}: ${String(error)}`)
      return
    }
    onOpenChange(false)
  }

  async function handleExit() {
    onOpenChange(false)
    await invoke("exit_app")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs p-2">
        <DialogHeader className="px-2 pt-1">
          <DialogTitle>Power</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <PowerMenuItem label="Sleep" onClick={() => run("system_sleep", "sleep")} />
          <PowerMenuItem
            label="Turn Off"
            destructive
            onClick={() => run("system_shutdown", "turn off")}
          />
          <PowerMenuItem
            label="Restart"
            destructive
            onClick={() => run("system_restart", "restart")}
          />
          <div className="my-1 h-px bg-border" />
          <PowerMenuItem label="Exit KuVault" onClick={handleExit} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
