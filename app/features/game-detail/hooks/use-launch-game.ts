import { useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"

import { addPlaytime } from "~/lib/db"
import type { Game } from "~/lib/db-types"
import { trackedInvoke } from "~/lib/tauri"

interface LaunchStarted {
  id: number
}

interface LaunchFinished {
  id: number
  playtime_seconds: number
}

// Safety net for platforms (Steam without a recorded install dir) where the backend can never
// detect the process starting — don't leave the button disabled forever.
const LAUNCH_TIMEOUT_MS = 30000

export function useLaunchGame(game: Game, onFinished: () => void) {
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    const unlistenStarted = listen<LaunchStarted>("game-launch-started", (event) => {
      if (event.payload.id !== game.id) return
      setLaunching(false)
    })
    const unlistenFinished = listen<LaunchFinished>("game-launch-finished", (event) => {
      if (event.payload.id !== game.id) return
      setLaunching(false)
      addPlaytime(game.id, event.payload.playtime_seconds).then(onFinished)
    })
    return () => {
      unlistenStarted.then((fn) => fn())
      unlistenFinished.then((fn) => fn())
    }
  }, [game.id, onFinished])

  async function launch() {
    setLaunching(true)
    try {
      await trackedInvoke("launch_game", {
        id: game.id,
        platform: game.platform,
        executablePath: game.executable_path,
        launchArgs: game.launch_args,
        installDir: game.install_dir,
      })
      setTimeout(() => setLaunching(false), LAUNCH_TIMEOUT_MS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to launch game")
      setLaunching(false)
    }
  }

  async function stop() {
    try {
      await trackedInvoke("stop_game", { id: game.id, installDir: game.install_dir })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop game")
    }
  }

  return { launch, launching, stop }
}
