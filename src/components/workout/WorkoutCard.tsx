'use client'

import { useState, useRef } from 'react'
import type { Workout } from '@/types/workout'
import { computeTotalTime, formatDuration } from '@/lib/workoutUtils'

const TYPE_COLOR: Record<string, string> = {
  hiit: '#f0407a',
  circuit: '#4e8fff',
}

const DELETE_REVEAL = 72

interface Props {
  workout: Workout
  onSelect: (id: string) => void
  selected?: boolean
  onDelete?: () => void
  onDragHandlePointerDown?: (e: React.PointerEvent) => void
}

export function WorkoutCard({ workout, onSelect, selected, onDelete, onDragHandlePointerDown }: Props) {
  const accent = workout.accentColor ?? TYPE_COLOR[workout.type]
  const total = computeTotalTime(workout)
  const exCount = workout.type === 'circuit'
    ? (workout.exerciseGroups ?? []).flatMap((g) => g.exercises ?? []).length
    : null

  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const swipe = useRef<{ startX: number; startY: number; locked: boolean; cancelled: boolean } | null>(null)
  const wasSwipeRef = useRef(false)

  const onCardPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    swipe.current = { startX: e.clientX, startY: e.clientY, locked: false, cancelled: false }
  }

  const onCardPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current
    if (!s || s.cancelled) return
    const dx = e.clientX - s.startX
    const dy = Math.abs(e.clientY - s.startY)

    if (!s.locked) {
      if (dy > 8) { s.cancelled = true; return }
      if (Math.abs(dx) < 6) return
      if (dx > 0 && !revealed) { s.cancelled = true; return }
      s.locked = true
    }

    const base = revealed ? -DELETE_REVEAL : 0
    setOffset(Math.min(0, Math.max(base + dx, -DELETE_REVEAL)))
  }

  const onCardPointerUp = () => {
    const s = swipe.current
    swipe.current = null
    if (!s || s.cancelled) return
    wasSwipeRef.current = s.locked
    if (!s.locked) return
    if (offset < -(DELETE_REVEAL / 2)) {
      setRevealed(true)
      setOffset(-DELETE_REVEAL)
    } else {
      setRevealed(false)
      setOffset(0)
    }
  }

  const closeSwipe = () => { setRevealed(false); setOffset(0) }

  const handleSelect = () => {
    if (wasSwipeRef.current) { wasSwipeRef.current = false; return }
    if (revealed) { closeSwipe(); return }
    onSelect(workout.id)
  }

  const isAnimating = !swipe.current

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onPointerDown={onCardPointerDown}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
      onPointerCancel={onCardPointerUp}
    >
      {/* Delete revealed area */}
      {onDelete && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center"
          style={{ width: DELETE_REVEAL, backgroundColor: 'rgba(239,68,68,0.12)' }}
        >
          <button
            onClick={() => { closeSwipe(); onDelete() }}
            className="flex flex-col items-center gap-1 px-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: '#f87171' }}>Delete</span>
          </button>
        </div>
      )}

      {/* Sliding card content */}
      <div
        className="flex items-center gap-2 py-4 px-2"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isAnimating ? 'transform 0.25s ease' : 'none',
          backgroundColor: selected ? 'rgba(255,255,255,0.05)' : '#0c0c0f',
        }}
      >
        {/* Accent stripe */}
        <div
          className="self-stretch w-[3px] rounded-full shrink-0"
          style={{ backgroundColor: accent + '55' }}
        />

        {onDragHandlePointerDown && (
          <div
            onPointerDown={(e) => { e.stopPropagation(); onDragHandlePointerDown(e) }}
            style={{ cursor: 'grab', touchAction: 'none' }}
            className="shrink-0 flex flex-col gap-[3px] py-1"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-[3px]">
                {[0, 1].map((j) => (
                  <div key={j} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
                ))}
              </div>
            ))}
          </div>
        )}

        <div
          onClick={handleSelect}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleSelect()}
          className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-white font-medium text-base truncate leading-snug">{workout.name}</p>
              {workout.pinned && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24" stroke="none" className="shrink-0 mb-0.5">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              )}
            </div>
            {exCount !== null && exCount > 0 && (
              <p className="text-white/25 text-xs mt-0.5 truncate">
                {exCount} exercise{exCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
            style={{ backgroundColor: accent + '18', color: accent }}
          >
            {workout.type === 'hiit' ? 'HIIT' : 'Circuit'}
          </span>

          <span className="text-white/30 text-sm tabular-nums shrink-0 min-w-[44px] text-right">
            {formatDuration(total)}
          </span>

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </div>
  )
}
