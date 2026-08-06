import { useNavigate } from "react-router"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

import { AddGameForm } from "./add-game-form"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

export function AddGameDialog({ open, onOpenChange, onAdded }: Props) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Game</DialogTitle>
        </DialogHeader>
        <AddGameForm
          onSaved={(id) => {
            onOpenChange(false)
            onAdded()
            navigate(`/games/${id}`)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
