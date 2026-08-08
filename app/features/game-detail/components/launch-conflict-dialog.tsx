import { Loader2 } from "lucide-react"

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

import type { LaunchConflictState } from "../hooks/use-launch-game"

export function LaunchConflictDialog({
  open,
  onOpenChange,
  games,
  targetName,
  busy,
  onLaunchAnyway,
  onCloseOthersAndLaunch,
}: LaunchConflictState) {
  const many = games.length > 1
  const otherLabel = many ? `${games.length} other games are` : `${games[0]?.name ?? "Another game"} is`

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{many ? "Other games are running" : "Another game is running"}</AlertDialogTitle>
          <AlertDialogDescription>
            {otherLabel} still running. Close {many ? "them" : "it"} before starting {targetName}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="outline" disabled={busy} onClick={onLaunchAnyway}>
            Keep running
          </AlertDialogAction>
          <AlertDialogAction disabled={busy} onClick={onCloseOthersAndLaunch}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {many ? "Close them & play" : "Close & play"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
