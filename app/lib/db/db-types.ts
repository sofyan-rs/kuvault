export type Platform = "steam" | "epic" | "manual" | "emulator"

export interface Game {
  id: number
  name: string
  platform: Platform
  executable_path: string
  launch_args: string | null
  install_dir: string | null
  source_id: string | null
  cover_url: string | null
  genres: string | null
  description: string | null
  playtime_seconds: number
  last_played_at: string | null
  is_favorite: number
  run_as_admin: number
  created_at: string
}

export type NewGame = Pick<Game, "name" | "platform" | "executable_path"> &
  Partial<
    Pick<
      Game,
      | "launch_args"
      | "install_dir"
      | "source_id"
      | "cover_url"
      | "genres"
      | "description"
      | "run_as_admin"
    >
  >
