import { useMemo } from "react"

import type { Game, LibraryFilter, SortKey } from "../types"

interface Options {
  games: Game[]
  filter: LibraryFilter
  genre: string | null
  search: string
  sort: SortKey
}

export function useFilteredGames({ games, filter, genre, search, sort }: Options) {
  return useMemo(() => {
    let result = games

    if (filter === "favorites") result = result.filter((g) => g.is_favorite === 1)
    else if (filter === "steam" || filter === "epic") result = result.filter((g) => g.platform === filter)

    if (genre) {
      result = result.filter((g) =>
        g.genres
          ?.split(",")
          .map((tag) => tag.trim().toLowerCase())
          .includes(genre.toLowerCase()),
      )
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      result = result.filter((g) => g.name.toLowerCase().includes(query))
    }

    result = [...result].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "playtime") return b.playtime_seconds - a.playtime_seconds
      // recent
      return (b.last_played_at ?? "").localeCompare(a.last_played_at ?? "")
    })

    return result
  }, [games, filter, genre, search, sort])
}
