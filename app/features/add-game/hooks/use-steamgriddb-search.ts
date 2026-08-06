import { useState } from "react"

import { getSetting } from "~/lib/db/db"
import { trackedInvoke } from "~/lib/tauri/tauri"

import { STEAMGRIDDB_KEY_SETTING } from "~/features/settings/components/steamgriddb-key-form"

interface CoverOption {
  url: string
  thumb_url: string
}

export function useSteamGridDbSearch() {
  const [results, setResults] = useState<CoverOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(query: string) {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    try {
      const apiKey = await getSetting(STEAMGRIDDB_KEY_SETTING)
      if (!apiKey) {
        setError("Add your SteamGridDB API key in Settings first")
        return
      }
      const covers = await trackedInvoke<CoverOption[]>("search_steamgriddb_covers", {
        query,
        apiKey,
      })
      setResults(covers)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  return { results, loading, error, search }
}
