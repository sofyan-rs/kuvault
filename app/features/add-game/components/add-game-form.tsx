import { useState } from "react"
import { useNavigate } from "react-router"
import { open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
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

  const [name, setName] = useState(game?.name ?? "")
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? "manual")
  const [executablePath, setExecutablePath] = useState(
    game?.executable_path ?? ""
  )
  const [launchArgs, setLaunchArgs] = useState(game?.launch_args ?? "")
  const [genres, setGenres] = useState(game?.genres ?? "")
  const [description, setDescription] = useState(game?.description ?? "")
  const [coverUrl, setCoverUrl] = useState<string | null>(
    game?.cover_url ?? null
  )
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
      if (!name) {
        const fileName = path.split(/[\\/]/).pop() ?? ""
        setName(fileName.replace(/\.exe$/i, ""))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !executablePath.trim()) {
      setError("Name and executable path are required")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const patch = {
        name: name.trim(),
        platform,
        executable_path: executablePath.trim(),
        launch_args: launchArgs.trim() || undefined,
        genres: genres.trim() || undefined,
        description: description.trim() || undefined,
        cover_url: coverUrl ?? undefined,
      }

      if (game) {
        await updateGame(game.id, patch)
        toast.success(`${patch.name} updated`)
        if (onSaved) onSaved(game.id)
        else navigate(`/games/${game.id}`)
      } else {
        const id = await addGame(patch)
        toast.success(`${patch.name} added to library`)
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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

      {platform === "emulator" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="launch-args">ROM path (launch argument)</Label>
          <Input
            id="launch-args"
            value={launchArgs}
            onChange={(e) => setLaunchArgs(e.target.value)}
            placeholder="C:\ROMs\game.gba"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>Cover art</Label>
        <CoverPicker
          defaultQuery={name}
          coverUrl={coverUrl}
          onSelect={setCoverUrl}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="genres">Categories</Label>
        <Input
          id="genres"
          value={genres}
          onChange={(e) => setGenres(e.target.value)}
          placeholder="Open-world, Emulation, Racing, etc."
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated, any custom tags you like.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
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
