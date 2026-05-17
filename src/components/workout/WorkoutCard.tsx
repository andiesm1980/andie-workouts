'use client'

import type { Workout } from '@/types/workout'
import { computeTotalTime, formatDuration } from '@/lib/workoutUtils'

const TYPE_COLOR: Record<string, string> = {
  hiit: '#f0407a',
  circuit: '#4e8fff',
}

interface Props {
  workout: Workout
  onSelect: (id: string) => void
  selected?: boolean
  onDragHandlePointerDown?: (e: React.PointerEvent) => void
}

export function WorkoutCard({ workout, onSelect, selected, onDragHandlePointerDown }: Props) {
  const accent = TYPE_COLOR[workout.type]
  const total = computeTotalTime(workout)
  const exCount = workout.type === 'circuit'
    ? (workout.exerciseGroups ?? []).flatMap((g) => g.exercises ?? []).length
    : null

  return (
    <div
      className="flex items-center gap-2 py-4 rounded-lg px-2 -mx-2 transition-colors"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: selected ? 'rgba(255,255,255,0.05)' : 'transparent',
      }}
    >
      {onDragHandlePointerDown && (
        <div
          onPointerDown={onDragHandlePointerDown}
          style={{ cursor: 'grab', touchAction: 'none' }}
          className="shrink-0 flex flex-col gap-[3px] py-1"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-[3px]">
              {[0, 1].map((j) => (
                <div key={j} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        onClick={() => onSelect(workout.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(workout.id)}
        className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: workout.accentColor ?? accent }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-white font-medium text-base truncate leading-snug">{workout.name}</p>
            {workout.pinned && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#ffcb38" stroke="none" className="shrink-0 mb-0.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </div>
          {exCount !== null && exCount > 0 && (
            <p className="text-white/25 text-xs mt-0.5 truncate">
              {exCount} exercise{exCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
          style={{ backgroundColor: (workout.accentColor ?? accent) + '18', color: workout.accentColor ?? accent }}
        >
          {workout.type === 'hiit' ? 'HIIT' : 'Circuit'}
        </span>

        <span className="text-white/30 text-sm tabular-nums shrink-0 min-w-[44px] text-right">
          {formatDuration(total)}
        </span>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  )
}
