'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTimer } from '@/hooks/useTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { initAudio, setSoundEnabled } from '@/lib/audio'
import { formatDuration } from '@/lib/workoutUtils'
import { haptic } from '@/lib/haptics'
import { useWorkoutStore } from '@/store/workoutStore'
import type { Workout, Phase } from '@/types/workout'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const RADIUS = 80
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const OUTER_RADIUS = 92
const OUTER_CIRCUMFERENCE = 2 * Math.PI * OUTER_RADIUS

interface Props {
  workout: Workout
}

export function TimerDisplay({ workout }: Props) {
  const router = useRouter()
  const timer = useTimer(workout)
  useWakeLock(timer.isRunning)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const { soundEnabled, setSoundEnabled: storeSoundEnabled, recordSession } = useWorkoutStore()
  const sessionRecorded = useRef(false)
  const autoStartFired = useRef(false)

  const accentColor = workout.accentColor ?? '#f0407a'

  const PHASE_CONFIG: Record<Phase, { color: string; label: string }> = {
    idle:     { color: '#4b5a70', label: 'Ready' },
    warmup:   { color: '#4e8fff', label: 'Get Ready' },
    work:     { color: accentColor, label: 'Work' },
    rest:     { color: '#00d9a0', label: 'Rest' },
    break:    { color: '#4e8fff', label: 'Break' },
    cooldown: { color: '#a87dff', label: 'Cool Down' },
    complete: { color: '#fbbf24', label: 'Done' },
  }

  useEffect(() => { setSoundEnabled(soundEnabled) }, [soundEnabled])

  useEffect(() => {
    if (workout.autoStart && !autoStartFired.current) {
      autoStartFired.current = true
      initAudio()
      timer.start()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timer.isComplete && !sessionRecorded.current) {
      sessionRecorded.current = true
      const total = timer.segments.reduce((s, seg) => s + seg.duration, 0)
      recordSession({ workoutId: workout.id, workoutName: workout.name, date: Date.now(), durationSeconds: total })
    }
  }, [timer.isComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const { color, label } = PHASE_CONFIG[timer.phase]

  const handleToggle = () => { initAudio(); haptic('tap'); timer.toggle() }
  const toggleSound = () => storeSoundEnabled(!soundEnabled)
  const handleSkipNext = () => { haptic('tap'); timer.skipToNext() }
  const handleSkipPrev = () => { haptic('tap'); timer.skipToPrev() }
  const handleQuit = () => { timer.reset(); router.push('/') }

  const isSkippable = timer.phase === 'rest' || timer.phase === 'break'

  const ringProgress = timer.isComplete ? 0 : timer.totalTime > 0 ? 1 - timer.timeRemaining / timer.totalTime : 0
  const dashOffset = CIRCUMFERENCE * ringProgress
  const segsBefore = timer.segments.slice(0, timer.segmentIndex)
  const elapsed = segsBefore.reduce((s, seg) => s + seg.duration, 0) +
    ((timer.segments[timer.segmentIndex]?.duration ?? 0) - timer.timeRemaining)
  const segsAfter = timer.segments.slice(timer.segmentIndex + 1)
  const workoutRemaining = timer.isComplete ? 0 : timer.timeRemaining + segsAfter.reduce((s, seg) => s + seg.duration, 0)
  const totalWorkoutDuration = timer.segments.reduce((s, seg) => s + seg.duration, 0)
  const overallProgress = timer.isComplete ? 1 : totalWorkoutDuration > 0 ? elapsed / totalWorkoutDuration : 0
  const outerDashOffset = OUTER_CIRCUMFERENCE * (1 - overallProgress)
  const showCounters = timer.currentRound > 0 && !timer.isComplete && timer.phase !== 'warmup' && timer.phase !== 'cooldown'

  // Completion stats
  const allSegsDur = timer.segments.reduce((s, seg) => s + seg.duration, 0)
  const workSegs = timer.segments.filter((s) => s.phase === 'work')
  const totalWorkDur = workSegs.reduce((s, seg) => s + seg.duration, 0)
  const completionExCount = workout.type === 'circuit'
    ? (workout.exerciseGroups ?? []).flatMap((g) => g.exercises ?? []).length
    : workSegs.length
  const completionStatLabel = workout.type === 'circuit' ? 'Exercises' : 'Intervals'

  // Circuit exercise list
  const currentGroupExercises = workout.type === 'circuit'
    ? (workout.exerciseGroups ?? [])[timer.currentGroup - 1]?.exercises ?? []
    : []

  const activeRing = (
    <div
      className="relative flex items-center justify-center"
      onClick={isSkippable ? handleSkipNext : undefined}
      style={{ cursor: isSkippable ? 'pointer' : 'default' }}
    >
      <svg viewBox="0 0 200 200" className="w-[82vw] max-w-[340px] @[600px]:w-[min(52vh,360px)] @[600px]:max-w-none">
        <circle cx="100" cy="100" r={OUTER_RADIUS} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
        <circle cx="100" cy="100" r={OUTER_RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray={OUTER_CIRCUMFERENCE} strokeDashoffset={outerDashOffset}
          transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset} transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 9px ${color}cc)` }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p key={timer.timeRemaining} className="text-white font-light tabular-nums"
          style={{ fontSize: 'clamp(34px, 10.5vw, 52px)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', animation: 'timeStep 0.22s ease-out' }}>
          {formatTime(timer.timeRemaining)}
        </p>
      </div>
    </div>
  )

  const completeRing = (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-[82vw] max-w-[340px] @[600px]:w-[min(52vh,360px)] @[600px]:max-w-none">
        <circle cx="100" cy="100" r={OUTER_RADIUS} fill="none" stroke="rgba(251,191,36,0.08)" strokeWidth="2.5" />
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(251,191,36,0.12)" strokeWidth="10" />
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="#fbbf24" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={0} transform="rotate(-90 100 100)"
          style={{ filter: 'drop-shadow(0 0 14px rgba(251,191,36,0.65))' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.7))' }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  )

  return (
    <div className="@container flex flex-col h-[100dvh] select-none relative overflow-hidden" style={{ backgroundColor: '#12121a' }}>

      {/* Ambient phase glow — fills top of screen in current phase color */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: timer.isComplete
            ? 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(251,191,36,0.12) 0%, transparent 70%)'
            : `radial-gradient(ellipse 100% 50% at 50% 0%, ${color}18 0%, transparent 68%)`,
          transition: 'background 0.8s ease',
          zIndex: 0,
        }}
      />

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-5 @[600px]:px-8 relative z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 18px)', paddingBottom: 10 }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQuitConfirm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-90"
            style={{ backgroundColor: 'rgba(239,68,68,0.14)' }} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.8)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button onClick={toggleSound}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-90"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} aria-label={soundEnabled ? 'Mute' : 'Unmute'}>
            {soundEnabled ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
        </div>
        <span className="text-white/30 text-sm truncate max-w-[160px] @[600px]:max-w-xs">{workout.name}</span>
        <div className="min-w-[48px] flex flex-col items-end gap-1">
          {showCounters && workout.type === 'circuit' && timer.totalGroups > 1 && (
            <span className="text-white/55 text-sm font-semibold tabular-nums leading-tight">{timer.currentGroup}/{timer.totalGroups}</span>
          )}
          {showCounters && (
            <span
              className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}28`, color }}
            >
              {timer.currentRound}/{timer.totalRounds}
            </span>
          )}
        </div>
      </div>

      {/* Main: single column → two column at 600px container width */}
      <div className="flex-1 min-h-0 flex flex-col @[600px]:flex-row relative z-10">

        {/* Ring — flex-1 so it expands to fill available space, ring centers within */}
        <div className="flex-1 flex items-center justify-start pt-6 px-6 @[600px]:justify-center @[600px]:pt-0">
          {timer.isComplete ? completeRing : activeRing}
        </div>

        {/* Phase info + controls — shrink-0 so they pin to the bottom */}
        <div className="shrink-0 flex flex-col @[600px]:flex-1 @[600px]:justify-center">

          {/* Info */}
          <div className="text-center @[600px]:text-left px-6 @[600px]:px-10 mb-8 @[600px]:mb-6">
            {timer.isComplete ? (
              <>
                <p className="text-white font-bold text-2xl mb-1">Workout complete!</p>
                <p className="text-white/35 text-sm mb-5 truncate">{workout.name}</p>
                <div className="grid grid-cols-2 gap-2.5 @[600px]:justify-start">
                  {[
                    { label: 'Duration', value: formatDuration(allSegsDur) },
                    { label: 'Active work', value: formatDuration(totalWorkDur) },
                    { label: 'Rounds', value: String(timer.totalRounds) },
                    { label: completionStatLabel, value: String(completionExCount) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center px-3 py-3 rounded-2xl"
                      style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.13)' }}>
                      <span className="text-white font-bold text-lg tabular-nums">{value}</span>
                      <span className="text-white/40 text-[11px] mt-0.5 uppercase tracking-wide">{label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase mb-2 transition-colors duration-500" style={{ color }}>{label}</p>

                {timer.phase === 'work' && workout.type === 'circuit' ? (
                  <p className="text-white text-3xl font-semibold leading-snug">{timer.exerciseName}</p>
                ) : timer.phase === 'work' ? (
                  <p className="text-white/40 text-base font-light">{showCounters ? `Round ${timer.currentRound} of ${timer.totalRounds}` : 'Interval'}</p>
                ) : timer.phase === 'rest' ? (
                  <p className="text-white/40 text-base font-light">{showCounters ? `Round ${timer.currentRound} of ${timer.totalRounds}` : 'Recover'}</p>
                ) : null}

                {/* Circuit exercise list */}
                {workout.type === 'circuit' && currentGroupExercises.length > 1 && (
                  <div className="mt-3 flex flex-col gap-0.5 @[600px]:text-left">
                    {currentGroupExercises.map((ex, i) => {
                      const isCurrent = i === timer.exerciseIndex && timer.phase === 'work'
                      const isDone = i < timer.exerciseIndex || (i === timer.exerciseIndex && timer.phase === 'rest')
                      return (
                        <div key={ex.id} className="flex items-center gap-2 py-0.5 px-2 rounded-lg -mx-2 transition-colors"
                          style={{ backgroundColor: isCurrent ? `${accentColor}18` : 'transparent' }}>
                          <div className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                            style={{ backgroundColor: isCurrent ? accentColor : isDone ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)' }} />
                          <span className="text-sm transition-colors truncate"
                            style={{ color: isCurrent ? 'rgba(255,255,255,0.9)' : isDone ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)' }}>
                            {ex.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Next up */}
                {!(workout.type === 'circuit' && currentGroupExercises.length > 1) && timer.segmentIndex < timer.segments.length - 1 && (
                  <p className="text-white/35 text-xs mt-2">
                    Next — <span className="text-white/55">{timer.segments[timer.segmentIndex + 1].label} · {formatTime(timer.segments[timer.segmentIndex + 1].duration)}</span>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Controls */}
          <div className="shrink-0 px-6 @[600px]:px-10"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}>
            {timer.isComplete ? (
              <div className="flex gap-3">
                <button onClick={timer.reset}
                  className="flex-1 py-4 rounded-2xl text-white/55 font-medium text-sm border border-white/10 transition-colors hover:border-white/20">
                  Restart
                </button>
                <button onClick={() => router.push('/')}
                  className="flex-1 py-4 rounded-2xl font-semibold text-sm transition-colors"
                  style={{ backgroundColor: '#fbbf24', color: '#0a0a14', boxShadow: '0 6px 24px rgba(251,191,36,0.45)' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-12 mb-5">
                  <button onClick={handleSkipPrev} className="transition-all active:scale-90" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
                  </button>
                  <button onClick={handleToggle}
                    className={`rounded-full flex items-center justify-center transition-all active:scale-95${timer.phase === 'idle' ? ' animate-pulse' : ''}`}
                    style={{
                      backgroundColor: color,
                      width: 70, height: 70,
                      boxShadow: `0 0 32px ${color}70`,
                    }}>
                    {timer.isRunning ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#0a0a14">
                        <rect x="5" y="4" width="4" height="16" rx="1.5" /><rect x="15" y="4" width="4" height="16" rx="1.5" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#0a0a14"><path d="M6 4l14 8-14 8V4z" /></svg>
                    )}
                  </button>
                  <button onClick={handleSkipNext} className="transition-all active:scale-90" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" /></svg>
                  </button>
                </div>

                {/* Progress bar footer */}
                <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-white/30 text-xs tabular-nums shrink-0 w-10">{formatTime(elapsed)}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${overallProgress * 100}%`,
                        backgroundColor: color,
                        transition: 'width 1s linear, background-color 0.5s ease',
                      }}
                    />
                  </div>
                  <span className="text-white/30 text-xs tabular-nums shrink-0 w-10 text-right">{formatTime(workoutRemaining)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quit confirm sheet */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={() => setShowQuitConfirm(false)}>
          <div className="w-full rounded-t-3xl px-6 pt-5" style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <p className="text-white text-lg font-semibold text-center mb-1">Quit workout?</p>
            <p className="text-white/35 text-sm text-center mb-6">Your progress will be lost.</p>
            <button onClick={handleQuit} className="w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-98" style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#f87171' }}>Quit</button>
            <button onClick={() => setShowQuitConfirm(false)} className="w-full py-3 text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>Continue workout</button>
          </div>
        </div>
      )}
    </div>
  )
}
