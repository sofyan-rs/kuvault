import { useState } from "react"
import { useNavigate } from "react-router"
import { open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { DialogFooter } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { addGame, updateGame } from "~/lib/db/db"
import type { Game, Platform } from "~/lib/db/db-types"

import { CategoryInput } from "./category-input"
import { CoverPicker } from "./cover-picker"

const PLATFORM_LABELS: Record<"manual" | "emulator", string> = {
  manual: "Manual / Installer",
  emulator: "Emulator",
}

interface Props {
  game?: Game
  onSaved?: (id: number) => void
  onCancel?: () => void
}

export function AddGameForm({ game, onSaved, onCancel }: Props) {
  const navigate = useNavigate()
  const isEditing = Boolean(game)
  const isScanned = game?.platform === "steam" || game?.platform === "epic"

  const [title, setTitle] = useState(game?.title ?? "")
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? "manual")
  const [executablePath, setExecutablePath] = useState(
    game?.executable_path ?? ""
  )
  const initialArgs = game?.launch_args ?? ""
  const initialMatch = initialArgs.match(/^(.*?)\s*"([^"]+)"\s*$/)
  const [launchArgs, setLaunchArgs] = useState(
    initialMatch ? initialMatch[1] : initialArgs
  )
  const [romPath, setRomPath] = useState(initialMatch ? initialMatch[2] : "")
  const [installDir, setInstallDir] = useState(game?.install_dir ?? "")
  const [genres, setGenres] = useState(game?.genres ?? "")
  const [description, setDescription] = useState(game?.description ?? "")
  const [coverUrl, setCoverUrl] = useState<string | null>(
    game?.cover_url ?? null
  )
  const [runAsAdmin, setRunAsAdmin] = useState(game?.run_as_admin === 1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickExecutable() {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Executable", extensions: ["exe"] }],
    })
    if (typeof path === "string") {
      setExecutablePath(path)
      if (!title) {
        const fileName = path.split(/[\\/]/).pop() ?? ""
        setTitle(fileName.replace(/\.exe$/i, ""))
      }
      if (!installDir) {
        const dir = path.slice(
          0,
          Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"))
        )
        if (dir) setInstallDir(dir)
      }
    }
  }

  async function pickInstallDir() {
    const path = await open({ multiple: false, directory: true })
    if (typeof path === "string") setInstallDir(path)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !executablePath.trim()) {
      setError("Name and executable path are required")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const combinedArgs =
        platform === "emulator"
          ? [launchArgs.trim(), romPath.trim() ? `"${romPath.trim()}"` : ""]
              .filter(Boolean)
              .join(" ")
          : launchArgs.trim()

      const patch = {
        title: title.trim(),
        platform,
        executable_path: executablePath.trim(),
        launch_args: combinedArgs || undefined,
        install_dir: installDir.trim() || undefined,
        genres: genres.trim() || undefined,
        description: description.trim() || undefined,
        cover_url: coverUrl ?? undefined,
        run_as_admin: runAsAdmin ? 1 : 0,
      }

      if (game) {
        await updateGame(game.id, patch)
        toast.success(`${patch.title} updated`)
        if (onSaved) onSaved(game.id)
        else navigate(`/games/${game.id}`)
      } else {
        const id = await addGame(patch)
        toast.success(`${patch.title} added to library`)
        if (onSaved && id) onSaved(id)
        else if (!onSaved) navigate(id ? `/games/${id}` : "/")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save game"
      setError(message)
      toast.error(message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="executable">Executable</Label>
        {isScanned ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm text-muted-foreground">
              {executablePath}
            </code>
            <Badge variant="outline" className="capitalize">
              {platform}
            </Badge>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="executable"
              value={executablePath}
              onChange={(e) => setExecutablePath(e.target.value)}
              placeholder="C:\Games\MyGame\game.exe"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={pickExecutable}>
              Browse
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="run-as-admin"
          checked={runAsAdmin}
          onCheckedChange={(checked) => setRunAsAdmin(checked === true)}
        />
        <Label htmlFor="run-as-admin">Run as administrator</Label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Game Title"
          required
        />
      </div>

      {!isScanned ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platform">Platform</Label>
          <Select
            value={platform}
            onValueChange={(v) => setPlatform(v as Platform)}
          >
            <SelectTrigger id="platform">
              <SelectValue>
                {(value: "manual" | "emulator") => PLATFORM_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual / Installer</SelectItem>
              <SelectItem value="emulator">Emulator</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {!isScanned ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="launch-args">Launch arguments (optional)</Label>
          <Input
            id="launch-args"
            value={launchArgs}
            onChange={(e) => setLaunchArgs(e.target.value)}
            placeholder={
              platform === "emulator"
                ? "--fullscreen"
                : '--launch "E:\\Games\\...\\P3R.exe"'
            }
          />
        </div>
      ) : null}

      {!isScanned && platform === "emulator" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rom-path">ROM path</Label>
          <div className="flex gap-2">
            <Input
              id="rom-path"
              value={romPath}
              onChange={(e) => setRomPath(e.target.value)}
              placeholder="E:\Games\ROMs\game.nsp"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const path = await open({ multiple: false, directory: false })
                if (typeof path === "string") setRomPath(path)
              }}
            >
              Browse
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="install-dir">Install directory (optional)</Label>
        <div className="flex gap-2">
          <Input
            id="install-dir"
            value={installDir}
            onChange={(e) => setInstallDir(e.target.value)}
            placeholder="C:\Games\MyGame"
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={pickInstallDir}>
            Browse
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Used to detect the game as running when launched through a mod loader
          or other wrapper — set this to the folder containing the actual game
          exe.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Cover art</Label>
        <CoverPicker
          defaultQuery={title}
          coverUrl={coverUrl}
          onSelect={setCoverUrl}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="genres">Categories</Label>
        <CategoryInput value={genres} onChange={setGenres} />
        <p className="text-xs text-muted-foreground">
          Pick existing tags or type to create new ones.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Game description"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Game"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (onCancel) onCancel()
            else navigate(game ? `/games/${game.id}` : "/")
          }}
        >
          Cancel
        </Button>
      </DialogFooter>
    </form>
  )
}
