import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

export const STEAMGRIDDB_KEY_SETTING = "steamgriddb_api_key"

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function SteamGridDbKeyForm({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="steamgriddb-key">SteamGridDB API key</Label>
      <Input
        id="steamgriddb-key"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your API key"
        type="password"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        Get a free key from your{" "}
        <a href="https://www.steamgriddb.com/profile/preferences/api" className="underline">
          SteamGridDB account preferences
        </a>
        . Used to fetch cover art.
      </p>
    </div>
  )
}
