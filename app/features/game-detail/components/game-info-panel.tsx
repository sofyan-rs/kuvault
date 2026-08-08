import { useEffect, useState } from "react"
import {
  Activity,
  CalendarClock,
  Clock3,
  HardDrive,
  Heart,
  Pencil,
  Play,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { PlatformIcon } from "~/features/library/components/platform-icon"
import { deleteGame, toggleFavorite } from "~/lib/db/db"
import type { Game } from "~/lib/db/db-types"
import { trackedInvoke } from "~/lib/tauri/tauri"
import { useIsGameRunning } from "~/lib/tauri/running-games"
import { cn } from "~/lib/utils"

import { LaunchConflictDialog } from "./launch-conflict-dialog"
import { useLaunchGame } from "../hooks/use-launch-game"

function formatPlaytime(seconds: number) {
  const hours = seconds / 3600
  if (hours < 1) return `${Math.round(seconds / 60)} min`
  return `${hours.toFixed(1)} hrs`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString()
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function StatTile({
  icon: Icon,
  label,
  accent,
  children,
}: {
  icon: LucideIcon
  label: string
  accent?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card/70 p-4 ring-1 ring-foreground/10 backdrop-blur-sm">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted",
          accent ?? "text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div className="truncate text-lg font-semibold">{children}</div>
      </div>
    </div>
  )
}

interface Props {
  game: Game
  onDeleted: () => void
  onEdit: () => void
}

export function GameInfoPanel({ game, onDeleted, onEdit }: Props) {
  const { launch, launching, stop, continueGame, launchConflict } = useLaunchGame(game)
  const isRunning = useIsGameRunning(game.id)
  const [isFavorite, setIsFavorite] = useState(!!game.is_favorite)
  const [installSize, setInstallSize] = useState<number | null>(null)

  useEffect(() => {
    setInstallSize(null)
    if (!game.install_dir) return
    let cancelled = false
    trackedInvoke<number>("get_install_size", { installDir: game.install_dir })
      .then((size) => {
        if (!cancelled) setInstallSize(size)
      })
      .catch(() => {
        // Folder may no longer exist or be unreadable — just skip the size tile.
      })
    return () => {
      cancelled = true
    }
  }, [game.install_dir])

  async function handleFavorite() {
    const next = !isFavorite
    setIsFavorite(next)
    await toggleFavorite(game.id, next)
  }

  async function handleDelete() {
    await deleteGame(game.id)
    toast.success(`${game.name} removed`)
    onDeleted()
  }

  const genreTags =
    game.genres
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []

  const details = [
    {
      label: game.platform === "emulator" ? "ROM / content" : "Launch arguments",
      value: game.launch_args,
    },
    { label: "Executable", value: game.executable_path },
    { label: "Install folder", value: game.install_dir },
    ...(game.platform === "steam" || game.platform === "epic"
      ? [
          {
            label: game.platform === "steam" ? "Steam app ID" : "Epic app ID",
            value: game.source_id,
          },
        ]
      : []),
  ].filter((d): d is { label: string; value: string } => !!d.value)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,11rem)_1fr] lg:grid-cols-[minmax(0,13rem)_1fr] lg:gap-8">
        <div className="aspect-3/4 w-full max-sm:mx-auto max-sm:max-w-48 overflow-hidden rounded-xl bg-muted shadow-lg shadow-black/40 ring-1 ring-foreground/10">
          {game.cover_url ? (
            <img src={game.cover_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 bg-linear-to-br from-muted to-card px-4 text-center">
              <PlatformIcon
                platform={game.platform}
                className="size-10 text-muted-foreground/60"
              />
              <span className="text-lg font-medium text-muted-foreground">
                {game.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <PlatformIcon platform={game.platform} className="size-4" />
            <span className="capitalize">{game.platform}</span>
            <span aria-hidden="true">&middot;</span>
            <span>Added {formatDate(game.created_at)}</span>
          </div>

          <div>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {game.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {genreTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="h-7 rounded-full px-3 text-sm"
                >
                  {tag}
                </Badge>
              ))}
              {game.run_as_admin ? (
                <Badge
                  variant="outline"
                  className="h-7 gap-1.5 rounded-full px-3 text-sm"
                >
                  <ShieldCheck className="size-3.5" />
                  Admin
                </Badge>
              ) : null}
              {isRunning ? (
                <Badge
                  variant="outline"
                  className="h-7 gap-1.5 rounded-full border-emerald-500/40 px-3 text-sm text-emerald-500"
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Running
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            {isRunning ? (
              <>
                <Button
                  onClick={continueGame}
                  className="h-10 gap-2 px-8"
                >
                  <Play className="size-4" />
                  Continue
                </Button>
                <Button
                  onClick={stop}
                  variant="destructive"
                  className="h-10 gap-2 px-8"
                >
                  <Square className="size-4 fill-current" />
                  Stop
                </Button>
              </>
            ) : (
              <Button
                onClick={launch}
                disabled={launching}
                className="h-10 gap-2 px-8"
              >
                <Play className="size-4" />
                {launching ? "Launching..." : "Play"}
              </Button>
            )}
            <Button
              className="size-10"
              variant="outline"
              size="icon"
              onClick={handleFavorite}
              aria-label="Favorite"
              aria-pressed={isFavorite}
            >
              <Heart
                className={
                  isFavorite ? "size-4 fill-current text-red-500" : "size-4"
                }
              />
            </Button>
            <Button
              className="size-10"
              variant="outline"
              size="icon"
              onClick={onEdit}
              aria-label="Edit"
            >
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Remove"
                    className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  />
                }
              >
                <Trash2 className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {game.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the game from your library. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <LaunchConflictDialog {...launchConflict} />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-3",
          installSize !== null && "lg:grid-cols-4",
        )}
      >
        <StatTile
          icon={Activity}
          label="Status"
          accent={isRunning ? "text-emerald-500" : undefined}
        >
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-500">
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
              Running
            </span>
          ) : (
            "Idle"
          )}
        </StatTile>
        <StatTile icon={Clock3} label="Playtime">
          {formatPlaytime(game.playtime_seconds)}
        </StatTile>
        <StatTile icon={CalendarClock} label="Last played">
          {game.last_played_at ? formatDate(game.last_played_at) : "Never"}
        </StatTile>
        {installSize !== null ? (
          <StatTile icon={HardDrive} label="Size">
            {formatSize(installSize)}
          </StatTile>
        ) : null}
      </div>

      {details.length > 0 ? (
        <section className="rounded-xl bg-card/70 p-5 ring-1 ring-foreground/10 backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Details
          </h2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{d.label}</dt>
                <dd
                  title={d.value}
                  className="ui-selectable truncate font-mono text-sm"
                >
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {game.description ? (
        <section className="rounded-xl bg-card/70 p-5 ring-1 ring-foreground/10 backdrop-blur-sm">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Description
          </h2>
          <p className="ui-selectable max-w-prose text-base leading-relaxed text-muted-foreground">
            {game.description}
          </p>
        </section>
      ) : null}
    </div>
  )
}
