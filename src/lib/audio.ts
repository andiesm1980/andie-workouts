let audioCtx: AudioContext | null = null
let _soundEnabled = true

export function setSoundEnabled(v: boolean) { _soundEnabled = v }

function getCtx(): AudioContext | null {
  if (!_soundEnabled) return null
  if (typeof window === 'undefined') return null
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function tone(freq: number, startTime: number, duration: number, vol = 0.4) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(freq, startTime)
  osc.type = 'sine'
  gain.gain.setValueAtTime(vol, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function initAudio() {
  if (!_soundEnabled) return
  getCtx()
}

export function playCountdownBeep() {
  const ctx = getCtx()
  if (!ctx) return
  tone(880, ctx.currentTime, 0.08, 0.35)
}

export function playPhaseStart() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  tone(659, now, 0.15, 0.5)
  tone(880, now + 0.15, 0.25, 0.5)
}

export function playComplete() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  tone(523, now, 0.3, 0.4)
  tone(659, now + 0.15, 0.3, 0.4)
  tone(784, now + 0.3, 0.3, 0.4)
  tone(1047, now + 0.45, 0.6, 0.4)
}
