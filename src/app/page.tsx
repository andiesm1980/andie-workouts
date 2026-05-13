'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/store/workoutStore'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { generateId } from '@/lib/workoutUtils'
import type { Workout, WorkoutType } from '@/types/workout'

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
  const { workouts, addWorkout, deleteWorkout } = useWorkoutStore()
  const [showPicker, setShowPicker] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const handleCreate = (type: WorkoutType) => {
    const w = newWorkout(type)
    addWorkout(w)
    setShowPicker(false)
    router.push(`/workout/${w.id}`)
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  const confirmDelete = () => {
    if (deleteTargetId) deleteWorkout(deleteTargetId)
    setDeleteTargetId(null)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: '#0c0c0f' }}>
      {/* Header */}
      <header className="px-6 pt-safe pt-8 pb-6" style={{ paddingTop: 'max(env(safe-area-inset-top), 32px)' }}>
        <div className="flex items-end justify-between">
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
      </header>

      <div className="h-px mx-6 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete confirm sheet */}
      {deleteTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-5"
            style={{ backgroundColor: '#13131a', paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <p className="text-white text-lg font-semibold text-center mb-1">Delete workout?</p>
            <p className="text-white/35 text-sm text-center mb-6">This cannot be undone.</p>
            <button
              onClick={confirmDelete}
              className="w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-98"
              style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#f87171' }}
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteTargetId(null)}
              className="w-full py-3 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
