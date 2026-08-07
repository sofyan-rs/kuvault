import { toast } from "sonner"

import { getSetting, setPlaytime } from "~/lib/db/db"
import type { Game } from "~/lib/db/db-types"
import { STEAM_API_KEY_SETTING, STEAM_ID_SETTING } from "~/features/settings/components/steam-api-form"
import { trackedInvoke } from "~/lib/tauri/tauri"
import { useIsGameLaunching, useLaunchActions } from "~/lib/tauri/running-games"

// Tauri's invoke() rejects with whatever the Rust side's Result::Err serializes to — for this
// backend that's a plain string, not an Error instance, so `err instanceof Error` misses it and
// falls back to a generic message that hides the real reason (missing exe, bad path, etc).
function toErrorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  return "Failed to launch game"
}

export function useLaunchGame(game: Game) {
  const launching = useIsGameLaunching(game.id)
  const { beginLaunch, cancelLaunch } = useLaunchActions()

  async function syncSteamPlaytime() {
    if (game.platform !== "steam" || !game.source_id) return
    try {
      const [apiKey, steamId] = await Promise.all([
        getSetting(STEAM_API_KEY_SETTING),
        getSetting(STEAM_ID_SETTING),
      ])
      if (!apiKey || !steamId) return

      const owned = await trackedInvoke<{ appid: string; playtime_minutes: number }[]>(
        "get_steam_owned_playtimes",
        { apiKey, steamId },
      )
      const remoteSeconds = owned.find((g) => g.appid === game.source_id)?.playtime_minutes
      if (remoteSeconds === undefined) return

      const remoteTotal = remoteSeconds * 60
      if (remoteTotal > game.playtime_seconds) {
        await setPlaytime(game.id, remoteTotal)
      }
    } catch {
      // Steam sync is best-effort — never block a launch on it.
    }
  }

  async function launch() {
    beginLaunch(game.id)
    try {
      await syncSteamPlaytime()
      await trackedInvoke("launch_game", {
        id: game.id,
        platform: game.platform,
        executablePath: game.executable_path,
        launchArgs: game.launch_args,
        installDir: game.install_dir,
        runAsAdmin: game.run_as_admin === 1,
        sourceId: game.source_id,
      })
    } catch (err) {
      toast.error(toErrorMessage(err))
      cancelLaunch(game.id)
    }
  }

  async function stop() {
    try {
      await trackedInvoke("stop_game", { id: game.id, installDir: game.install_dir })
    } catch (err) {
      toast.error(toErrorMessage(err))
    }
  }

  async function continueGame() {
    try {
      await trackedInvoke("focus_running_game", { id: game.id })
    } catch (err) {
      toast.error(toErrorMessage(err))
    }
  }

  return { launch, launching, stop, continueGame }
}
