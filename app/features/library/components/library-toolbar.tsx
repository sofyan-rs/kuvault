import { useState } from "react"
import { ChevronDown, LayoutGrid, List, Plus, Search } from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { AddGameDialog } from "~/features/add-game/components/add-game-dialog"
import { ScanResultsDialog } from "~/features/scan/components/scan-results-dialog"
import type { Game } from "~/lib/db-types"
import { cn } from "~/lib/utils"

import type { SortKey, ViewMode } from "../types"

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  recent: "Recently played",
  playtime: "Playtime",
}

interface Props {
  count: number
  search: string
  onSearchChange: (value: string) => void
  sort: SortKey
  onSortChange: (value: SortKey) => void
  view: ViewMode
  onViewChange: (value: ViewMode) => void
  games: Game[]
  onImported: () => void
}

export function LibraryToolbar({
  count,
  search,
  onSearchChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  games,
  onImported,
}: Props) {
  const [scanSteamOpen, setScanSteamOpen] = useState(false)
  const [scanEpicOpen, setScanEpicOpen] = useState(false)
  const [addManuallyOpen, setAddManuallyOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search games..."
            className="pl-8"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" className="gap-1.5" />}
            >
              <Plus className="size-4" />
              Add Game
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setScanSteamOpen(true)}>
                Scan Steam
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setScanEpicOpen(true)}>
                Scan Epic Games
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddManuallyOpen(true)}>
                Add Manually
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AddGameDialog
            open={addManuallyOpen}
            onOpenChange={setAddManuallyOpen}
            onAdded={onImported}
          />

          <ScanResultsDialog
            platform="steam"
            label="Scan Steam"
            existingGames={games}
            onImported={onImported}
            open={scanSteamOpen}
            onOpenChange={setScanSteamOpen}
          />
          <ScanResultsDialog
            platform="epic"
            label="Scan Epic Games"
            existingGames={games}
            onImported={onImported}
            open={scanEpicOpen}
            onOpenChange={setScanEpicOpen}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{count} games</p>

        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onValueChange={(v) => onSortChange(v as SortKey)}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue>
                {(value: SortKey) => SORT_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="recent">Recently played</SelectItem>
              <SelectItem value="playtime">Playtime</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => onViewChange("grid")}
              aria-label="Grid view"
              className={cn(
                "rounded px-1.5 py-1",
                view === "grid"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewChange("list")}
              aria-label="List view"
              className={cn(
                "rounded px-1.5 py-1",
                view === "list"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
