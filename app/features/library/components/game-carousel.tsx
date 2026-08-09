import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  Play,
  Square,
} from "lucide-react"

import { Button } from "~/components/ui/button"
import { LaunchConflictDialog } from "~/features/game-detail/components/launch-conflict-dialog"
import { useLaunchGame } from "~/features/game-detail/hooks/use-launch-game"
import { toggleFavorite } from "~/lib/db/db"
import { FocusZone } from "~/lib/gamepad/focus-zone"
import { useIsGameRunning } from "~/lib/tauri/running-games"

import { GameCard } from "./game-card"
import type { Game } from "../types"

export function GameCarousel({
  games,
  onUpdateGame,
  onActiveGameChange,
  initialActiveGameId,
}: {
  games: Game[]
  onUpdateGame: (id: number, patch: Partial<Game>) => void
  onActiveGameChange?: (game: Game | undefined) => void
  initialActiveGameId?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState(
    () =>
      games.find((g) => g.id === initialActiveGameId)?.id ?? games[0]?.id,
  )
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const activeGame = games.find((g) => g.id === activeId) ?? games[0]

  useEffect(() => {
    onActiveGameChange?.(activeGame)
  }, [activeGame, onActiveGameChange])

  useEffect(() => {
    if (!games.some((g) => g.id === activeId)) {
      setActiveId(games[0]?.id)
    }
  }, [games, activeId])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    function updateScrollState() {
      if (!el) return
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(
        el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      )
    }

    updateScrollState()
    el.addEventListener("scroll", updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)

    return () => {
      el.removeEventListener("scroll", updateScrollState)
      observer.disconnect()
    }
  }, [games])

  function scrollBy(amount: number) {
    trackRef.current?.scrollBy({ left: amount, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="group/carousel relative">
        {canScrollLeft ? (
          <button
            aria-label="Scroll left"
            onClick={() => scrollBy(-600)}
            className="absolute top-1/2 left-1 z-20 -translate-y-1/2 rounded-md bg-accent/70 p-2 opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover/carousel:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : null}

        <FocusZone id="grid">
          <div
            ref={trackRef}
            className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth pb-2"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {games.map((game) => (
              <div
                key={game.id}
                className="w-44 shrink-0"
                style={{ scrollSnapAlign: "start" }}
                onMouseEnter={() => setActiveId(game.id)}
                onFocus={() => setActiveId(game.id)}
              >
                <GameCard game={game} />
              </div>
            ))}
          </div>
        </FocusZone>

        {canScrollRight ? (
          <button
            aria-label="Scroll right"
            onClick={() => scrollBy(600)}
            className="absolute top-1/2 right-1 z-20 -translate-y-1/2 rounded-md bg-accent/70 p-2 opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover/carousel:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
        ) : null}
      </div>

      {activeGame ? (
        <GameCarouselActions
          key={activeGame.id}
          game={activeGame}
          onUpdateGame={onUpdateGame}
        />
      ) : null}
    </div>
  )
}

function GameCarouselActions({
  game,
  onUpdateGame,
}: {
  game: Game
  onUpdateGame: (id: number, patch: Partial<Game>) => void
}) {
  const isRunning = useIsGameRunning(game.id)
  const { launch, launching, stop, stopping, continueGame, launchConflict } = useLaunchGame(game)

  async function handleFavorite() {
    const next = game.is_favorite === 0
    onUpdateGame(game.id, { is_favorite: next ? 1 : 0 })
    await toggleFavorite(game.id, next)
  }

  return (
    <FocusZone
      id="carousel-actions"
      className="flex items-center gap-2 self-end rounded-lg border border-border bg-background/90 p-2 shadow-lg"
    >
      <span className="truncate pl-1 text-sm font-medium">{game.name}</span>

      {isRunning ? (
        <>
          <Button size="sm" className="gap-1.5" onClick={continueGame}>
            <Play className="size-3.5" />
            Continue
          </Button>
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={stop}
            disabled={stopping}
            aria-label="Stop"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={launch}
          disabled={launching}
        >
          {launching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Play
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
          className={
            game.is_favorite ? "size-3.5 fill-current text-red-500" : "size-3.5"
          }
        />
      </Button>

      <LaunchConflictDialog {...launchConflict} />
    </FocusZone>
  )
}
