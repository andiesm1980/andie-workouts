'use client'

import { useState, useEffect } from 'react'
import { useWorkoutStore } from '@/store/workoutStore'
import { isReminderActive, completeReminder, snoozeReminder } from '@/lib/reminders'
import type { Reminder } from '@/types/workout'

// Reminders due now. Pass a workoutId to get only the ones linked to that workout.
// `now` refreshes when the app returns to the foreground, since an installed PWA
// can stay open in the background for days.
export function useActiveReminders(workoutId?: string) {
  const { reminders, updateReminder } = useWorkoutStore()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) setNow(Date.now()) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const active = reminders.filter((r) =>
    isReminderActive(r, now) && (workoutId === undefined || r.workoutIds.includes(workoutId))
  )

  return {
    active,
    markDone: (r: Reminder) => updateReminder(r.id, completeReminder(r, Date.now())),
    snooze: (r: Reminder) => updateReminder(r.id, snoozeReminder(Date.now())),
  }
}
