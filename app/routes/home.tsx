import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { LibraryGrid } from "~/features/library/components/library-grid"
import { LibrarySidebar } from "~/features/library/components/library-sidebar"
import { LibraryToolbar } from "~/features/library/components/library-toolbar"
import { useFilteredGames } from "~/features/library/hooks/use-filtered-games"
import { useGames } from "~/features/library/hooks/use-games"
import { homeState } from "~/features/library/hooks/use-home-state"
import type { Game, LibraryFilter, SortKey, ViewMode } from "~/features/library/types"
import { useIsGamepadConnected } from "~/lib/gamepad/gamepad-navigation-provider"
import { useOnLaunchFinished } from "~/lib/tauri/running-games"

export default function Home() {
  const { games, loading, refresh, updateGame } = useGames()
  const gamepadConnected = useIsGamepadConnected()
  useOnLaunchFinished(refresh)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [filter, setFilterState] = useState<LibraryFilter>(homeState.filter)
  const [genre, setGenreState] = useState<string | null>(homeState.genre)
  const [search, setSearchState] = useState(homeState.search)
  const [sort, setSortState] = useState<SortKey>(homeState.sort)
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("library-view") as ViewMode | null) ?? "grid",
  )
  const [carouselActiveGame, setCarouselActiveGame] = useState<Game | undefined>()

  function setFilter(next: LibraryFilter) {
    homeState.filter = next
    setFilterState(next)
  }
  function setGenre(next: string | null) {
    homeState.genre = next
    setGenreState(next)
  }
  function setSearch(next: string) {
    homeState.search = next
    setSearchState(next)
  }
  function setSort(next: SortKey) {
    homeState.sort = next
    setSortState(next)
  }

  function handleViewChange(next: ViewMode) {
    setView(next)
    localStorage.setItem("library-view", next)
  }

  function handleActiveGameChange(game: Game | undefined) {
    homeState.carouselActiveId = game?.id
    setCarouselActiveGame(game)
  }

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: homeState.scrollTop })
  }, [])

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
    <div className="relative flex h-svh">
      {view === "carousel" && carouselActiveGame?.cover_url ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-30 blur-2xl transition-[background-image] duration-500"
          style={{ backgroundImage: `url(${carouselActiveGame.cover_url})` }}
        />
      ) : null}

      <LibrarySidebar filter={filter} onFilterChange={setFilter} games={games} />

      <div
        ref={scrollRef}
        onScroll={(e) => {
          homeState.scrollTop = e.currentTarget.scrollTop
        }}
        className={`relative z-10 flex flex-1 flex-col gap-4 overflow-y-auto p-4 scrollbar-custom ${gamepadConnected ? "pb-14 scroll-pb-14" : ""}`}
      >
        <LibraryToolbar
          count={filteredGames.length}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={handleViewChange}
          games={games}
          onImported={refresh}
          genres={genres}
          activeGenre={genre}
          onGenreChange={setGenre}
        />

        {loading ? (
          <p className="py-24 text-center text-sm text-muted-foreground">Loading library...</p>
        ) : (
          <LibraryGrid
            games={filteredGames}
            view={view}
            onChange={refresh}
            onUpdateGame={updateGame}
            onActiveGameChange={handleActiveGameChange}
            initialActiveGameId={homeState.carouselActiveId}
          />
        )}
      </div>
    </div>
  )
}
