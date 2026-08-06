import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("games/:id", "routes/game-detail.tsx"),
  route("games/:id/edit", "routes/edit-game.tsx"),
] satisfies RouteConfig
