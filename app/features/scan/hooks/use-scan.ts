import { useState } from "react"

import { trackedInvoke } from "~/lib/tauri/tauri"

import type { ScannedGame } from "../types"

export function useScan(platform: "steam" | "epic") {
  const [results, setResults] = useState<ScannedGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function scan() {
    setLoading(true)
    setError(null)
    try {
      const command = platform === "steam" ? "scan_steam" : "scan_epic"
      const found = await trackedInvoke<ScannedGame[]>(command)
      setResults(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setLoading(false)
    }
  }

  return { results, loading, error, scan }
}
