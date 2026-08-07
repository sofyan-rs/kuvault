import { Gamepad2 } from "lucide-react"

import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { FocusZone } from "~/lib/gamepad/focus-zone"

import { GameCard } from "./game-card"
import { GameCarousel } from "./game-carousel"
import { GameListRow } from "./game-list-row"
import type { Game, ViewMode } from "../types"

export function LibraryGrid({
  games,
  view,
  onChange,
  onUpdateGame,
  onActiveGameChange,
  initialActiveGameId,
}: {
  games: Game[]
  view: ViewMode
  onChange: () => void
  onUpdateGame: (id: number, patch: Partial<Game>) => void
  onActiveGameChange?: (game: Game | undefined) => void
  initialActiveGameId?: number
}) {
  if (games.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Gamepad2 className="size-7 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No games here yet</p>
          <p className="text-sm text-muted-foreground">
            Add a game manually or scan Steam/Epic to get started.
          </p>
        </div>
      </div>
    )
  }

  if (view === "list") {
    return (
      <FocusZone id="grid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Playtime</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((game) => (
              <GameListRow
                key={game.id}
                game={game}
                onChange={onChange}
                onUpdateGame={onUpdateGame}
              />
            ))}
          </TableBody>
        </Table>
      </FocusZone>
    )
  }

  if (view === "carousel") {
    return (
      <GameCarousel
        games={games}
        onUpdateGame={onUpdateGame}
        onActiveGameChange={onActiveGameChange}
        initialActiveGameId={initialActiveGameId}
      />
    )
  }

  return (
    <FocusZone
      id="grid"
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}
    >
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </FocusZone>
  )
}
