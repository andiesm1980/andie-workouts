'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Workout, CompletedSession, Reminder } from '@/types/workout'

const DEFAULT_WORKOUTS: Workout[] = [
  {
    id: 'default-tabata',
    name: 'Classic Tabata',
    type: 'hiit',
    workTime: 20,
    restTime: 10,
    intervals: 1,
    rounds: 8,
    cycleBreak: 0,
    warmup: 10,
    cooldown: 0,
    exerciseGroups: [],
    createdAt: Date.now() - 3000,
  },
  {
    id: 'default-hiit-4020',
    name: 'HIIT 40/20',
    type: 'hiit',
    workTime: 40,
    restTime: 20,
    intervals: 2,
    rounds: 6,
    cycleBreak: 30,
    warmup: 10,
    cooldown: 0,
    exerciseGroups: [],
    createdAt: Date.now() - 2000,
  },
  {
    id: 'default-circuit',
    name: 'Full Body Circuit',
    type: 'circuit',
    workTime: 45,
    restTime: 15,
    intervals: 1,
    rounds: 3,
    cycleBreak: 60,
    warmup: 10,
    cooldown: 0,
    exerciseGroups: [
      {
        id: 'g1',
        exercises: [
          { id: 'e1', name: 'Burpees' },
          { id: 'e2', name: 'Push-ups' },
          { id: 'e3', name: 'Squats' },
        ],
      },
      {
        id: 'g2',
        exercises: [
          { id: 'e4', name: 'Mountain Climbers' },
          { id: 'e5', name: 'Plank Hold' },
        ],
      },
    ],
    createdAt: Date.now() - 1000,
  },
]

function seedReminders(): Reminder[] {
  const volume = new Date(2026, 11, 23, 8, 45).getTime()
  const deload = new Date(2027, 0, 4, 7, 45).getTime()
  return [
    {
      id: 'reminder-volume-review',
      title: 'Revisión de volumen',
      message: '¿Qué grupo muscular no avanzó en peso ni repeticiones? Sumale 2–3 series por semana, sin pasar de 20.',
      startAt: volume,
      repeatWeeks: 6,
      workoutIds: [],
      dueAt: volume,
      createdAt: Date.now(),
    },
    {
      id: 'reminder-deload-week',
      title: 'Semana de descarga',
      message: 'Esta semana: mitad de series, mismo peso. Carreras suaves, sin intervalos.',
      startAt: deload,
      repeatWeeks: 7,
      workoutIds: [],
      dueAt: deload,
      createdAt: Date.now(),
    },
  ]
}

