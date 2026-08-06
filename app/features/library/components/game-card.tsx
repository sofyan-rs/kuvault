import { Link } from "react-router"

import { PlatformIcon } from "./platform-icon"
import type { Game } from "../types"

export function GameCard({ game }: { game: Game }) {
  return (
    <Link
      to={`/games/${game.id}`}
      className="group relative block aspect-3/4 overflow-hidden rounded-xl border bg-muted shadow-lg shadow-black/40 transition-all outline-none hover:border-3 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
    >
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt=""
          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex size-full items-center justify-center px-3 text-center text-sm font-medium text-muted-foreground">
          {game.name}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <p className="line-clamp-3 text-sm font-medium text-white">
          {game.name}
        </p>
        <PlatformIcon platform={game.platform} className="size-5 shrink-0 text-white" />
      </div>
    </Link>
  )
}
