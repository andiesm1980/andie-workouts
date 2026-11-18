'use client'

import type { Reminder } from '@/types/workout'
import { accentText } from '@/lib/workoutUtils'

interface Props {
  reminder: Reminder
  accent: string
  onDone: () => void
  onSnooze: () => void
}

export function ReminderBanner({ reminder, accent, onDone, onSnooze }: Props) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ backgroundColor: accent + '12', border: `1px solid ${accent}30` }}
    >
      <div className="flex items-start gap-2.5 mb-1">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <p className="text-white/85 text-sm font-semibold leading-snug">{reminder.title}</p>
      </div>
      {reminder.message && (
        <p className="text-white/50 text-sm leading-snug mb-3 pl-[25px] whitespace-pre-line">{reminder.message}</p>
      )}
      <div className="flex gap-2 pl-[25px]">
        <button
          onClick={onDone}
          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ backgroundColor: accent, color: accentText(accent) }}
        >
          Done
        </button>
        <button
          onClick={onSnooze}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}
        >
          Snooze 1 week
        </button>
      </div>
    </div>
  )
}
