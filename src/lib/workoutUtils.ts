import type { Workout } from '@/types/workout'

export function computeTotalTime(workout: Workout): number {
  const rounds = Math.max(1, workout.rounds || 1)
  const cycleBreak = workout.cycleBreak || 0
  let total = (workout.warmup || 0) + (workout.cooldown || 0)

  if (workout.type === 'hiit') {
    const intervals = Math.max(1, workout.intervals || 1)
    const perCycle = intervals * workout.workTime + (intervals - 1) * workout.restTime
    total += rounds * perCycle + (rounds - 1) * cycleBreak
  } else {
    const groups = workout.exerciseGroups ?? []
    groups.forEach((group, gIdx) => {
      const exCount = Math.max(1, (group.exercises ?? []).length)
      const perSet = exCount * workout.workTime + (exCount - 1) * workout.restTime
      const setBreakDur = group.setBreak !== undefined ? group.setBreak : cycleBreak
      total += rounds * perSet + (rounds - 1) * setBreakDur
      if (gIdx < groups.length - 1) {
        total += group.restAfter !== undefined ? group.restAfter : cycleBreak
      }
    })
  }

  return total
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Returns '#111111' for light accents (needs dark text) and '#ffffff' for dark accents.
export function accentText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 160 ? '#111111' : '#ffffff'
}
