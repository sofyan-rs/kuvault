export interface ScannedGame {
  name: string
  platform: "steam" | "epic"
  executable_path: string
  install_dir: string
  source_id: string
}
