'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/store/workoutStore'
import { WorkoutDetail } from '@/components/workout/WorkoutDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default function WorkoutPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const workout = useWorkoutStore((s) => s.workouts.find((w) => w.id === id))

  const [hydrated, setHydrated] = useState(() => useWorkoutStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    return useWorkoutStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  useEffect(() => {
    if (hydrated && !workout) router.replace('/')
  }, [hydrated, workout, router])

  if (!hydrated || !workout) return null

  return <WorkoutDetail workout={workout} />
}
