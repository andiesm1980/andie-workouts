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
  onDelete: (id: string) => void
}

export function WorkoutCard({ workout, onDelete }: Props) {
  const router = useRouter()
  const accent = TYPE_COLOR[workout.type]
  const total = computeTotalTime(workout)

  return (
    <div
      onClick={() => router.push(`/workout/${workout.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/workout/${workout.id}`)}
      className="w-full text-left rounded-2xl overflow-hidden border border-white/6 flex flex-col transition-all active:scale-98 hover:border-white/12 cursor-pointer"
      style={{ backgroundColor: '#13131a' }}
    >
      {/* Top accent line */}
      <div className="h-[2px] shrink-0" style={{ backgroundColor: accent }} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-5">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: accent }}>
              {workout.type === 'hiit' ? 'HIIT' : 'Circuit'}
            </p>
            <h3 className="text-white font-semibold text-xl leading-snug">{workout.name}</h3>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(workout.id) }}
            className="p-2 rounded-lg text-white/15 hover:text-red-400/60 hover:bg-red-500/8 transition-all shrink-0 mt-0.5"
            aria-label="Delete"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-5 mb-5">
          <StatItem label="Work" value={`${workout.workTime}s`} />
          <StatItem label="Rest" value={`${workout.restTime}s`} />
          {(workout.intervals || 1) > 1 && (
            <StatItem label="Intervals" value={String(workout.intervals)} />
          )}
          <StatItem label="Sets" value={String(workout.rounds)} />
          <StatItem label="~Total" value={formatDuration(total)} />
        </div>

        {/* Exercise tags (circuit only) */}
        {workout.type === 'circuit' && (workout.exerciseGroups ?? []).length > 0 && (() => {
          const allEx = (workout.exerciseGroups ?? []).flatMap((g) => g.exercises)
          return (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {allEx.slice(0, 4).map((ex) => (
                <span
                  key={ex.id}
                  className="text-xs px-2.5 py-1 rounded-lg text-white/40 border border-white/6"
                >
                  {ex.name}
                </span>
              ))}
              {allEx.length > 4 && (
                <span className="text-xs px-2.5 py-1 rounded-lg text-white/25 border border-white/6">
                  +{allEx.length - 4}
                </span>
              )}
            </div>
          )
        })()}

        {/* Open indicator */}
        <div className="mt-auto flex items-center justify-end">
          <span className="text-xs text-white/20 flex items-center gap-1">
            Open
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-white/25 text-xs">{label}</span>
      <span className="text-white/80 text-sm font-medium">{value}</span>
    </div>
  )
}
