import type { Workout } from '@/types/workout'

export function encodeWorkout(workout: Workout): string {
  return btoa(encodeURIComponent(JSON.stringify(workout)))
}

export function decodeWorkout(encoded: string): Workout | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as Workout
  } catch {
    return null
  }
}

export function shareUrl(workout: Workout): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/share?w=${encodeWorkout(workout)}`
}
