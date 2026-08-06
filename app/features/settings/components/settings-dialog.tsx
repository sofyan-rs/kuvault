import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { getSetting, setSetting } from "~/lib/db"

import { STEAM_API_KEY_SETTING, STEAM_ID_SETTING, SteamApiForm } from "./steam-api-form"
import { STEAMGRIDDB_KEY_SETTING, SteamGridDbKeyForm } from "./steamgriddb-key-form"
import { ThemeSelect } from "./theme-select"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [gridDbKey, setGridDbKey] = useState("")
  const [steamApiKey, setSteamApiKey] = useState("")
  const [steamId, setSteamId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getSetting(STEAMGRIDDB_KEY_SETTING),
      getSetting(STEAM_API_KEY_SETTING),
      getSetting(STEAM_ID_SETTING),
    ]).then(([gridDb, api, id]) => {
      setGridDbKey(gridDb ?? "")
      setSteamApiKey(api ?? "")
      setSteamId(id ?? "")
      setLoading(false)
    })
  }, [open])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        setSetting(STEAMGRIDDB_KEY_SETTING, gridDbKey.trim()),
        setSetting(STEAM_API_KEY_SETTING, steamApiKey.trim()),
        setSetting(STEAM_ID_SETTING, steamId.trim()),
      ])
      toast.success("Settings saved")
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <ThemeSelect />
          <SteamGridDbKeyForm value={gridDbKey} onChange={setGridDbKey} disabled={loading} />
          <SteamApiForm
            apiKey={steamApiKey}
            onApiKeyChange={setSteamApiKey}
            steamId={steamId}
            onSteamIdChange={setSteamId}
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
