"use client"

import { useEffect } from "react"

export function ContextMenuGuard() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      return
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault()
    }

    document.addEventListener("contextmenu", handleContextMenu)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [])

  return null
}
