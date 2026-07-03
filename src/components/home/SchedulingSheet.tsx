'use client'

import { useWorkoutStore } from '@/store/workoutStore'

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

interface Props {
  day: string | null
  onClose: () => void
}

export function SchedulingSheet({ day, onClose }: Props) {
  const { workouts, schedule, setScheduleDay } = useWorkoutStore()

  if (!day) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-4 pt-4 max-h-[70vh] flex flex-col"
        style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
        <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-3 px-2">
          {DAYS.find((d) => d.key === day)?.label} workout
        </p>
        <div className="overflow-y-auto flex-1">
          {schedule[day] && (
            <button
              onClick={() => { setScheduleDay(day, null); onClose() }}
              className="flex items-center gap-3 w-full px-2 py-3 rounded-2xl mb-1 transition-colors active:bg-white/5"
              style={{ color: 'rgba(239,68,68,0.7)' }}
            >
              <span className="text-sm">Clear day</span>
            </button>
          )}
          <button
            onClick={() => { setScheduleDay(day, '__rest__'); onClose() }}
            className="flex items-center gap-3 w-full px-2 py-3 rounded-2xl mb-2 transition-colors active:bg-white/5"
          >
            <span className="text-base leading-none">😴</span>
            <span className="text-sm" style={{ color: schedule[day] === '__rest__' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>Rest day</span>
            {schedule[day] === '__rest__' && (
              <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          {workouts.map((w) => {
            const isAssigned = schedule[day] === w.id
            return (
              <button
                key={w.id}
                onClick={() => { setScheduleDay(day, w.id); onClose() }}
                className="flex items-center gap-3 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.accentColor ?? '#f0407a' }} />
                <span className="flex-1 text-left text-sm" style={{ color: isAssigned ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}>{w.name}</span>
                {isAssigned && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={w.accentColor ?? '#f0407a'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { DAYS }
