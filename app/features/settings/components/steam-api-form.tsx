import { useState } from "react"

import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { trackedInvoke } from "~/lib/tauri/tauri"

export const STEAM_API_KEY_SETTING = "steam_web_api_key"
export const STEAM_ID_SETTING = "steam_id64"

function extractSteamId64(value: string): string | null {
  const match = value.match(/steamcommunity\.com\/profiles\/(\d{17})/)
  return match ? match[1] : null
}

function extractVanity(value: string): string | null {
  const match = value.match(/steamcommunity\.com\/id\/([^/]+)/)
  return match ? match[1] : null
}

interface Props {
  apiKey: string
  onApiKeyChange: (value: string) => void
  steamId: string
  onSteamIdChange: (value: string) => void
  disabled?: boolean
}

export function SteamApiForm({
  apiKey,
  onApiKeyChange,
  steamId,
  onSteamIdChange,
  disabled,
}: Props) {
  const [resolving, setResolving] = useState(false)

  async function handleSteamIdChange(value: string) {
    const id64 = extractSteamId64(value)
    if (id64) {
      onSteamIdChange(id64)
      return
    }

    const vanity = extractVanity(value)
    if (vanity && apiKey) {
      onSteamIdChange(value)
      setResolving(true)
      try {
        const resolved = await trackedInvoke<string | null>("resolve_steam_vanity_url", {
          apiKey,
          vanity,
        })
        if (resolved) onSteamIdChange(resolved)
      } finally {
        setResolving(false)
      }
      return
    }

    onSteamIdChange(value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="steam-api-key">Steam Web API key + SteamID64</Label>
      <div className="flex flex-col gap-2">
        <Input
          id="steam-api-key"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="Steam Web API key"
          type="password"
          disabled={disabled}
        />
        <Input
          id="steam-id"
          value={steamId}
          onChange={(e) => handleSteamIdChange(e.target.value)}
          placeholder="SteamID64, profile URL, or /id/ vanity URL"
          disabled={disabled || resolving}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Optional — used to sync real playtime for Steam games when scanning/importing. Get a
        key from{" "}
        <a href="https://steamcommunity.com/dev/apikey" className="underline">
          steamcommunity.com/dev/apikey
        </a>
        . Paste your profile URL (steamcommunity.com/id/... or /profiles/...) and it'll resolve
        automatically.
      </p>
    </div>
  )
}
