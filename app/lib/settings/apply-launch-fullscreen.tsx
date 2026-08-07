import { useEffect } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"

import { getLaunchFullscreen } from "./launch-fullscreen"

export function ApplyLaunchFullscreen() {
  useEffect(() => {
    if (getLaunchFullscreen()) {
      getCurrentWindow().setFullscreen(true)
    }
  }, [])

  return null
}
