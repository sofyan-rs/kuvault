import { Heart, Pencil, Play, Square, Trash2 } from "lucide-react"
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
import { deleteGame, toggleFavorite } from "~/lib/db"
import type { Game } from "~/lib/db-types"
import { useIsGameRunning } from "~/lib/running-games"

import { useLaunchGame } from "../hooks/use-launch-game"

function formatPlaytime(seconds: number) {
  const hours = seconds / 3600
  if (hours < 1) return `${Math.round(seconds / 60)} min`
  return `${hours.toFixed(1)} hrs`
}

interface Props {
  game: Game
  onChange: () => void
  onDeleted: () => void
  onEdit: () => void
}

export function GameInfoPanel({ game, onChange, onDeleted, onEdit }: Props) {
  const { launch, launching, stop } = useLaunchGame(game, onChange)
  const isRunning = useIsGameRunning(game.id)

  async function handleFavorite() {
    await toggleFavorite(game.id, game.is_favorite === 0)
    onChange()
  }

  async function handleDelete() {
    await deleteGame(game.id)
    toast.success(`${game.name} removed`)
    onDeleted()
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="aspect-3/4 w-full shrink-0 overflow-hidden rounded-lg bg-muted shadow-lg sm:w-56">
        {game.cover_url ? (
          <img src={game.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center px-4 text-center font-medium text-muted-foreground">
            {game.name}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{game.name}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {game.platform}
            </Badge>
            {game.genres ? (
              <span className="text-sm text-muted-foreground">
                {game.genres}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              onClick={stop}
              variant="destructive"
              className="h-auto flex-1 gap-1.5 py-2 sm:flex-none sm:px-10"
            >
              <Square className="size-4 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={launch}
              disabled={launching}
              className="h-auto flex-1 gap-1.5 py-2 sm:flex-none sm:px-10"
            >
              <Play className="size-4" />
              {launching ? "Launching..." : "Play"}
            </Button>
          )}
          <Button
            className="h-auto p-2"
            variant="outline"
            size="icon"
            onClick={handleFavorite}
            aria-label="Favorite"
            aria-pressed={!!game.is_favorite}
          >
            <Heart
              className={
                game.is_favorite
                  ? "size-4 fill-current text-red-500"
                  : "size-4"
              }
            />
          </Button>
          <Button
            className="h-auto p-2"
            variant="outline"
            size="icon"
            onClick={onEdit}
            aria-label="Edit"
          >
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Remove"
                  className="h-auto p-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                />
              }
            >
              <Trash2 className="size-4" />
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
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-card/50 p-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Playtime</div>
            <div className="font-medium">
              {formatPlaytime(game.playtime_seconds)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last played</div>
            <div className="font-medium">
              {game.last_played_at
                ? new Date(game.last_played_at).toLocaleDateString()
                : "Never"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="font-medium">
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-500">
                  <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                  Running
                </span>
              ) : (
                "Idle"
              )}
            </div>
          </div>
        </div>

        {game.description ? (
          <p className="text-sm text-muted-foreground">{game.description}</p>
        ) : null}
      </div>
    </div>
  )
}
