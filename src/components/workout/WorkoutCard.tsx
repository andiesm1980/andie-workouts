'use client'

import { useRouter } from 'next/navigation'
import type { Workout } from '@/types/workout'
import { computeTotalTime, formatDuration } from '@/lib/workoutUtils'

const TYPE_COLOR: Record<string, string> = {
  hiit: '#f0407a',
  circuit: '#4e8fff',
}

interface Props {
  workout: Workout
}

export function WorkoutCard({ workout }: Props) {
  const router = useRouter()
  const accent = TYPE_COLOR[workout.type]
  const total = computeTotalTime(workout)
  const exCount = workout.type === 'circuit'
    ? (workout.exerciseGroups ?? []).flatMap((g) => g.exercises ?? []).length
    : null

  return (
    <div
      onClick={() => router.push(`/workout/${workout.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/workout/${workout.id}`)}
      className="flex items-center gap-3 py-4 cursor-pointer transition-colors active:bg-white/3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Accent dot */}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-base truncate leading-snug">{workout.name}</p>
        {exCount !== null && exCount > 0 && (
          <p className="text-white/25 text-xs mt-0.5 truncate">
            {exCount} exercise{exCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Type badge */}
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 tabular-nums"
        style={{ backgroundColor: accent + '18', color: accent }}
      >
        {workout.type === 'hiit' ? 'HIIT' : 'Circuit'}
      </span>

      {/* Duration */}
      <span className="text-white/30 text-sm tabular-nums shrink-0 min-w-[44px] text-right">
        {formatDuration(total)}
      </span>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )
}
