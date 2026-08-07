export type Direction = "up" | "down" | "left" | "right"

export type ButtonAction = "activate" | "back"

export type ZoneId = "sidebar" | "toolbar" | "grid" | "carousel-actions"

export const ZONE_ADJACENCY: Record<ZoneId, Partial<Record<Direction, ZoneId>>> = {
  sidebar: { right: "grid" },
  toolbar: { down: "grid" },
  grid: { left: "sidebar", up: "toolbar", down: "carousel-actions" },
  "carousel-actions": { up: "grid" },
}
