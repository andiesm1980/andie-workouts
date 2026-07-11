'use client'

import { use, useState, useEffect } from 'react'
import { useWorkoutStore } from '@/store/workoutStore'
import { TimerDisplay } from '@/components/timer/TimerDisplay'
import { useRouter } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default function TimerPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const workout = useWorkoutStore((s) => s.workouts.find((w) => w.id === id))

  // Zustand v5 persist rehydrates asynchronously. On the first render the store
  // holds DEFAULT_WORKOUTS, so `workout` is undefined even for valid IDs.
  // We must wait for hydration before deciding the workout doesn't exist.
  const [hydrated, setHydrated] = useState(() => useWorkoutStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    return useWorkoutStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  useEffect(() => {
    if (hydrated && !workout) router.replace('/')
  }, [hydrated, workout, router])

  if (!hydrated || !workout) return null

  return <TimerDisplay workout={workout} />
}
