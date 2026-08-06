import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

export const STEAM_API_KEY_SETTING = "steam_web_api_key"
export const STEAM_ID_SETTING = "steam_id64"

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
          onChange={(e) => onSteamIdChange(e.target.value)}
          placeholder="SteamID64 (e.g. 7656119...)"
          disabled={disabled}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Optional — used to sync real playtime for Steam games when scanning/importing. Get a
        key from{" "}
        <a href="https://steamcommunity.com/dev/apikey" className="underline">
          steamcommunity.com/dev/apikey
        </a>
        , find your SteamID64 via{" "}
        <a href="https://steamid.io" className="underline">
          steamid.io
        </a>
        .
      </p>
    </div>
  )
}
