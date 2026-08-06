import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import type { Game } from "~/lib/db-types"

import { AddGameForm } from "./add-game-form"

interface Props {
  game: Game
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EditGameDialog({ game, open, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Game</DialogTitle>
        </DialogHeader>
        <AddGameForm
          game={game}
          onSaved={() => {
            onOpenChange(false)
            onSaved()
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
