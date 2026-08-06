import { Pencil, Play, Star, Trash2 } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { deleteGame, toggleFavorite } from "~/lib/db"
import type { Game } from "~/lib/db-types"

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
}

export function GameInfoPanel({ game, onChange, onDeleted }: Props) {
  const { launch, launching } = useLaunchGame(game, onChange)

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
    <div className="flex flex-col gap-4">
      <div className="aspect-3/4 w-full max-w-xs overflow-hidden rounded-lg bg-muted">
        {game.cover_url ? (
          <img src={game.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center px-4 text-center font-medium text-muted-foreground">
            {game.name}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-xl font-semibold">{game.name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {game.platform}
          </Badge>
          {game.genres ? (
            <span className="text-sm text-muted-foreground">{game.genres}</span>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Playtime</dt>
        <dd>{formatPlaytime(game.playtime_seconds)}</dd>
        <dt className="text-muted-foreground">Last played</dt>
        <dd>{game.last_played_at ? new Date(game.last_played_at).toLocaleDateString() : "Never"}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{game.installed ? "Installed" : "Not installed"}</dd>
      </dl>

      {game.description ? (
        <p className="text-sm text-muted-foreground">{game.description}</p>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={launch} disabled={launching} className="gap-1.5">
          <Play className="size-4" />
          {launching ? "Running..." : "Play"}
        </Button>
        <Button variant="outline" size="icon" onClick={handleFavorite} aria-label="Favorite">
          <Star className={game.is_favorite ? "size-4 fill-current" : "size-4"} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          render={<Link to={`/games/${game.id}/edit`} />}
          aria-label="Edit"
        >
          <Pencil className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleDelete} aria-label="Remove">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
