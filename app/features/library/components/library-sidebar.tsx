import { useMemo, useState } from "react"
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
import { FocusZone } from "~/lib/gamepad/focus-zone"
import { useGamepadBumpers } from "~/lib/gamepad/gamepad-navigation-provider"
import { useFullscreen } from "~/lib/use-fullscreen"
import { cn } from "~/lib/utils"

import { PlatformIcon } from "./platform-icon"
import type { Game, LibraryFilter } from "../types"

const COLLAPSED_STORAGE_KEY = "kuvault-sidebar-collapsed"

interface Props {
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
  games: Game[]
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  collapsed,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: (props: { className?: string }) => React.ReactNode
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

export function LibrarySidebar({ filter, onFilterChange, games }: Props) {
  const hasSteam = useMemo(
    () => games.some((g) => g.platform === "steam"),
    [games]
  )
  const hasEpic = useMemo(
    () => games.some((g) => g.platform === "epic"),
    [games]
  )

  const filters: {
    key: LibraryFilter
    label: string
    icon: (props: { className?: string }) => React.ReactNode
  }[] = [
    {
      key: "all",
      label: "All Games",
      icon: (p: { className?: string }) => <Gamepad2 {...p} />,
    },
    {
      key: "favorites",
      label: "Favorites",
      icon: (p: { className?: string }) => <Heart {...p} />,
    },
    ...(hasSteam
      ? [
          {
            key: "steam" as const,
            label: "Steam",
            icon: (p: { className?: string }) => (
              <PlatformIcon platform="steam" {...p} />
            ),
          },
        ]
      : []),
    ...(hasEpic
      ? [
          {
            key: "epic" as const,
            label: "Epic Games",
            icon: (p: { className?: string }) => (
              <PlatformIcon platform="epic" {...p} />
            ),
          },
        ]
      : []),
  ]
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof localStorage !== "undefined" &&
      localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1"
  )

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  function cycleFilter(step: 1 | -1) {
    const index = filters.findIndex((f) => f.key === filter)
    const nextIndex = (index + step + filters.length) % filters.length
    onFilterChange(filters[nextIndex].key)
  }

  useGamepadBumpers(
    () => cycleFilter(-1),
    () => cycleFilter(1)
  )

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col gap-3 border-r border-border p-3 transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <FocusZone id="sidebar" className="contents">
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
          {filters.map(({ key, label, icon }) => (
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

        <button
          type="button"
          onClick={toggleFullscreen}
          title={
            collapsed
              ? isFullscreen
                ? "Exit Fullscreen"
                : "Fullscreen"
              : undefined
          }
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
      </FocusZone>
    </aside>
  )
}
