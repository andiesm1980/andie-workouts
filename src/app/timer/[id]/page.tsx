'use client'

import { use } from 'react'
import { useWorkoutStore } from '@/store/workoutStore'
import { TimerDisplay } from '@/components/timer/TimerDisplay'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface Props {
  params: Promise<{ id: string }>
}

export default function TimerPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const workout = useWorkoutStore((s) => s.workouts.find((w) => w.id === id))

  useEffect(() => {
    if (!workout) router.replace('/')
  }, [workout, router])

  if (!workout) return null

  return <TimerDisplay workout={workout} />
}
