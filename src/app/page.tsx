'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/store/workoutStore'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { generateId } from '@/lib/workoutUtils'
import type { Workout, WorkoutType } from '@/types/workout'

function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s > 0 ? s + 's' : ''}`.trim() : `${s}s`
}

function newWorkout(type: WorkoutType): Workout {
  return {
    id: generateId(),
    name: type === 'hiit' ? 'New HIIT' : 'New Circuit',
    type,
    workTime: 40,
    restTime: 20,
    intervals: 1,
    rounds: 8,
    cycleBreak: 30,
    warmup: 10,
    cooldown: 0,
    exerciseGroups: [],
    createdAt: Date.now(),
  }
}

export default function HomePage() {
  const router = useRouter()
  const { workouts, sessions, addWorkout, clearHistory } = useWorkoutStore()
  const [showPicker, setShowPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return workouts
    const q = query.toLowerCase()
    return workouts.filter((w) => w.name.toLowerCase().includes(q))
  }, [workouts, query])

  const handleCreate = (type: WorkoutType) => {
    const w = newWorkout(type)
    addWorkout(w)
    setShowPicker(false)
    router.push(`/workout/${w.id}`)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: '#0c0c0f' }}>
      {/* Header */}
      <header className="px-6" style={{ paddingTop: 'max(env(safe-area-inset-top), 32px)', paddingBottom: 16 }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 className="text-white text-3xl font-semibold tracking-tight">Workouts</h1>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/80"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>

        {/* Search */}
        {workouts.length > 0 && (
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workouts…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.07)',
                caretColor: '#f0407a',
              }}
            />
          </div>
        )}
      </header>

      <div className="h-px mx-6" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

      {/* List */}
      <main className="flex-1 px-6 pb-12">
        {workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-white/20 text-sm mb-6">No workouts yet</p>
            <button
              onClick={() => setShowPicker(true)}
              className="px-6 py-3 rounded-xl font-semibold text-sm border border-white/12 text-white/50 hover:text-white/70 hover:border-white/20 transition-all"
            >
              Create your first workout
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-white/20 text-sm py-10 text-center">No workouts match "{query}"</p>
        ) : (
          <div>
            {filtered.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        )}

        {/* Session history */}
        {sessions.length > 0 && (
          <div className="mt-10">
            <button
              className="flex items-center justify-between w-full mb-3"
              onClick={() => setShowHistory((v) => !v)}
            >
              <span className="text-white/25 text-xs font-semibold tracking-widest uppercase">History</span>
              <span className="text-white/20 text-xs">{showHistory ? '▲' : '▼'}</span>
            </button>

            {showHistory && (
              <div>
                {sessions.slice(0, 20).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <p className="text-white/70 text-sm font-medium">{s.workoutName}</p>
                      <p className="text-white/25 text-xs mt-0.5">{relativeDate(s.date)}</p>
                    </div>
                    <span className="text-white/30 text-sm tabular-nums">{fmtDuration(s.durationSeconds)}</span>
                  </div>
                ))}
                <button
                  onClick={() => { if (window.confirm('Clear all history?')) clearHistory() }}
                  className="mt-4 text-white/20 text-xs hover:text-white/40 transition-colors"
                >
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Type picker bottom sheet */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-6 pb-safe"
            style={{ backgroundColor: '#13131a', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Workout type</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleCreate('hiit')}
                className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-98"
                style={{ backgroundColor: '#1e1e2a' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,80,64,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0407a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">HIIT</p>
                  <p className="text-white/35 text-xs mt-0.5">High-intensity intervals with timed work and rest</p>
                </div>
              </button>
              <button
                onClick={() => handleCreate('circuit')}
                className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-98"
                style={{ backgroundColor: '#1e1e2a' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78,143,255,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4e8fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Circuit</p>
                  <p className="text-white/35 text-xs mt-0.5">Named exercises performed in sequence</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
