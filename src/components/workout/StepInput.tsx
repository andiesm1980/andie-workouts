'use client'

import { useState, useRef } from 'react'

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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const display = format === 'time' ? fmt(value) : String(value)

  const openEdit = () => {
    setDraft(String(value))
    setEditing(true)
    setTimeout(() => { inputRef.current?.select() }, 0)
  }

  const commitEdit = () => {
    const parsed = parseInt(draft, 10)
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)))
    setEditing(false)
  }

  return (
    <div
      className="flex items-center rounded-xl overflow-hidden select-none shrink-0"
      style={{ backgroundColor: '#1e1e2a', width: 180, height: 52, border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onPointerDown={() => onChange(Math.max(min, value - step))}
        className="flex items-center justify-center text-white/50 hover:text-white active:text-white/30 transition-colors shrink-0"
        style={{ width: 52, height: 52, fontSize: 22, fontWeight: 300 }}
        aria-label="Decrease"
      >
        −
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
          className="flex-1 text-center text-white font-medium bg-transparent focus:outline-none tabular-nums"
          style={{ fontSize: 17, MozAppearance: 'textfield' } as React.CSSProperties}
        />
      ) : (
        <button
          onClick={openEdit}
          className="flex-1 text-center text-white font-medium tabular-nums hover:text-white/80 transition-colors"
          style={{ fontSize: 17, letterSpacing: format === 'time' ? '0.02em' : 0 }}
          aria-label={`Edit value, currently ${display}${format === 'time' ? ' (in seconds)' : ''}`}
        >
          {display}
        </button>
      )}

      <button
        onPointerDown={() => onChange(Math.min(max, value + step))}
        className="flex items-center justify-center text-white/50 hover:text-white active:text-white/30 transition-colors shrink-0"
        style={{ width: 52, height: 52, fontSize: 22, fontWeight: 300 }}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}
