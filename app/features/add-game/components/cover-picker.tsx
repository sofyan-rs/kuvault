import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/utils"

import { useSteamGridDbSearch } from "../hooks/use-steamgriddb-search"

interface Props {
  defaultQuery: string
  coverUrl: string | null
  onSelect: (url: string | null) => void
}

export function CoverPicker({ defaultQuery, coverUrl, onSelect }: Props) {
  const [query, setQuery] = useState(defaultQuery)
  const { results, loading, error, search } = useSteamGridDbSearch()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cover art..."
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={() => search(query)} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {results.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {results.slice(0, 12).map((cover) => (
            <button
              key={cover.url}
              type="button"
              onClick={() => onSelect(coverUrl === cover.thumb_url ? null : cover.thumb_url)}
              className={cn(
                "aspect-3/4 overflow-hidden rounded-md ring-2 ring-transparent",
                coverUrl === cover.thumb_url && "ring-ring",
              )}
            >
              <img src={cover.thumb_url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
