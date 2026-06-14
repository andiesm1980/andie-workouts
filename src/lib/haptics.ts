export type HapticType = 'tap' | 'work' | 'rest' | 'break' | 'countdown' | 'phase' | 'complete'

export function haptic(type: HapticType) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  const patterns: Record<HapticType, number | number[]> = {
    tap:       8,
    countdown: 12,
    phase:     [20, 10, 20],
    work:      [45],
    rest:      [15, 30, 15],
    break:     [20, 20, 20, 20, 40],
    complete:  [30, 20, 60],
  }
  navigator.vibrate(patterns[type])
}
