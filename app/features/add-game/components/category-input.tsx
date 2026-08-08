import { useEffect, useMemo, useRef, useState } from "react"
import { XIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/utils"
import { listGames } from "~/lib/db/db"

interface Props {
  value: string
  onChange: (value: string) => void
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

export function CategoryInput({ value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const tags = useMemo(() => parseTags(value), [value])

  useEffect(() => {
    listGames()
      .then((games) => {
        const set = new Set<string>()
        for (const g of games) {
          if (!g.genres) continue
          for (const t of parseTags(g.genres)) set.add(t)
        }
        setSuggestions(Array.from(set).sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue("")
      return
    }
    onChange([...tags, trimmed].join(", "))
    setInputValue("")
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag).join(", "))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !tags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
      s.toLowerCase().includes(inputValue.trim().toLowerCase())
  )

  const showCreateOption =
    inputValue.trim().length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === inputValue.trim().toLowerCase()) &&
    !tags.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase())

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        onClick={() => setOpen(true)}
      >
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              className="rounded-full hover:text-destructive"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={tags.length === 0 ? "Open-world, Emulation, Racing, etc." : undefined}
          className="min-w-24 flex-1 appearance-none border-0 bg-transparent text-sm outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground"
          style={{ outline: "none", boxShadow: "none" }}
        />
      </div>

      {open && (filteredSuggestions.length > 0 || showCreateOption) ? (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {s}
            </button>
          ))}
          {showCreateOption ? (
            <button
              type="button"
              onClick={() => addTag(inputValue)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                filteredSuggestions.length > 0 && "border-t border-border"
              )}
            >
              Create "{inputValue.trim()}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
