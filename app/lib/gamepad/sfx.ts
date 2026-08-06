let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function beep(freq: number, durationMs: number, gainValue = 0.06) {
  const audioCtx = getCtx()
  if (!audioCtx) return

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = "square"
  osc.frequency.value = freq
  gain.gain.value = gainValue

  const now = audioCtx.currentTime
  const end = now + durationMs / 1000
  gain.gain.setValueAtTime(gainValue, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(end)
}

export function playMoveSfx() {
  beep(660, 40)
}

export function playConfirmSfx() {
  beep(880, 60)
}

export function playBackSfx() {
  beep(320, 70)
}

export function playErrorSfx() {
  beep(160, 90, 0.08)
}
