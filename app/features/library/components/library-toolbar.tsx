import { useState } from "react"
import {
  ChevronDown,
  GalleryHorizontal,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react"

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
import { FocusZone } from "~/lib/gamepad/focus-zone"
import {
  useGamepadBumpers,
  useIsGamepadConnected,
  useRegisterGamepadSearch,
} from "~/lib/gamepad/gamepad-navigation-provider"
import type { Game } from "~/lib/db/db-types"
import { cn } from "~/lib/utils"

import type { SortKey, ViewMode } from "../types"

const SORT_LABELS: Record<SortKey, string> = {
  name: "Title (A-Z)",
  "name-desc": "Title (Z-A)",
  recent: "Recently Played",
  playtime: "Most Played",
}

function BumperGlyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted-foreground/10 text-xs font-semibold text-foreground">
      {children}
    </span>
  )
}

interface Props {
  search: string
  onSearchChange: (value: string) => void
  sort: SortKey
  onSortChange: (value: SortKey) => void
  view: ViewMode
  onViewChange: (value: ViewMode) => void
  games: Game[]
  onImported: () => void
  genres: string[]
  activeGenre: string | null
  onGenreChange: (genre: string | null) => void
}

export function LibraryToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  games,
  onImported,
  genres,
  activeGenre,
  onGenreChange,
}: Props) {
  const [scanSteamOpen, setScanSteamOpen] = useState(false)
  const [scanEpicOpen, setScanEpicOpen] = useState(false)
  const [addManuallyOpen, setAddManuallyOpen] = useState(false)
  const gamepadConnected = useIsGamepadConnected()
  useRegisterGamepadSearch()

  const genreTabs = [null, ...genres]
  function cycleGenre(step: 1 | -1) {
    const index = genreTabs.indexOf(activeGenre)
    const nextIndex = (index + step + genreTabs.length) % genreTabs.length
    onGenreChange(genreTabs[nextIndex])
  }
  useGamepadBumpers(
    () => cycleGenre(-1),
    () => cycleGenre(1)
  )

  return (
    <FocusZone id="toolbar" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-gamepad-search
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search games..."
            className="bg-accent/50 pl-8"
          />
        </div>

        <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger
            size="sm"
            className="h-8! w-44 bg-accent/50 backdrop-blur-sm"
          >
            <SelectValue>{(value: SortKey) => SORT_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Title (A-Z)</SelectItem>
            <SelectItem value="name-desc">Title (Z-A)</SelectItem>
            <SelectItem value="recent">Recently Played</SelectItem>
            <SelectItem value="playtime">Most Played</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" className="h-auto gap-1.5 py-1" />}
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

          <div className="flex items-center rounded-md border border-border bg-accent/50 p-0.5 backdrop-blur-sm">
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
            <button
              type="button"
              onClick={() => onViewChange("carousel")}
              aria-label="Carousel view"
              className={cn(
                "rounded px-1.5 py-1",
                view === "carousel"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <GalleryHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {genres.length > 0 ? (
        <nav className="flex items-center gap-2">
          {gamepadConnected ? <BumperGlyph>LB</BumperGlyph> : null}
          <div className="flex flex-1 items-center justify-center gap-1 overflow-x-auto px-1 py-1">
            <button
              type="button"
              onClick={() => onGenreChange(null)}
              className={cn(
                "shrink-0 rounded-full border border-transparent px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                activeGenre === null
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All categories
            </button>
            {genres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => onGenreChange(genre)}
                className={cn(
                  "shrink-0 rounded-full border border-transparent px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  activeGenre === genre
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
          {gamepadConnected ? <BumperGlyph>RB</BumperGlyph> : null}
        </nav>
      ) : null}
    </FocusZone>
  )
}
