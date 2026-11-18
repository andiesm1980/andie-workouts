'use client'

import { useEffect, useRef } from 'react'
import { useWorkoutStore } from '@/store/workoutStore'
import { useDrive, type WorkoutsPayload } from '@/context/DriveContext'

export function SyncManager() {
  const { workouts, sessions, reminders, moveWorkout, setSessions, setReminders } = useWorkoutStore()
  const drive = useDrive()

  // Use refs so event handlers always see the latest values without re-registering
  const readyToSave = useRef(false)
  const moveWorkoutRef = useRef(moveWorkout)
  const setSessionsRef = useRef(setSessions)
  const setRemindersRef = useRef(setReminders)
  const driveRef = useRef(drive)
  moveWorkoutRef.current = moveWorkout
  setSessionsRef.current = setSessions
  setRemindersRef.current = setReminders
  driveRef.current = drive

  const applyRemote = (data: WorkoutsPayload) => {
    moveWorkoutRef.current(data.workouts)
    setSessionsRef.current(data.sessions)
    // Older sync files have no reminders; keep the local ones rather than wiping them
    if (data.reminders) setRemindersRef.current(data.reminders)
  }

  // On startup: load from GitHub first, then enable auto-save
  useEffect(() => {
    if (!drive.isConnected) { readyToSave.current = true; return }
    drive.loadNow()
      .then((data) => { if (data) applyRemote(data) })
      .catch(() => {})
      .finally(() => { readyToSave.current = true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save to GitHub on any workout/session change (all routes)
  useEffect(() => {
    if (!readyToSave.current) return
    drive.scheduleSave({ workouts, sessions, reminders })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, sessions, reminders])

  // Re-sync from GitHub when the app comes back into focus after 60+ seconds away
  useEffect(() => {
    if (!drive.isConnected) return
    const hiddenAt = { current: 0 }
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current > 0 && Date.now() - hiddenAt.current > 60_000) {
        driveRef.current.loadNow()
          .then((data) => { if (data) applyRemote(data) })
          .catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.isConnected])

  return null
}
