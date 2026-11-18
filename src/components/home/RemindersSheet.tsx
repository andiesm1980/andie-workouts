'use client'

import { useState } from 'react'
import { useWorkoutStore } from '@/store/workoutStore'
import { generateId } from '@/lib/workoutUtils'
import { useActiveReminders } from '@/hooks/useActiveReminders'
import {
  reminderShowsAt, currentOccurrence,
  toLocalInput, fromLocalInput, formatReminderDate,
} from '@/lib/reminders'
import type { Reminder } from '@/types/workout'
import { StepInput } from '@/components/workout/StepInput'

const ACCENT = '#fbbf24'

interface Draft {
  id: string | null // null = new reminder
  title: string
  message: string
  start: string     // datetime-local value
  repeats: boolean
  repeatWeeks: number
  workoutIds: string[]
}

function draftFrom(r: Reminder | null): Draft {
  if (!r) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(8, 0, 0, 0)
    return { id: null, title: '', message: '', start: toLocalInput(tomorrow.getTime()), repeats: false, repeatWeeks: 4, workoutIds: [] }
  }
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    start: toLocalInput(r.startAt),
    repeats: !!r.repeatWeeks,
    repeatWeeks: r.repeatWeeks ?? 4,
    workoutIds: r.workoutIds,
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function RemindersSheet({ isOpen, onClose }: Props) {
  const { reminders, workouts, addReminder, updateReminder, deleteReminder } = useWorkoutStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const activeIds = new Set(useActiveReminders().active.map((r) => r.id))

  if (!isOpen) return null

  const close = () => { setDraft(null); setConfirmDelete(false); onClose() }
  const openEditor = (r: Reminder | null) => { setDraft(draftFrom(r)); setConfirmDelete(false) }

  const startAt = draft ? fromLocalInput(draft.start) : null
  const canSave = !!draft && draft.title.trim() !== '' && startAt !== null

  const save = () => {
    if (!draft || startAt === null || !canSave) return
    const now = Date.now()
    const repeatWeeks = draft.repeats ? draft.repeatWeeks : undefined
    const fields = { title: draft.title.trim(), message: draft.message.trim(), startAt, repeatWeeks, workoutIds: draft.workoutIds }
    const existing = reminders.find((r) => r.id === draft.id)
    if (!existing) {
      addReminder({ id: generateId(), ...fields, dueAt: currentOccurrence(startAt, repeatWeeks, now), createdAt: now })
    } else if (existing.startAt !== startAt || existing.repeatWeeks !== repeatWeeks) {
      // Schedule changed: restart from the new date and clear done/snoozed state
      updateReminder(existing.id, { ...fields, dueAt: currentOccurrence(startAt, repeatWeeks, now), snoozedUntil: undefined, completed: false })
    } else {
      updateReminder(existing.id, fields)
    }
    setDraft(null)
  }

  const toggleWorkout = (id: string) => {
    if (!draft) return
    setDraft({
      ...draft,
      workoutIds: draft.workoutIds.includes(id) ? draft.workoutIds.filter((w) => w !== id) : [...draft.workoutIds, id],
    })
  }

  const sorted = [...reminders].sort((a, b) => {
    if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1
    return reminderShowsAt(a) - reminderShowsAt(b)
  })
  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', caretColor: ACCENT }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={close}
    >
      <div
        className="w-full rounded-t-3xl px-5 pt-4 max-h-[88vh] flex flex-col"
        style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />

        {draft ? (
          <>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <button onClick={() => setDraft(null)} className="text-white/40 hover:text-white/70 text-sm transition-colors">Cancel</button>
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">{draft.id ? 'Edit reminder' : 'New reminder'}</p>
              <button
                onClick={save}
                disabled={!canSave}
                className="text-sm font-semibold transition-opacity disabled:opacity-30"
                style={{ color: ACCENT }}
              >
                Save
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col gap-3 pb-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Title"
                className="w-full px-4 py-3 rounded-2xl text-base text-white placeholder-white/25 focus:outline-none"
                style={inputStyle}
              />
              <textarea
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                placeholder="Message"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm text-white/80 placeholder-white/25 focus:outline-none resize-none leading-relaxed"
                style={inputStyle}
              />

              <div className="flex items-center justify-between py-2">
                <span className="text-white text-base">Date & time</span>
                <input
                  type="datetime-local"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  className="px-3 py-2 rounded-xl text-sm text-white focus:outline-none [color-scheme:dark]"
                  style={inputStyle}
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: '#1e1e2a' }}>
                {([false, true] as const).map((repeats) => (
                  <button
                    key={String(repeats)}
                    onClick={() => setDraft({ ...draft, repeats })}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all"
                    style={{
                      backgroundColor: draft.repeats === repeats ? ACCENT : 'transparent',
                      color: draft.repeats === repeats ? '#111111' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {repeats ? 'Repeat' : 'Once'}
                  </button>
                ))}
              </div>

              {draft.repeats && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-white text-base">Every <span className="text-white/40 text-sm">(weeks)</span></span>
                  <StepInput
                    value={draft.repeatWeeks}
                    onChange={(v) => setDraft({ ...draft, repeatWeeks: v })}
                    min={1} max={52} step={1} format="count"
                  />
                </div>
              )}

              <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mt-3">Show in workouts</p>
              {workouts.length === 0 && <p className="text-white/25 text-sm">No workouts yet</p>}
              <div className="flex flex-col">
                {workouts.map((w) => {
                  const checked = draft.workoutIds.includes(w.id)
                  const accent = w.accentColor ?? '#f0407a'
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleWorkout(w.id)}
                      className="flex items-center gap-3 py-3 text-left"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                        style={{ backgroundColor: checked ? accent : 'transparent', border: checked ? 'none' : '1.5px solid rgba(255,255,255,0.2)' }}
                      >
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm truncate" style={{ color: checked ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>{w.name}</span>
                    </button>
                  )
                })}
              </div>

              {draft.id && (
                <button
                  onClick={() => {
                    if (!confirmDelete) { setConfirmDelete(true); return }
                    deleteReminder(draft.id!)
                    setDraft(null)
                  }}
                  className="w-full py-3.5 rounded-2xl font-medium text-sm mt-4 transition-all active:scale-98"
                  style={{ backgroundColor: 'rgba(239,68,68,0.14)', color: '#f87171' }}
                >
                  {confirmDelete ? 'Tap again to delete' : 'Delete reminder'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-3 px-1 shrink-0">Reminders</p>
            <div className="overflow-y-auto flex-1 flex flex-col gap-2">
              {sorted.length === 0 && (
                <p className="text-white/25 text-sm py-6 text-center">No reminders yet</p>
              )}
              {sorted.map((r) => {
                const active = activeIds.has(r.id)
                const linked = workouts.filter((w) => r.workoutIds.includes(w.id))
                return (
                  <button
                    key={r.id}
                    onClick={() => openEditor(r)}
                    className="w-full text-left rounded-2xl px-4 py-3 transition-colors active:bg-white/5"
                    style={{
                      backgroundColor: active ? ACCENT + '12' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? ACCENT + '30' : 'transparent'}`,
                      opacity: r.completed ? 0.45 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white/85 text-sm font-semibold truncate">{r.title}</p>
                      {active && (
                        <span className="text-[11px] font-semibold px-1.5 py-px rounded shrink-0" style={{ backgroundColor: ACCENT + '22', color: ACCENT }}>Now</span>
                      )}
                    </div>
                    <p className="text-white/35 text-xs mt-0.5">
                      {r.completed ? 'Done' : formatReminderDate(reminderShowsAt(r))}
                      {r.repeatWeeks ? ` · every ${r.repeatWeeks} week${r.repeatWeeks !== 1 ? 's' : ''}` : ''}
                    </p>
                    {linked.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {linked.map((w) => {
                          const accent = w.accentColor ?? '#f0407a'
                          return (
                            <span key={w.id} className="text-[11px] font-medium px-1.5 py-px rounded truncate max-w-full" style={{ backgroundColor: accent + '18', color: accent }}>
                              {w.name}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => openEditor(null)}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm mt-4 shrink-0 transition-all active:scale-98"
              style={{ backgroundColor: ACCENT, color: '#111111' }}
            >
              New reminder
            </button>
            <button onClick={close} className="w-full py-3 text-sm shrink-0 transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
