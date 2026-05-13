'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { decodeWorkout } from '@/lib/shareWorkout'
import { useWorkoutStore } from '@/store/workoutStore'
import { computeTotalTime, formatDuration, generateId } from '@/lib/workoutUtils'

function ShareContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { addWorkout, workouts } = useWorkoutStore()
  const [imported, setImported] = useState(false)

  const encoded = params.get('w')
  const workout = encoded ? decodeWorkout(encoded) : null

  if (!workout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center" style={{ backgroundColor: '#0c0c0f' }}>
        <p className="text-white/50 text-base mb-2">Invalid or expired link</p>
        <button onClick={() => router.push('/')} className="text-white/30 text-sm mt-4 hover:text-white/50 transition-colors">
          Go home
        </button>
      </div>
    )
  }

  const total = computeTotalTime(workout)
  const alreadyHave = workouts.some((w) => w.name === workout.name)

  const handleImport = () => {
    const newWorkout = { ...workout, id: generateId(), createdAt: Date.now() }
    addWorkout(newWorkout)
    setImported(true)
    setTimeout(() => router.push(`/workout/${newWorkout.id}`), 800)
  }

  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ backgroundColor: '#0c0c0f' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Badge */}
        <div
          className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
          style={{ backgroundColor: 'rgba(240,64,122,0.12)', color: '#f0407a' }}
        >
          Shared workout
        </div>

        <h1 className="text-white text-2xl font-semibold text-center mb-2">{workout.name}</h1>
        <p className="text-white/30 text-sm mb-8">{workout.type === 'hiit' ? 'HIIT' : 'Circuit'} · {formatDuration(total)}</p>

        {/* Details */}
        <div className="w-full max-w-sm rounded-2xl p-5 mb-8" style={{ backgroundColor: '#13131a' }}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Work', value: `${workout.workTime}s` },
              { label: 'Rest', value: `${workout.restTime}s` },
              { label: 'Rounds', value: workout.rounds },
              ...(workout.warmup > 0 ? [{ label: 'Warmup', value: `${workout.warmup}s` }] : []),
              ...(workout.cycleBreak > 0 ? [{ label: 'Break', value: `${workout.cycleBreak}s` }] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-white/30 text-xs mb-0.5">{label}</p>
                <p className="text-white font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {workout.type === 'circuit' && (workout.exerciseGroups ?? []).length > 0 && (
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {workout.exerciseGroups.map((g, i) => (
                <div key={g.id} className={i > 0 ? 'mt-4' : ''}>
                  {workout.exerciseGroups.length > 1 && (
                    <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#4e8fff' }}>
                      Group {i + 1}
                    </p>
                  )}
                  {(g.exercises ?? []).map((ex) => (
                    <p key={ex.id} className="text-white/60 text-sm py-1">{ex.name}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {imported ? (
          <p className="text-white/50 text-sm">Added! Redirecting…</p>
        ) : (
          <button
            onClick={handleImport}
            className="w-full max-w-sm py-4 rounded-2xl font-semibold text-base transition-all active:scale-98"
            style={{ backgroundColor: '#f0407a', color: '#fff' }}
          >
            {alreadyHave ? 'Add a copy' : 'Add to my workouts'}
          </button>
        )}

        <button
          onClick={() => router.push('/')}
          className="mt-4 text-white/25 text-sm hover:text-white/45 transition-colors"
        >
          My workouts
        </button>
      </div>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[100dvh]" style={{ backgroundColor: '#0c0c0f' }}>
        <p className="text-white/30 text-sm">Loading…</p>
      </div>
    }>
      <ShareContent />
    </Suspense>
  )
}
