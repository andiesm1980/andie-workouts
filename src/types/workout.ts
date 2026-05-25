export type WorkoutType = 'hiit' | 'circuit'
export type Phase = 'idle' | 'warmup' | 'work' | 'rest' | 'break' | 'cooldown' | 'complete'

export interface Exercise {
  id: string
  name: string
  workTime?: number // overrides workout.workTime when set
  restTime?: number // overrides workout.restTime when set
}

export interface CompletedSession {
  id: string
  workoutId: string
  workoutName: string
  date: number        // timestamp ms
  durationSeconds: number
}

export interface ExerciseGroup {
  id: string
  exercises: Exercise[]
  setBreak?: number   // rest between sets of this superset (overrides cycleBreak)
  restAfter?: number  // rest after all sets before next superset (overrides workout.supersetBreak)
}

export interface Workout {
  id: string
  name: string
  type: WorkoutType
  workTime: number    // seconds per work interval
  restTime: number    // seconds per rest interval
  intervals: number   // work+rest pairs per cycle (hiit only)
  rounds: number      // sets per group
  cycleBreak: number    // rest between sets within a superset (seconds)
  supersetBreak?: number // rest between supersets (seconds); defaults to cycleBreak if unset
  warmup: number      // get ready countdown (seconds)
  cooldown: number    // cool down (seconds)
  exerciseGroups: ExerciseGroup[]
  autoStart?: boolean
  pinned?: boolean
  accentColor?: string
  notes?: string
  createdAt: number
}
