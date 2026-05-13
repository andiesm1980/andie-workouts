'use client'

import type { Workout } from '@/types/workout'

function fmtShort(s: number): string {
  if (s === 0) return '0'
  if (s < 60) return String(s)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${m}:00`
}

interface BubbleProps {
  label: string
  color: string
  size: number
  dim?: boolean
}

function Bubble({ label, color, size, dim }: BubbleProps) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 font-semibold"
      style={{
        width: size,
        height: size,
        border: `2.5px solid ${dim ? 'rgba(255,255,255,0.2)' : color}`,
        backgroundColor: dim ? 'rgba(255,255,255,0.05)' : `${color}18`,
        color: dim ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
        fontSize: size >= 52 ? 13 : 11,
      }}
    >
      {label}
    </div>
  )
}

interface Props {
  workout: Workout
}

export function IntervalPreview({ workout }: Props) {
  const intervals = Math.max(1, workout.intervals || 1)
  const shown = Math.min(intervals, 5)

  return (
    <div className="flex items-start gap-3 py-5 overflow-x-auto no-scrollbar">
      {/* Get ready */}
      {workout.warmup > 0 && (
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Bubble label={fmtShort(workout.warmup)} color="#4e8fff" size={42} dim />
          <div style={{ height: 38 }} />
        </div>
      )}

      {/* Work + rest pairs */}
      {Array.from({ length: shown }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 shrink-0">
          <Bubble label={fmtShort(workout.workTime)} color="#f0407a" size={54} />
          <Bubble label={fmtShort(workout.restTime)} color="#00d9a0" size={38} />
        </div>
      ))}

      {intervals > 5 && (
        <div className="self-start pt-3 shrink-0">
          <span className="text-white/30 text-xs">+{intervals - 5}</span>
        </div>
      )}

      {/* Sets count */}
      <div className="flex items-center self-center gap-1 ml-1 shrink-0">
        <span className="text-white/55 text-sm font-semibold">×{workout.rounds}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white/30">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}
