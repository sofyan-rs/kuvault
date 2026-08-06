import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table"

import { GameCard } from "./game-card"
import { GameListRow } from "./game-list-row"
import type { Game, ViewMode } from "../types"

export function LibraryGrid({ games, view }: { games: Game[]; view: ViewMode }) {
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Playtime</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((game) => (
            <GameListRow key={game.id} game={game} />
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  )
}
