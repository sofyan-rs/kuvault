import { useCallback, useEffect, useState } from "react"

import { listGames } from "~/lib/db/db"

import type { Game } from "../types"

export function useGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listGames()
      setGames(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateGame = useCallback((id: number, patch: Partial<Game>) => {
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    )
  }, [])

  return { games, loading, error, refresh, updateGame }
}
