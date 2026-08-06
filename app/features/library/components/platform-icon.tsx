import type { Platform } from "../types"

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.6 2 2.2 6.2 2 11.5l5.4 2.2a2.9 2.9 0 0 1 1.6-.5l2.4-3.5v-.1a3.7 3.7 0 1 1 3.7 3.7h-.1l-3.4 2.4a2.9 2.9 0 0 1-2.9 2.8 2.9 2.9 0 0 1-2.9-2.6L2 14.4C2.9 18.8 6.9 22 11.6 22 17.4 22 22 17.5 22 12S17.4 2 12 2Zm-2.6 15-1.2-.5A2.2 2.2 0 0 0 10 15l1.1.4a1.6 1.6 0 0 1-.2 1.1 1.7 1.7 0 0 1-1.5.5ZM15 11.6a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm0-4.1a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z" />
    </svg>
  )
}

function EpicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 3h16a1 1 0 0 1 1 1v13.2a1 1 0 0 1-.4.8l-7.4 5.5a1 1 0 0 1-1.2 0L4.4 18a1 1 0 0 1-.4-.8V4a1 1 0 0 1 1-1Zm2 2v11.2l6 4.4 6-4.4V5H6Zm2 2h8v2H9.5v1.8H15v2H9.5V15H16v2H8V7Z" />
    </svg>
  )
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  if (platform === "steam") return <SteamIcon className={className} />
  if (platform === "epic") return <EpicIcon className={className} />
  return null
}
