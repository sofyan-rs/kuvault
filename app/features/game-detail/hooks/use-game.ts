import { useCallback, useEffect, useState } from "react"

import { getGame } from "~/lib/db/db"
import type { Game } from "~/lib/db/db-types"

export function useGame(id: number) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const row = await getGame(id)
    setGame(row)
    setLoading(false)
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { game, loading, refresh }
}