interface WorkoutStore {
  workouts: Workout[]
  sessions: CompletedSession[]
  soundEnabled: boolean
  voiceEnabled: boolean
  reminderDays: number        // 0 = off, 7, 30, 90
  lastBackupAt: number        // ms timestamp of last real export
  reminderSnoozedAt: number   // ms timestamp of last dismiss (without export)
  schedule: Record<string, string> // day key → workout id or '__rest__'
  reminders: Reminder[]
  addWorkout: (workout: Workout) => void
  updateWorkout: (id: string, updates: Partial<Workout>) => void
  deleteWorkout: (id: string) => void
  recordSession: (session: Omit<CompletedSession, 'id'>) => void
  clearHistory: () => void
  setSessions: (sessions: CompletedSession[]) => void
  setSoundEnabled: (v: boolean) => void
  setVoiceEnabled: (v: boolean) => void
  togglePin: (id: string) => void
  moveWorkout: (newOrder: Workout[]) => void
  setReminderDays: (days: number) => void
  setLastBackupAt: (ts: number) => void
  setReminderSnoozedAt: (ts: number) => void
  setScheduleDay: (day: string, workoutId: string | null) => void
  addReminder: (reminder: Reminder) => void
  updateReminder: (id: string, updates: Partial<Reminder>) => void
  deleteReminder: (id: string) => void
  setReminders: (reminders: Reminder[]) => void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      workouts: DEFAULT_WORKOUTS,
      sessions: [],
      soundEnabled: true,
      voiceEnabled: true,
      reminderDays: 30,
      lastBackupAt: 0,
      reminderSnoozedAt: 0,
      schedule: {},
      reminders: seedReminders(),
      addWorkout: (workout) =>
        set((state) => ({ workouts: [workout, ...state.workouts] })),
      updateWorkout: (id, updates) =>
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),
      deleteWorkout: (id) =>
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
          sessions: state.sessions.filter((s) => s.workoutId !== id),
          reminders: state.reminders.map((r) =>
            r.workoutIds.includes(id) ? { ...r, workoutIds: r.workoutIds.filter((wid) => wid !== id) } : r
          ),
        })),
      recordSession: (session) =>
        set((state) => ({
          sessions: [{ ...session, id: crypto.randomUUID() }, ...state.sessions].slice(0, 100),
        })),
      clearHistory: () => set({ sessions: [] }),
      setSessions: (sessions) => set({ sessions }),
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      togglePin: (id) =>
        set((state) => {
          const idx = state.workouts.findIndex((w) => w.id === id)
          if (idx === -1) return {}
          const item = state.workouts[idx]
          const toggled = { ...item, pinned: !item.pinned }
          const rest = state.workouts.filter((w) => w.id !== id)
          // When pinning, move to front; when unpinning, keep in place
          const workouts = toggled.pinned
            ? [toggled, ...rest]
            : [...rest.slice(0, idx), toggled, ...rest.slice(idx)]
          return { workouts }
        }),
      moveWorkout: (newOrder) => set({ workouts: newOrder }),
      setReminderDays: (days) => set({ reminderDays: days }),
      setLastBackupAt: (ts) => set({ lastBackupAt: ts }),
      setReminderSnoozedAt: (ts) => set({ reminderSnoozedAt: ts }),
      setScheduleDay: (day, workoutId) =>
        set((state) => {
          const next = { ...state.schedule }
          if (workoutId === null) delete next[day]
          else next[day] = workoutId
          return { schedule: next }
        }),
      addReminder: (reminder) =>
        set((state) => ({ reminders: [...state.reminders, reminder] })),
      updateReminder: (id, updates) =>
        set((state) => ({
          reminders: state.reminders.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteReminder: (id) =>
        set((state) => ({ reminders: state.reminders.filter((r) => r.id !== id) })),
      setReminders: (reminders) => set({ reminders }),
    }),
    {
      name: 'my-workouts-store',
      version: 9,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as { workouts: any[]; sessions?: any[]; soundEnabled?: boolean; voiceEnabled?: boolean; reminderDays?: number; lastBackupAt?: number; reminderSnoozedAt?: number; schedule?: Record<string, string>; reminders?: Reminder[] }

        if (fromVersion < 2) {
          state.workouts = (state.workouts ?? []).map((w: any) => ({
            ...w,
            intervals: w.intervals ?? 1,
            cycleBreak: w.cycleBreak ?? 0,
            warmup: w.warmup ?? 0,
            cooldown: w.cooldown ?? 0,
          }))
        }

        if (fromVersion < 3) {
          state.workouts = (state.workouts ?? []).map((w: any) => {
            const oldExercises: any[] = w.exercises ?? []
            const { exercises, ...rest } = w
            return {
              ...rest,
              exerciseGroups: w.exerciseGroups ?? (
                oldExercises.length > 0
                  ? [{ id: 'g-migrated-' + rest.id, exercises: oldExercises.map(({ id, name }: any) => ({ id, name })) }]
                  : []
              ),
            }
          })
        }

        if (fromVersion < 4) {
          state.sessions = state.sessions ?? []
          state.soundEnabled = state.soundEnabled ?? true
        }

        if (fromVersion < 5) {
          state.reminderDays = state.reminderDays ?? 30
          state.lastBackupAt = state.lastBackupAt ?? 0
        }

        if (fromVersion < 6) {
          state.reminderSnoozedAt = state.reminderSnoozedAt ?? 0
        }

        if (fromVersion < 7) {
          state.schedule = (state as any).schedule ?? {}
        }

        if (fromVersion < 8) {
          state.voiceEnabled = (state as any).voiceEnabled ?? true
        }

        if (fromVersion < 9) {
          state.reminders = state.reminders ?? seedReminders()
        }

        return state
      },
    }
  )
)
