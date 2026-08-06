import { Link } from "react-router"

import { useIsGameRunning } from "~/lib/tauri/running-games"

import { PlatformIcon } from "./platform-icon"
import type { Game } from "../types"

export function GameCard({ game }: { game: Game }) {
  const isRunning = useIsGameRunning(game.id)

  return (
    <Link
      to={`/games/${game.id}`}
      data-focus-style="border"
      className="group relative block aspect-3/4 overflow-hidden rounded-xl border bg-muted shadow-lg shadow-black/40 transition-all outline-none hover:border-3 hover:border-primary focus-visible:border-3 focus-visible:border-primary data-[gamepad-active=true]:border-3 data-[gamepad-active=true]:border-primary"
    >
      {isRunning ? (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-2 pl-1.5 text-xs font-medium text-white backdrop-blur-xs">
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
          Running
        </div>
      ) : null}

      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt=""
          className="size-full object-cover transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-105 group-data-[gamepad-active=true]:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex size-full items-center justify-center px-3 text-center text-sm font-medium text-muted-foreground">
          {game.name}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[gamepad-active=true]:opacity-100">
        <p className="line-clamp-3 text-sm font-medium text-white">
          {game.name}
        </p>
        <PlatformIcon platform={game.platform} className="size-5 shrink-0 text-white" />
      </div>
    </Link>
  )
}
