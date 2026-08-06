import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { ArrowLeft } from "lucide-react"

import { Button } from "~/components/ui/button"
import { EditGameDialog } from "~/features/add-game/components/edit-game-dialog"
import { GameInfoPanel } from "~/features/game-detail/components/game-info-panel"
import { useGame } from "~/features/game-detail/hooks/use-game"

export default function GameDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { game, loading, refresh } = useGame(Number(id))
  const [editOpen, setEditOpen] = useState(false)

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  }

  if (!game) {
    return <p className="p-6 text-sm text-muted-foreground">Game not found.</p>
  }

  return (
    <div className="relative min-h-svh">
      {game.cover_url ? (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src={game.cover_url}
            alt=""
            className="size-full scale-110 object-cover blur-2xl"
          />
          <div className="absolute inset-0 bg-background/80" />
          <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background" />
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 h-auto gap-1.5 px-3 py-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-5" />
          Back
        </Button>
        <GameInfoPanel
          game={game}
          onChange={refresh}
          onDeleted={() => navigate("/")}
          onEdit={() => setEditOpen(true)}
        />
      </div>

      <EditGameDialog
        game={game}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={refresh}
      />
    </div>
  )
}
