import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { listen } from "@tauri-apps/api/event"

import { addPlaytime } from "~/lib/db/db"

interface LaunchStarted {
  id: number
}

interface LaunchFinished {
  id: number
  playtime_seconds: number
}

interface LaunchActions {
  beginLaunch: (id: number) => void
  cancelLaunch: (id: number) => void
}

// Safety net for platforms (Steam without a recorded install dir) where the backend can never
// detect the process starting — don't leave the button disabled forever.
const LAUNCH_TIMEOUT_MS = 30000

const RunningGamesContext = createContext<Set<number>>(new Set())
const PendingLaunchContext = createContext<Set<number>>(new Set())
const LaunchActionsContext = createContext<LaunchActions>({
  beginLaunch: () => {},
  cancelLaunch: () => {},
})
const FinishedTickContext = createContext<number>(0)

export function RunningGamesProvider({ children }: { children: React.ReactNode }) {
  const [runningIds, setRunningIds] = useState<Set<number>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [finishedTick, setFinishedTick] = useState(0)
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const beginLaunch = useCallback(
    (id: number) => {
      clearTimer(id)
      setPendingIds((prev) => new Set(prev).add(id))
      const timer = setTimeout(() => {
        timersRef.current.delete(id)
        setPendingIds((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, LAUNCH_TIMEOUT_MS)
      timersRef.current.set(id, timer)
    },
    [clearTimer],
  )

  const cancelLaunch = useCallback(
    (id: number) => {
      clearTimer(id)
      setPendingIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [clearTimer],
  )

  const actions = useMemo<LaunchActions>(() => ({ beginLaunch, cancelLaunch }), [beginLaunch, cancelLaunch])

  useEffect(() => {
    const unlistenStarted = listen<LaunchStarted>("game-launch-started", (event) => {
      const { id } = event.payload
      clearTimer(id)
      setPendingIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setRunningIds((prev) => new Set(prev).add(id))
    })
    const unlistenFinished = listen<LaunchFinished>("game-launch-finished", (event) => {
      const { id, playtime_seconds } = event.payload
      clearTimer(id)
      setPendingIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setRunningIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      addPlaytime(id, playtime_seconds).then(() => setFinishedTick((t) => t + 1))
    })
    return () => {
      unlistenStarted.then((fn) => fn())
      unlistenFinished.then((fn) => fn())
    }
  }, [clearTimer])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  return (
    <LaunchActionsContext.Provider value={actions}>
      <RunningGamesContext.Provider value={runningIds}>
        <PendingLaunchContext.Provider value={pendingIds}>
          <FinishedTickContext.Provider value={finishedTick}>
            {children}
          </FinishedTickContext.Provider>
        </PendingLaunchContext.Provider>
      </RunningGamesContext.Provider>
    </LaunchActionsContext.Provider>
  )
}

export function useIsGameRunning(id: number): boolean {
  const runningIds = useContext(RunningGamesContext)
  return runningIds.has(id)
}

export function useRunningGameIds(): Set<number> {
  return useContext(RunningGamesContext)
}

export function usePendingLaunchIds(): Set<number> {
  return useContext(PendingLaunchContext)
}

export function useIsGameLaunching(id: number): boolean {
  const pendingIds = useContext(PendingLaunchContext)
  return pendingIds.has(id)
}

export function useLaunchActions(): LaunchActions {
  return useContext(LaunchActionsContext)
}

export function useOnLaunchFinished(callback: () => void): void {
  const tick = useContext(FinishedTickContext)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (tick > 0) callbackRef.current()
  }, [tick])
}
