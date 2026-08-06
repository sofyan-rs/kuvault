import { Link } from "react-router"

import { Badge } from "~/components/ui/badge"
import { TableCell, TableRow } from "~/components/ui/table"

import type { Game } from "../types"

function formatPlaytime(seconds: number) {
  const hours = seconds / 3600
  if (hours < 1) return `${Math.round(seconds / 60)} min`
  return `${hours.toFixed(1)} hrs`
}

export function GameListRow({ game }: { game: Game }) {
  return (
    <TableRow className="cursor-pointer">
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
      <TableCell className="text-muted-foreground">
        {game.installed ? "Installed" : "Not installed"}
      </TableCell>
    </TableRow>
  )
}
