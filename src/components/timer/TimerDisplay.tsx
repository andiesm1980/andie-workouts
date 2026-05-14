'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTimer } from '@/hooks/useTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { initAudio, setSoundEnabled } from '@/lib/audio'
import { haptic } from '@/lib/haptics'
import { useWorkoutStore } from '@/store/workoutStore'
import type { Workout, Phase } from '@/types/workout'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const PHASE_CONFIG: Record<Phase, { color: string; label: string }> = {
  idle:     { color: '#4b5a70', label: 'Ready' },
  warmup:   { color: '#4e8fff', label: 'Get Ready' },
  work:     { color: '#f0407a', label: 'Work' },
  rest:     { color: '#00d9a0', label: 'Rest' },
  break:    { color: '#4e8fff', label: 'Break' },
  cooldown: { color: '#a87dff', label: 'Cool Down' },
  complete: { color: '#ffcb38', label: 'Done' },
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

  // Sync sound flag into audio module
  useEffect(() => { setSoundEnabled(soundEnabled) }, [soundEnabled])

  // Record session once when complete
  useEffect(() => {
    if (timer.isComplete && !sessionRecorded.current) {
      sessionRecorded.current = true
      const total = timer.segments.reduce((s, seg) => s + seg.duration, 0)
      recordSession({ workoutId: workout.id, workoutName: workout.name, date: Date.now(), durationSeconds: total })
    }
  }, [timer.isComplete])

  const { color, label } = PHASE_CONFIG[timer.phase]

  const handleToggle = () => {
    initAudio()
    haptic('tap')
    timer.toggle()
  }

  const toggleSound = () => storeSoundEnabled(!soundEnabled)

  const handleSkipNext = () => {
    haptic('tap')
    if (workout.type === 'circuit') timer.skipToNextExercise()
    else timer.skipToNext()
  }

  const handleSkipPrev = () => {
    haptic('tap')
    timer.skipToPrev()
  }

  const handleQuit = () => {
    timer.reset()
    router.push('/')
  }

  // Ring: drains from full → empty as time elapses, fills to full on complete
  const ringProgress = timer.isComplete
    ? 0
    : timer.totalTime > 0 ? 1 - timer.timeRemaining / timer.totalTime : 0
  const dashOffset = CIRCUMFERENCE * ringProgress

  // Bottom bar times + overall progress
  const segsBefore = timer.segments.slice(0, timer.segmentIndex)
  const elapsed = segsBefore.reduce((s, seg) => s + seg.duration, 0) +
    ((timer.segments[timer.segmentIndex]?.duration ?? 0) - timer.timeRemaining)
  const segsAfter = timer.segments.slice(timer.segmentIndex + 1)
  const workoutRemaining = timer.isComplete
    ? 0
    : timer.timeRemaining + segsAfter.reduce((s, seg) => s + seg.duration, 0)
  const totalWorkoutDuration = timer.segments.reduce((s, seg) => s + seg.duration, 0)
  const overallProgress = timer.isComplete ? 1 : totalWorkoutDuration > 0 ? elapsed / totalWorkoutDuration : 0
  const outerDashOffset = OUTER_CIRCUMFERENCE * (1 - overallProgress)

  const showCounters = timer.currentRound > 0 && !timer.isComplete &&
    timer.phase !== 'warmup' && timer.phase !== 'cooldown'

  return (
    <div className="flex flex-col h-[100dvh] select-none" style={{ backgroundColor: '#0c0c0f' }}>
    <div className="flex flex-col h-full w-full mx-auto" style={{ maxWidth: 480 }}>

      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 18px)', paddingBottom: 10 }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuitConfirm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-90"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            aria-label="Close"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            onClick={toggleSound}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-90"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            aria-label={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
        </div>

        <span className="text-white/30 text-sm truncate max-w-[160px]">{workout.name}</span>

        {/* Round / group counters */}
        <div className="text-right min-w-[48px]">
          {showCounters && workout.type === 'circuit' && timer.totalGroups > 1 && (
            <p className="text-white/55 text-sm font-semibold leading-tight tabular-nums">
              {timer.currentGroup}/{timer.totalGroups}
            </p>
          )}
          {showCounters && (
            <p className="text-white/35 text-xs leading-tight tabular-nums">
              {timer.currentRound}/{timer.totalRounds}
            </p>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6">

        {timer.isComplete ? (
          /* — Complete state — */
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-[60vw] max-w-[240px]">
                <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(250,204,21,0.15)" strokeWidth="10" />
                <circle
                  cx="100" cy="100" r={RADIUS}
                  fill="none" stroke="#ffcb38" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE} strokeDashoffset={0}
                  transform="rotate(-90 100 100)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: 'clamp(38px, 12vw, 54px)' }}>🎉</span>
              </div>
            </div>
            <p className="text-white text-xl font-semibold mt-2">Workout complete</p>
            <p className="text-white/35 text-sm">Great work!</p>
          </div>
        ) : (
          <>
            {/* Ring */}
            <div className="relative flex items-center justify-center mb-5">
              <svg viewBox="0 0 200 200" className="w-[65vw] max-w-[265px]">
                {/* Outer ring — overall workout progress */}
                <circle cx="100" cy="100" r={OUTER_RADIUS} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                <circle
                  cx="100" cy="100" r={OUTER_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={OUTER_CIRCUMFERENCE}
                  strokeDashoffset={outerDashOffset}
                  transform="rotate(-90 100 100)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
                {/* Inner track */}
                <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                {/* Phase progress ring with glow */}
                <circle
                  cx="100" cy="100" r={RADIUS}
                  fill="none"
                  stroke={color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 100 100)"
                  style={{
                    transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s ease',
                    filter: `drop-shadow(0 0 9px ${color}cc)`,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <p
                  key={timer.timeRemaining}
                  className="text-white font-light tabular-nums"
                  style={{
                    fontSize: 'clamp(34px, 10.5vw, 52px)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-1px',
                    animation: 'timeStep 0.22s ease-out',
                  }}
                >
                  {formatTime(timer.timeRemaining)}
                </p>
              </div>
            </div>

            {/* Phase + exercise info */}
            <div className="text-center px-6 mb-2">
              <p
                className="text-xs font-semibold tracking-widest uppercase mb-2 transition-colors duration-500"
                style={{ color }}
              >
                {label}
              </p>
              {timer.phase === 'work' && workout.type === 'circuit' ? (
                <p className="text-white text-xl font-semibold leading-snug">
                  {timer.exerciseName}
                </p>
              ) : timer.phase === 'work' ? (
                <p className="text-white/40 text-base font-light">Interval</p>
              ) : timer.phase === 'rest' ? (
                <p className="text-white/40 text-base font-light">
                  {showCounters ? `Round ${timer.currentRound} of ${timer.totalRounds}` : 'Recover'}
                </p>
              ) : (
                <p className="text-white/40 text-base font-light">{label}</p>
              )}
            </div>

            {/* Next up */}
            {timer.segmentIndex < timer.segments.length - 1 && (
              <p className="text-white/20 text-xs mt-2">
                Next —{' '}
                <span className="text-white/35">
                  {timer.segments[timer.segmentIndex + 1].label}
                  {' · '}
                  {formatTime(timer.segments[timer.segmentIndex + 1].duration)}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div
        className="shrink-0 px-6"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
      >
        {timer.isComplete ? (
          <div className="flex gap-3">
            <button
              onClick={timer.reset}
              className="flex-1 py-4 rounded-2xl text-white/55 font-medium text-sm border border-white/10 transition-colors hover:border-white/20"
            >
              Restart
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-4 rounded-2xl font-semibold text-sm transition-colors"
              style={{ backgroundColor: '#ffcb38', color: '#0a0a14' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Circuit: next exercise shortcut */}
            {workout.type === 'circuit' && (
              <button
                onClick={handleSkipNext}
                className="w-full py-3 rounded-2xl text-sm font-medium mb-5 transition-all active:scale-98"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}
              >
                Next exercise →
              </button>
            )}

            {/* Media controls */}
            <div className="flex items-center justify-center gap-12 mb-5">
              {/* Prev */}
              <button
                onClick={handleSkipPrev}
                className="transition-all active:scale-90"
                aria-label="Previous"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              {/* Play / Pause */}
              <button
                onClick={handleToggle}
                className="rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg"
                style={{ backgroundColor: color, width: 70, height: 70 }}
                aria-label={timer.isRunning ? 'Pause' : 'Play'}
              >
                {timer.isRunning ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#0a0a14">
                    <rect x="5" y="4" width="4" height="16" rx="1.5" />
                    <rect x="15" y="4" width="4" height="16" rx="1.5" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#0a0a14">
                    <path d="M6 4l14 8-14 8V4z" />
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={handleSkipNext}
                className="transition-all active:scale-90"
                aria-label="Next"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
                </svg>
              </button>
            </div>

            {/* Bottom bar: elapsed | phase | remaining */}
            <div
              className="flex items-center justify-between px-1 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-white/30 text-xs tabular-nums w-12">{formatTime(elapsed)}</span>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color }}>{label}</span>
              <span className="text-white/30 text-xs tabular-nums w-12 text-right">{formatTime(workoutRemaining)}</span>
            </div>
          </>
        )}
      </div>

      {/* Quit confirm sheet */}
      {showQuitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowQuitConfirm(false)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-5"
            style={{
              backgroundColor: '#13131a',
              paddingBottom: 'max(env(safe-area-inset-bottom), 28px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <p className="text-white text-lg font-semibold text-center mb-1">Quit workout?</p>
            <p className="text-white/35 text-sm text-center mb-6">Your progress will be lost.</p>
            <button
              onClick={handleQuit}
              className="w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-98"
              style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#f87171' }}
            >
              Quit
            </button>
            <button
              onClick={() => setShowQuitConfirm(false)}
              className="w-full py-3 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Continue workout
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
