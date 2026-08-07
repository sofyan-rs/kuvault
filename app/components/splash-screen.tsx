import { useEffect, useState } from "react"

const SPLASH_DURATION_MS = 3000
const FADE_OUT_MS = 350

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const start = now + i * 0.09
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })

    setTimeout(() => ctx.close(), 800)
  } catch {
    // audio unsupported, ignore
  }
}

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    playChime()

    const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION_MS)
    const hideTimer = setTimeout(
      () => setVisible(false),
      SPLASH_DURATION_MS + FADE_OUT_MS
    )

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-background transition-opacity duration-350 ease-out"
      style={{ opacity: fadingOut ? 0 : 1 }}
    >
      <div className="flex flex-col items-center gap-6">
        <img
          src="/logo.png"
          alt="KuVault"
          className="animate-splash-logo h-40 w-40"
        />
        <span className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
          <span className="animate-splash-bar block h-full w-1/3 rounded-full bg-primary" />
        </span>
      </div>
    </div>
  )
}
