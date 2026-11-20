let audioCtx: AudioContext | null = null
let _soundEnabled = true
let _voiceEnabled = true
let _timingDebug = false

export function setSoundEnabled(v: boolean) { _soundEnabled = v }
export function setVoiceEnabled(v: boolean) { _voiceEnabled = v }
export function setTimingDebug(v: boolean) { _timingDebug = v }

function getCtx(): AudioContext | null {
  if (!_soundEnabled) return null
  if (typeof window === 'undefined') return null
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  // iOS also reports 'interrupted' (calls, Siri, other audio), which isn't in the TS union
  if (audioCtx.state !== 'running' && audioCtx.state !== 'closed') audioCtx.resume().catch(() => {})
  return audioCtx
}

function tone(freq: number, startTime: number, duration: number, vol = 0.4) {
  const ctx = getCtx()
  if (!ctx) return null
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
  return gain
}

export function initAudio() {
  if (!_soundEnabled) return
  getCtx()
}

// Schedules the 3-2-1 beeps before `endAt` (epoch ms) on the audio clock, which is
// sample-accurate and unaffected by a busy main thread or throttled JS timers.
// Waits for a suspended/interrupted context to resume first, so beeps aren't queued
// against a stalled clock. Returns a cancel function.
export function scheduleCountdown(endAt: number): () => void {
  let cancelled = false
  const gains: GainNode[] = []
  const ctx = getCtx()
  if (!ctx) return () => {}

  const run = () => {
    if (cancelled) return
    // Map wall-clock time onto the audio clock at this instant
    const offset = ctx.currentTime - Date.now() / 1000
    const beeps: { at: number; target: number }[] = []
    for (const sec of [3, 2, 1]) {
      const target = endAt - sec * 1000
      const at = target / 1000 + offset
      if (at < ctx.currentTime - 0.05) continue // already passed
      const gain = tone(880, Math.max(at, ctx.currentTime), 0.08, 0.35)
      if (gain) gains.push(gain)
      beeps.push({ at, target })
    }
    if (_timingDebug && beeps.length > 0) measureBeeps(ctx, beeps)
  }

  if (ctx.state === 'running') run()
  else ctx.resume().then(run).catch(() => {})

  return () => {
    cancelled = true
    gains.forEach((g) => g.disconnect())
  }
}

// ── Timing diagnostics ──────────────────────────────────────────────────────

let timingLog: readonly string[] = []
const timingListeners = new Set<() => void>()

export function logTiming(line: string) {
  if (!_timingDebug) return
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  timingLog = [`${t} ${line}`, ...timingLog].slice(0, 8)
  timingListeners.forEach((l) => l())
}

export function getTimingLog(): readonly string[] { return timingLog }

export function subscribeTimingLog(listener: () => void): () => void {
  timingListeners.add(listener)
  return () => { timingListeners.delete(listener) }
}

// After the last beep, ask the audio output when each beep actually played (on the
// wall clock) and log the gaps between them and the worst error vs. the target time.
function measureBeeps(ctx: AudioContext, beeps: { at: number; target: number }[]) {
  const last = beeps[beeps.length - 1]
  setTimeout(() => {
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null
    const hasTs = !!ts?.contextTime && !!ts?.performanceTime
    // Audio-clock time → epoch ms, using the output timestamp when the browser provides it
    const toEpoch = (ctxTime: number) => hasTs
      ? ts!.performanceTime! + (ctxTime - ts!.contextTime!) * 1000 + (Date.now() - performance.now())
      : Date.now() + (ctxTime - ctx.currentTime) * 1000
    const actual = beeps.map((b) => toEpoch(b.at))
    const gaps = actual.slice(1).map((a, i) => Math.round(a - actual[i]))
    const worst = Math.max(...beeps.map((b, i) => Math.abs(actual[i] - b.target)))
    logTiming(`beeps ${gaps.length ? gaps.join(' / ') + ' ms' : '(1 beep)'} · off by ≤${Math.round(worst)} ms · ${ctx.state}`)
  }, Math.max(0, last.target - Date.now()) + 300)
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

export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function speakText(text: string) {
  if (!_voiceEnabled || !_soundEnabled) return
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.volume = 0.9
  utter.rate = 1.1
  window.speechSynthesis.speak(utter)
}
