'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Workout } from '@/types/workout'

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

interface WorkoutStore {
  workouts: Workout[]
  addWorkout: (workout: Workout) => void
  updateWorkout: (id: string, updates: Partial<Workout>) => void
  deleteWorkout: (id: string) => void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      workouts: DEFAULT_WORKOUTS,
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
        })),
    }),
    {
      name: 'my-workouts-store',
      version: 3,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as { workouts: any[] }

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

        return state
      },
    }
  )
)
