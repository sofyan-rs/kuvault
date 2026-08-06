import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { FocusZone } from "~/lib/gamepad/focus-zone"

import { GameCard } from "./game-card"
import { GameListRow } from "./game-list-row"
import type { Game, ViewMode } from "../types"

export function LibraryGrid({
  games,
  view,
  onChange,
}: {
  games: Game[]
  view: ViewMode
  onChange: () => void
}) {
  if (games.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-24 text-center">
        <p className="text-sm font-medium">No games here yet</p>
        <p className="text-sm text-muted-foreground">
          Add a game manually or scan Steam/Epic to get started.
        </p>
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
              <GameListRow key={game.id} game={game} onChange={onChange} />
            ))}
          </TableBody>
        </Table>
      </FocusZone>
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
