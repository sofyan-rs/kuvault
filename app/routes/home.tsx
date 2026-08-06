import { useMemo, useState } from "react"

import { LibraryGrid } from "~/features/library/components/library-grid"
import { LibrarySidebar } from "~/features/library/components/library-sidebar"
import { LibraryToolbar } from "~/features/library/components/library-toolbar"
import { useFilteredGames } from "~/features/library/hooks/use-filtered-games"
import { useGames } from "~/features/library/hooks/use-games"
import type { LibraryFilter, SortKey, ViewMode } from "~/features/library/types"

export default function Home() {
  const { games, loading, refresh } = useGames()

  const [filter, setFilter] = useState<LibraryFilter>("all")
  const [genre, setGenre] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("name")
  const [view, setView] = useState<ViewMode>("grid")

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const game of games) {
      game.genres
        ?.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => set.add(tag))
    }
    return [...set].sort()
  }, [games])

  const filteredGames = useFilteredGames({ games, filter, genre, search, sort })

  return (
    <div className="flex h-svh">
      <LibrarySidebar
        filter={filter}
        onFilterChange={setFilter}
        genres={genres}
        activeGenre={genre}
        onGenreChange={setGenre}
      />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <LibraryToolbar
          count={filteredGames.length}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={setView}
          games={games}
          onImported={refresh}
        />

        {loading ? (
          <p className="py-24 text-center text-sm text-muted-foreground">Loading library...</p>
        ) : (
          <LibraryGrid games={filteredGames} view={view} />
        )}
      </div>
    </div>
  )
}
