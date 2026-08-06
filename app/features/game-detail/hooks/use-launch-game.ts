import { useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"

import { addPlaytime } from "~/lib/db"
import type { Game } from "~/lib/db-types"
import { trackedInvoke } from "~/lib/tauri"

interface LaunchFinished {
  id: number
  playtime_seconds: number
}

export function useLaunchGame(game: Game, onFinished: () => void) {
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    const unlisten = listen<LaunchFinished>("game-launch-finished", (event) => {
      if (event.payload.id !== game.id) return
      setLaunching(false)
      addPlaytime(game.id, event.payload.playtime_seconds).then(onFinished)
    })
    return () => {
      unlisten.then((fn) => fn())
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
      })
      if (game.platform === "steam") setLaunching(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to launch game")
      setLaunching(false)
    }
  }

  return { launch, launching }
}
