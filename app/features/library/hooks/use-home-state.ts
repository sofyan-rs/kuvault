import type { LibraryFilter, SortKey, ViewMode } from "../types"

/**
 * Module-level singleton so home UI state (filters, scroll, focused game) survives
 * navigating to game detail and back, since the route component unmounts on nav.
 */
export const homeState: {
  filter: LibraryFilter
  genre: string | null
  search: string
  sort: SortKey
  scrollTop: number
  carouselActiveId: number | undefined
} = {
  filter: "all",
  genre: null,
  search: "",
  sort: "name",
  scrollTop: 0,
  carouselActiveId: undefined,
}
