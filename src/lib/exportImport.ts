import type { Workout } from '@/types/workout'

export function exportWorkouts(workouts: Workout[]) {
  const json = JSON.stringify({ version: 1, workouts }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `my-workouts-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function parseImportFile(file: File): Promise<Workout[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  if (data.version === 1 && Array.isArray(data.workouts)) {
    return data.workouts as Workout[]
  }
  throw new Error('Unrecognised file format')
}
