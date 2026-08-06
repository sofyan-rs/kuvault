import { createContext, useContext, useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"

interface LaunchStarted {
  id: number
}

interface LaunchFinished {
  id: number
  playtime_seconds: number
}

const RunningGamesContext = createContext<Set<number>>(new Set())

export function RunningGamesProvider({ children }: { children: React.ReactNode }) {
  const [runningIds, setRunningIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    const unlistenStarted = listen<LaunchStarted>("game-launch-started", (event) => {
      setRunningIds((prev) => new Set(prev).add(event.payload.id))
    })
    const unlistenFinished = listen<LaunchFinished>("game-launch-finished", (event) => {
      setRunningIds((prev) => {
        if (!prev.has(event.payload.id)) return prev
        const next = new Set(prev)
        next.delete(event.payload.id)
        return next
      })
    })
    return () => {
      unlistenStarted.then((fn) => fn())
      unlistenFinished.then((fn) => fn())
    }
  }, [])

  return (
    <RunningGamesContext.Provider value={runningIds}>{children}</RunningGamesContext.Provider>
  )
}

export function useIsGameRunning(id: number): boolean {
  const runningIds = useContext(RunningGamesContext)
  return runningIds.has(id)
}

export function useRunningGameIds(): Set<number> {
  return useContext(RunningGamesContext)
}
