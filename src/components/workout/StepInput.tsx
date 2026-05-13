'use client'

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  format?: 'time' | 'count'
}

export function StepInput({ value, onChange, min = 0, max = 9999, step = 5, format = 'time' }: Props) {
  const display = format === 'time' ? fmt(value) : String(value)

  return (
    <div
      className="flex items-center rounded-xl overflow-hidden select-none shrink-0"
      style={{ backgroundColor: '#1e1e2a', width: 180, height: 52 }}
    >
      <button
        onPointerDown={() => onChange(Math.max(min, value - step))}
        className="flex items-center justify-center text-white/60 hover:text-white active:text-white/40 transition-colors"
        style={{ width: 52, height: 52, fontSize: 22, fontWeight: 300 }}
        aria-label="Decrease"
      >
        −
      </button>
      <span
        className="flex-1 text-center text-white font-medium tabular-nums"
        style={{ fontSize: 17, fontVariantNumeric: 'tabular-nums', letterSpacing: format === 'time' ? '0.02em' : 0 }}
      >
        {display}
      </span>
      <button
        onPointerDown={() => onChange(Math.min(max, value + step))}
        className="flex items-center justify-center text-white/60 hover:text-white active:text-white/40 transition-colors"
        style={{ width: 52, height: 52, fontSize: 22, fontWeight: 300 }}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}
