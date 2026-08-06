import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  GamepadDirectional,
  Heart,
  Maximize,
  Minimize,
  Settings,
} from "lucide-react"

import { SettingsDialog } from "~/features/settings/components/settings-dialog"
import { useFullscreen } from "~/lib/use-fullscreen"
import { cn } from "~/lib/utils"

import type { LibraryFilter } from "../types"

const COLLAPSED_STORAGE_KEY = "kuvault-sidebar-collapsed"

interface Props {
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
  genres: string[]
  activeGenre: string | null
  onGenreChange: (genre: string | null) => void
}

const FILTERS: { key: LibraryFilter; label: string; icon: typeof Gamepad2 }[] =
  [
    { key: "all", label: "All Games", icon: Gamepad2 },
    { key: "favorites", label: "Favorites", icon: Heart },
  ]

function NavButton({
  active,
  onClick,
  icon: Icon,
  collapsed,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Gamepad2
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? String(children) : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border-transparent px-2.5 py-1.5 text-left text-sm transition-colors",
        collapsed ? "justify-center border-b-4 px-0" : "border-l-4",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "border-primary"
      )}
    >
      <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
      {collapsed ? null : children}
    </button>
  )
}

export function LibrarySidebar({
  filter,
  onFilterChange,
  genres,
  activeGenre,
  onGenreChange,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1",
  )

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col gap-3 border-r border-border p-3 transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          collapsed ? "justify-center px-0" : "justify-between"
        )}
      >
        {collapsed ? null : (
          <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-sm font-semibold">
            <GamepadDirectional className="size-4 shrink-0 text-accent" />
            <span className="truncate text-accent">KuVault</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-7 shrink-0 items-center justify-center rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-5 shrink-0" />
          ) : (
            <ChevronLeft className="size-5 shrink-0" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-2">
        {FILTERS.map(({ key, label, icon }) => (
          <NavButton
            key={key}
            active={filter === key}
            onClick={() => onFilterChange(key)}
            icon={icon}
            collapsed={collapsed}
          >
            {label}
          </NavButton>
        ))}
      </nav>

      {genres.length > 0 && !collapsed ? (
        <div className="flex flex-col gap-2">
          <div className="px-2.5 text-xs font-medium text-muted-foreground">
            Categories
          </div>
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() =>
                onGenreChange(activeGenre === genre ? null : genre)
              }
              className={cn(
                "truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                activeGenre === genre
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleFullscreen}
        title={collapsed ? (isFullscreen ? "Exit Fullscreen" : "Fullscreen") : undefined}
        className={cn(
          "mt-auto flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-0"
        )}
      >
        {isFullscreen ? (
          <Minimize className="size-5 shrink-0" />
        ) : (
          <Maximize className="size-5 shrink-0" />
        )}
        {collapsed ? null : isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      </button>

      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        title={collapsed ? "Settings" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-0"
        )}
      >
        <Settings className="size-5 shrink-0" />
        {collapsed ? null : "Settings"}
      </button>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  )
}
