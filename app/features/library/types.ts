export type { Game, Platform } from "~/lib/db/db-types"

export type LibraryFilter = "all" | "favorites" | "steam" | "epic"

export type SortKey = "name" | "name-desc" | "recent" | "playtime"

export type ViewMode = "grid" | "list" | "carousel"
