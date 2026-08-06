import { useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"

import { addPlaytime } from "~/lib/db/db"
import type { Game } from "~/lib/db/db-types"
import { trackedInvoke } from "~/lib/tauri/tauri"

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

// Tauri's invoke() rejects with whatever the Rust side's Result::Err serializes to — for this
// backend that's a plain string, not an Error instance, so `err instanceof Error` misses it and
// falls back to a generic message that hides the real reason (missing exe, bad path, etc).
function toErrorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  return "Failed to launch game"
}

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
        runAsAdmin: game.run_as_admin === 1,
      })
      setTimeout(() => setLaunching(false), LAUNCH_TIMEOUT_MS)
    } catch (err) {
      toast.error(toErrorMessage(err))
      setLaunching(false)
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
