import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { ArrowLeft } from "lucide-react"

import { Button } from "~/components/ui/button"
import { EditGameDialog } from "~/features/add-game/components/edit-game-dialog"
import { GameInfoPanel } from "~/features/game-detail/components/game-info-panel"
import { useGame } from "~/features/game-detail/hooks/use-game"
import { useIsGamepadConnected } from "~/lib/gamepad/gamepad-navigation-provider"
import { useOnLaunchFinished } from "~/lib/tauri/running-games"
import { cn } from "~/lib/utils"

export default function GameDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { game, loading, refresh } = useGame(Number(id))
  const [editOpen, setEditOpen] = useState(false)
  const gamepadConnected = useIsGamepadConnected()
  useOnLaunchFinished(refresh)

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  }

  if (!game) {
    return <p className="p-6 text-sm text-muted-foreground">Game not found.</p>
  }

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-128 overflow-hidden">
        {game.cover_url ? (
          <>
            <img
              src={game.cover_url}
              alt=""
              className="size-full scale-125 object-cover opacity-60 blur-3xl"
            />
            <div className="absolute inset-0 bg-linear-to-b from-background/50 via-background/80 to-background" />
          </>
        ) : (
          <div className="size-full bg-linear-to-b from-primary/15 via-primary/5 to-transparent" />
        )}
      </div>

      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-6 pt-4 pb-12 lg:px-8",
          gamepadConnected && "pb-24",
        )}
      >
        <Button
          variant="ghost"
          className="mb-5 -ml-2 h-10 gap-2 px-4 text-base"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-5" />
          Back
        </Button>
        <GameInfoPanel
          game={game}
          onDeleted={() => navigate(-1)}
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
