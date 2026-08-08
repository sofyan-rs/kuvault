import { invoke } from "@tauri-apps/api/core"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"

export type UpdateDownloadProgress = {
  downloaded: number
  total: number | null
}

/** Returns the pending Update if one is available, else null. Never throws. */
export async function checkForUpdate(): Promise<Update | null> {
  try {
    return await check()
  } catch (error) {
    console.error("[updater] check failed", error)
    return null
  }
}

export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (progress: UpdateDownloadProgress) => void,
) {
  let downloaded = 0
  let total: number | null = null

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? null
        onProgress?.({ downloaded: 0, total })
        break
      case "Progress":
        downloaded += event.data.chunkLength
        onProgress?.({ downloaded, total })
        break
    }
  })

  await relaunch()
}

/**
 * Portable installs run from an arbitrary directory with no uninstall registry key.
 * Installed (NSIS) builds always write `Software\KuVault` under `HKCU\...\Uninstall`,
 * so its absence means we're running the raw portable exe — OTA can't apply there.
 */
export async function isPortableInstall(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_portable_install")
  } catch {
    return false
  }
}
