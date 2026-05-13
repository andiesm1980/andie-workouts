export function haptic(type: 'tap' | 'phase' | 'complete' | 'countdown') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  const patterns: Record<string, number | number[]> = {
    tap:       8,
    countdown: 12,
    phase:     [20, 10, 20],
    complete:  [30, 20, 60],
  }
  navigator.vibrate(patterns[type])
}
