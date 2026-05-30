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
  phase?: string
}

function Bubble({ label, color, size, dim, phase }: BubbleProps) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        className="flex items-center justify-center rounded-full font-semibold"
        style={{
          width: size,
          height: size,
          border: `2px solid ${dim ? 'rgba(255,255,255,0.16)' : color}`,
          backgroundColor: dim ? 'rgba(255,255,255,0.04)' : `${color}1a`,
          color: dim ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.92)',
          fontSize: size >= 52 ? 13 : 11,
          boxShadow: !dim ? `0 0 18px ${color}40` : 'none',
        }}
      >
        {label}
      </div>
      {phase && (
        <span className="text-[9px] uppercase tracking-widest" style={{ color: dim ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.28)' }}>
          {phase}
        </span>
      )}
    </div>
  )
}

interface Props {
  workout: Workout
}

export function IntervalPreview({ workout }: Props) {
  const intervals = Math.max(1, workout.intervals || 1)
  const shown = Math.min(intervals, 5)

  // Dashed track sits at the vertical center of the 54px work bubble.
  // py-5 = 20px top padding; work bubble center = 27px → absolute top: 47px
  const TRACK_TOP = 47

  return (
    <div className="py-5 overflow-x-auto no-scrollbar relative">
      {/* Dashed connecting track at work-bubble center height */}
      <div
        className="absolute pointer-events-none z-0"
        style={{
          top: TRACK_TOP,
          left: 20,
          right: 56,
          height: 1,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 3px, transparent 3px, transparent 8px)',
        }}
      />

      <div className="flex items-start gap-3 relative z-10">
        {/* Get ready */}
        {workout.warmup > 0 && (
          <div className="flex flex-col items-center gap-2 shrink-0">
            <Bubble label={fmtShort(workout.warmup)} color="#4e8fff" size={42} dim phase="Ready" />
            <div style={{ height: 16 }} />
          </div>
        )}

        {/* Work + rest pairs */}
        {Array.from({ length: shown }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <Bubble label={fmtShort(workout.workTime)} color="#f0407a" size={54} phase="Work" />
            <Bubble label={fmtShort(workout.restTime)} color="#00d9a0" size={38} phase="Rest" />
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
    </div>
  )
}
