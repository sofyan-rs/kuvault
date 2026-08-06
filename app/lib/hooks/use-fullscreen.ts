import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const appWindow = getCurrentWindow()
    appWindow.isFullscreen().then(setIsFullscreen)

    const unlisten = appWindow.onResized(() => {
      appWindow.isFullscreen().then(setIsFullscreen)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  async function toggleFullscreen() {
    const appWindow = getCurrentWindow()
    await appWindow.setFullscreen(!isFullscreen)
    setIsFullscreen(!isFullscreen)
  }

  return { isFullscreen, toggleFullscreen }
}
