export type WorkoutType = 'hiit' | 'circuit'
export type Phase = 'idle' | 'warmup' | 'work' | 'rest' | 'break' | 'cooldown' | 'complete'

export interface Exercise {
  id: string
  name: string
  workTime?: number // overrides workout.workTime when set
  restTime?: number // overrides workout.restTime when set
  notes?: string
}

export interface CompletedSession {
  id: string
  workoutId: string
  workoutName: string
  date: number        // timestamp ms
  durationSeconds: number
  rounds?: number
}

export interface ExerciseGroup {
  id: string
  exercises: Exercise[]
  rounds?: number  // overrides workout.rounds for this superset when set
}

export interface Workout {
  id: string
  name: string
  type: WorkoutType
  workTime: number    // seconds per work interval
  restTime: number    // seconds per rest interval
  intervals: number   // work+rest pairs per cycle (hiit only)
  rounds: number      // sets per group
  cycleBreak: number  // break after all sets of a superset are done (seconds)
  warmup: number      // get ready countdown (seconds)
  cooldown: number    // cool down (seconds)
  exerciseGroups: ExerciseGroup[]
  autoStart?: boolean
  pinned?: boolean
  accentColor?: string
  notes?: string
  createdAt: number
}
