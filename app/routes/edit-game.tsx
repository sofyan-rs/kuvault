import { useParams } from "react-router"

import { AddGameForm } from "~/features/add-game/components/add-game-form"
import { useGame } from "~/features/game-detail/hooks/use-game"

export default function EditGame() {
  const { id } = useParams()
  const { game, loading } = useGame(Number(id))

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  }

  if (!game) {
    return <p className="p-6 text-sm text-muted-foreground">Game not found.</p>
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Edit Game</h1>
      <AddGameForm game={game} />
    </div>
  )
}
