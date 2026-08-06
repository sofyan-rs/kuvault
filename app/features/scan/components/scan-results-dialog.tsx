import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { addGame, getSetting, setPlaytime } from "~/lib/db"
import type { Game } from "~/lib/db-types"
import { trackedInvoke } from "~/lib/tauri"

import { STEAM_API_KEY_SETTING, STEAM_ID_SETTING } from "~/features/settings/components/steam-api-form"
import { STEAMGRIDDB_KEY_SETTING } from "~/features/settings/components/steamgriddb-key-form"

import { useScan } from "../hooks/use-scan"
import type { ScannedGame } from "../types"

interface Props {
  platform: "steam" | "epic"
  label: string
  existingGames: Game[]
  onImported: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScanResultsDialog({
  platform,
  label,
  existingGames,
  onImported,
  open,
  onOpenChange,
}: Props) {
  const { results, loading, error, scan } = useScan(platform)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const selectAllRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Base UI's dialog auto-focus fires once on mount, while only the close button is
  // focusable (scan still loading) — move focus to the first real action once it renders.
  useEffect(() => {
    if (open && !loading) selectAllRef.current?.focus()
  }, [open, loading])

  const existingIds = new Set(
    existingGames.filter((g) => g.platform === platform).map((g) => g.source_id),
  )
  const newGames = results.filter((g) => !existingIds.has(g.source_id))

  function toggle(sourceId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(newGames.map((g) => g.source_id)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  async function fetchCoverUrl(apiKey: string, game: ScannedGame) {
    try {
      if (platform === "steam") {
        return (
          (await trackedInvoke<string | null>("steamgriddb_cover_for_steam_appid", {
            appid: game.source_id,
            apiKey,
          })) ?? undefined
        )
      }
      const covers = await trackedInvoke<{ url: string }[]>("search_steamgriddb_covers", {
        query: game.name,
        apiKey,
      })
      return covers[0]?.url
    } catch {
      return undefined
    }
  }

  async function fetchSteamPlaytimes(): Promise<Map<string, number>> {
    if (platform !== "steam") return new Map()

    const [apiKey, steamId] = await Promise.all([
      getSetting(STEAM_API_KEY_SETTING),
      getSetting(STEAM_ID_SETTING),
    ])
    if (!apiKey || !steamId) return new Map()

    try {
      const owned = await trackedInvoke<{ appid: string; playtime_minutes: number }[]>(
        "get_steam_owned_playtimes",
        { apiKey, steamId },
      )
      return new Map(owned.map((g) => [g.appid, g.playtime_minutes * 60]))
    } catch {
      return new Map()
    }
  }

  async function handleImport() {
    setImporting(true)
    try {
      const coverApiKey = await getSetting(STEAMGRIDDB_KEY_SETTING)
      const playtimes = await fetchSteamPlaytimes()

      for (const game of newGames.filter((g) => selected.has(g.source_id))) {
        const coverUrl = coverApiKey ? await fetchCoverUrl(coverApiKey, game) : undefined

        const id = await addGame({
          name: game.name,
          platform: game.platform,
          executable_path: game.executable_path,
          install_dir: game.install_dir,
          source_id: game.source_id,
          cover_url: coverUrl,
        })

        const playtimeSeconds = playtimes.get(game.source_id)
        if (id && playtimeSeconds) {
          await setPlaytime(id, playtimeSeconds)
        }
      }
      const platformLabel = platform === "steam" ? "Steam" : "Epic"
      toast.success(`Imported ${selected.size} game${selected.size === 1 ? "" : "s"} from ${platformLabel}`)
      onImported()
      onOpenChange(false)
      setSelected(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Select the games you want to add to your library.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Scanning...</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : newGames.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No new games found.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button ref={selectAllRef} type="button" variant="ghost" size="sm" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={deselectAll}>
                Deselect all
              </Button>
            </div>
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {newGames.map((game) => (
                <button
                  key={game.source_id}
                  type="button"
                  data-focus-style="border"
                  onClick={() => toggle(game.source_id)}
                  className="relative flex w-full items-center gap-2 rounded-md border-3 border-transparent px-2 py-1.5 text-left text-sm hover:bg-muted focus:outline-none data-[gamepad-active=true]:border-primary data-[gamepad-active=true]:bg-muted"
                >
                  <Checkbox
                    tabIndex={-1}
                    checked={selected.has(game.source_id)}
                    onCheckedChange={() => toggle(game.source_id)}
                    className="pointer-events-none"
                  />
                  {game.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleImport}
            disabled={importing || selected.size === 0}
          >
            {importing ? "Importing..." : `Import (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
