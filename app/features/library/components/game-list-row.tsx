import { useState } from "react"
import { Link } from "react-router"
import { Heart, Loader2, Pencil, Play, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { TableCell, TableRow } from "~/components/ui/table"
import { EditGameDialog } from "~/features/add-game/components/edit-game-dialog"
import { useLaunchGame } from "~/features/game-detail/hooks/use-launch-game"
import { deleteGame, toggleFavorite } from "~/lib/db/db"
import { useIsGameRunning } from "~/lib/tauri/running-games"

import type { Game } from "../types"

function formatPlaytime(seconds: number) {
  const hours = seconds / 3600
  if (hours < 1) return `${Math.round(seconds / 60)} min`
  return `${hours.toFixed(1)} hrs`
}

export function GameListRow({ game, onChange }: { game: Game; onChange: () => void }) {
  const isRunning = useIsGameRunning(game.id)
  const { launch, launching, stop } = useLaunchGame(game, onChange)
  const [editOpen, setEditOpen] = useState(false)

  async function handleFavorite() {
    await toggleFavorite(game.id, game.is_favorite === 0)
    onChange()
  }

  async function handleDelete() {
    await deleteGame(game.id)
    toast.success(`${game.name} removed`)
    onChange()
  }

  return (
    <TableRow>
      <TableCell>
        <Link to={`/games/${game.id}`} className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
            {game.cover_url ? (
              <img src={game.cover_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <span className="font-medium">{game.name}</span>
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {game.platform}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatPlaytime(game.playtime_seconds)}
      </TableCell>
      <TableCell>
        {isRunning ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
            Running
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Idle</span>
        )}
      </TableCell>
      <TableCell className="w-px">
        <div className="flex items-center justify-end gap-1.5">
          {isRunning ? (
            <Button
              size="icon-sm"
              variant="destructive"
              onClick={stop}
              aria-label="Stop"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              onClick={launch}
              disabled={launching}
              aria-label="Play"
            >
              {launching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleFavorite}
            aria-label="Favorite"
            aria-pressed={!!game.is_favorite}
          >
            <Heart
              className={game.is_favorite ? "size-3.5 fill-current text-red-500" : "size-3.5"}
            />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="Edit"
          >
            <Pencil className="size-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Remove"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                />
              }
            >
              <Trash2 className="size-3.5" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {game.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the game from your library. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <EditGameDialog
          game={game}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={onChange}
        />
      </TableCell>
    </TableRow>
  )
}
