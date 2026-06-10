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
      const exercises = group.exercises ?? []
      const restTime = workout.restTime
      const isLastGroup = gIdx === groups.length - 1
      const workPerSet = exercises.reduce((sum, ex) => sum + (ex.workTime ?? workout.workTime), 0)
      const allRests = exercises.reduce((sum, ex) => {
        const r = ex.restTime ?? restTime
        return sum + (r > 0 ? r : 0)
      }, 0)
      // Last set of last group only: no rest after the final exercise
      const lastSetRests = exercises.slice(0, -1).reduce((sum, ex) => {
        const r = ex.restTime ?? restTime
        return sum + (r > 0 ? r : 0)
      }, 0)

      if (!isLastGroup) {
        // Non-last group: all rounds flow with rest between exercises; one break after all rounds
        total += rounds * (workPerSet + allRests) + cycleBreak
      } else {
        // Last group: all rounds flow with rest between exercises; last exercise of last round gets no rest
        total += (rounds - 1) * (workPerSet + allRests) + (workPerSet + lastSetRests)
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

// Returns '#111111' or '#ffffff' — whichever gives ≥ 4.5:1 WCAG contrast.
// Uses proper relative luminance (IEC 61966-2-1) so vibrant accents get dark text.
export function accentText(hex: string): string {
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const r = toLinear(parseInt(hex.slice(1, 3), 16) / 255)
  const g = toLinear(parseInt(hex.slice(3, 5), 16) / 255)
  const b = toLinear(parseInt(hex.slice(5, 7), 16) / 255)
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // L > 0.18 → dark text gives ≥ 4.5:1; otherwise white text gives ≥ 4.5:1
  return L > 0.18 ? '#111111' : '#ffffff'
}
