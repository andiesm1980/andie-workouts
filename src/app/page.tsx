'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/store/workoutStore'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { WorkoutDetail } from '@/components/workout/WorkoutDetail'
import { generateId } from '@/lib/workoutUtils'
import { exportWorkouts, parseImportFile } from '@/lib/exportImport'
import { useDrag } from '@/hooks/useDrag'
import type { Workout, WorkoutType } from '@/types/workout'
import { TypePickerSheet } from '@/components/home/TypePickerSheet'
import { OverflowSheet } from '@/components/home/OverflowSheet'
import { SchedulingSheet, DAYS } from '@/components/home/SchedulingSheet'
import { SettingsSheet } from '@/components/home/SettingsSheet'

const TYPE_COLOR: Record<string, string> = {
  hiit: '#f0407a',
  circuit: '#4e8fff',
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s > 0 ? s + 's' : ''}`.trim() : `${s}s`
}

function newWorkout(type: WorkoutType): Workout {
  return {
    id: generateId(),
    name: type === 'hiit' ? 'New HIIT' : 'New Circuit',
    type,
    workTime: 40,
    restTime: 20,
    intervals: 1,
    rounds: 8,
    cycleBreak: 30,
    warmup: 10,
    cooldown: 0,
    exerciseGroups: [],
    createdAt: Date.now(),
  }
}

const JS_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DAY_SHORT: Record<string, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' }

export default function HomePage() {
  const router = useRouter()
  const { workouts, sessions, addWorkout, deleteWorkout, clearHistory, moveWorkout, reminderDays, lastBackupAt, reminderSnoozedAt, setLastBackupAt, setReminderSnoozedAt, schedule } = useWorkoutStore()
  const todayKey = JS_TO_KEY[new Date().getDay()]

  const streak = useMemo(() => {
    if (sessions.length === 0) return 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const sessionDays = new Set(sessions.map(s => { const d = new Date(s.date); d.setHours(0, 0, 0, 0); return d.getTime() }))
    let count = 0; let check = today.getTime()
    while (sessionDays.has(check)) { count++; check -= 86400000 }
    return count
  }, [sessions])

  const weekStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.getTime()
  }, [])

  const weekSessions = useMemo(() => sessions.filter(s => s.date >= weekStart), [sessions, weekStart])
  const weekTotalTime = weekSessions.reduce((t, s) => t + s.durationSeconds, 0)

  const bests = useMemo(() => {
    const m = new Map<string, number>()
    sessions.forEach(s => { const e = m.get(s.workoutId); if (!e || s.durationSeconds < e) m.set(s.workoutId, s.durationSeconds) })
    return m
  }, [sessions])

  const sessionCountByWorkout = useMemo(() => {
    const m = new Map<string, number>()
    sessions.forEach(s => m.set(s.workoutId, (m.get(s.workoutId) ?? 0) + 1))
    return m
  }, [sessions])

  const todaySuggestion = useMemo(() => {
    if (schedule[todayKey] || workouts.length === 0) return null
    const lastDate = new Map<string, number>()
    sessions.forEach(s => { const cur = lastDate.get(s.workoutId) ?? 0; if (s.date > cur) lastDate.set(s.workoutId, s.date) })
    return [...workouts].sort((a, b) => (lastDate.get(a.id) ?? 0) - (lastDate.get(b.id) ?? 0))[0] ?? null
  }, [schedule, todayKey, workouts, sessions])

  const [schedulingDay, setSchedulingDay] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleDeduplicate = () => {
    const seen = new Map<string, typeof workouts[0]>()
    workouts.forEach((w) => {
      const key = w.name.trim().toLowerCase()
      const existing = seen.get(key)
      if (!existing || w.createdAt < existing.createdAt) seen.set(key, w)
    })
    const deduped = workouts.filter((w) => seen.get(w.name.trim().toLowerCase())?.id === w.id)
    const removed = workouts.length - deduped.length
    if (removed > 0) {
      moveWorkout(deduped)
      setImportMsg(`Removed ${removed} duplicate${removed !== 1 ? 's' : ''}`)
    } else {
      setImportMsg('No duplicates found')
    }
    setTimeout(() => setImportMsg(null), 3000)
    setShowOverflow(false)
  }

  // Reminder is due when more than reminderDays have passed since the last
  // real backup OR the last snooze (✕ dismiss), whichever is more recent.
  const baseTime = Math.max(lastBackupAt, reminderSnoozedAt)
  const reminderDue = reminderDays > 0
    && workouts.length > 0
    && (baseTime === 0
      ? Math.min(...workouts.map((w) => w.createdAt)) < Date.now() - reminderDays * 86_400_000
      : Date.now() - baseTime > reminderDays * 86_400_000)
  const rowEls = useRef<Map<string, HTMLElement>>(new Map())

  const filtered = useMemo(() => {
    if (!query.trim()) return workouts
    const q = query.toLowerCase()
    return workouts.filter((w) => w.name.toLowerCase().includes(q))
  }, [workouts, query])

  const workoutTypeMap = useMemo(() => {
    const m = new Map<string, string>()
    workouts.forEach((w) => m.set(w.id, w.type))
    return m
  }, [workouts])

  const getDropIdx = useCallback((y: number) => {
    let best = workouts.length
    let bestDist = Infinity
    workouts.forEach((w, i) => {
      const el = rowEls.current.get(w.id)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(y - mid)
      if (dist < bestDist) { bestDist = dist; best = y < mid ? i : i + 1 }
    })
    return best
  }, [workouts])

  const { active: dragActive, dropTarget, start: startDrag } = useDrag<{ fromIdx: number; id: string }>(
    (drag, dropIdx) => {
      const next = [...workouts]
      const [item] = next.splice(drag.fromIdx, 1)
      const insertAt = dropIdx > drag.fromIdx ? dropIdx - 1 : dropIdx
      next.splice(insertAt, 0, item)
      moveWorkout(next)
    },
    getDropIdx
  )

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imported = await parseImportFile(file)
      const existingIds = new Set(workouts.map((w) => w.id))
      const existingNames = new Set(workouts.map((w) => w.name.trim().toLowerCase()))
      let count = 0
      imported.forEach((w) => {
        if (existingIds.has(w.id) || existingNames.has(w.name.trim().toLowerCase())) return
        addWorkout(w)
        count++
      })
      setImportMsg(`${count} workout${count !== 1 ? 's' : ''} imported`)
      setTimeout(() => setImportMsg(null), 3000)
    } catch {
      setImportMsg('Invalid file')
      setTimeout(() => setImportMsg(null), 3000)
    }
    e.target.value = ''
  }

  const selectedWorkout = workouts.find((w) => w.id === selectedId) ?? null

  const handleSelect = (id: string) => {
    if (window.innerWidth >= 768) setSelectedId(id)
    else router.push(`/workout/${id}`)
  }

  const handleCreate = (type: WorkoutType) => {
    const w = newWorkout(type)
    addWorkout(w)
    setShowPicker(false)
    if (window.innerWidth >= 768) setSelectedId(w.id)
    else router.push(`/workout/${w.id}`)
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="shrink-0 px-6 relative"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 32px)', paddingBottom: 16 }}
      >
        {/* Brand glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 90% at 15% 40%, rgba(240,64,122,0.09) 0%, transparent 70%)' }}
        />
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />

        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/25 text-xs font-semibold tracking-widest uppercase">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              {streak > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-px rounded-full" style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                  {streak > 1 ? `🔥 ${streak}` : '🔥 1'}
                </span>
              )}
            </div>
            <h1 className="text-white text-3xl font-semibold tracking-tight">Workouts</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* New — desktop only (mobile uses FAB) */}
            <button
              onClick={() => setShowPicker(true)}
              className="hidden md:flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/80"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
            {/* ⋯ overflow */}
            <button
              onClick={() => setShowOverflow(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 text-white/35 hover:text-white/60"
              aria-label="More options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>
        </div>
        {importMsg && (
          <p className="text-white/50 text-xs mb-3 text-center">{importMsg}</p>
        )}

        {workouts.length > 0 && (
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workouts…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.07)',
                caretColor: '#f0407a',
              }}
            />
          </div>
        )}
      </div>

      {/* Backup reminder banner */}
      {reminderDue && (
        <div className="mx-6 mb-3 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-white/80 text-sm font-medium leading-snug">Time to back up your workouts</p>
            <button onClick={() => setReminderSnoozedAt(Date.now())} className="text-white/25 hover:text-white/50 shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-white/35 text-xs mb-3">
            {lastBackupAt > 0
              ? `Last backup ${Math.floor((Date.now() - lastBackupAt) / 86_400_000)} days ago`
              : 'You haven\'t backed up yet'}
          </p>
          <button
            onClick={() => { exportWorkouts(workouts); setLastBackupAt(Date.now()) }}
            className="w-full py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ backgroundColor: '#f0407a', color: '#fff' }}
          >
            Back up now
          </button>
        </div>
      )}

      {/* Week schedule strip */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex justify-between">
          {DAYS.map(({ key }) => {
            const assignedId = schedule[key]
            const isRest = assignedId === '__rest__'
            const assignedWorkout = assignedId && !isRest ? workouts.find(w => w.id === assignedId) : null
            const isToday = key === todayKey
            return (
              <button
                key={key}
                onClick={() => setSchedulingDay(key)}
                className="flex flex-col items-center gap-1.5 py-1 px-1 rounded-xl transition-all"
                style={{ minWidth: 36, backgroundColor: isToday ? 'rgba(255,255,255,0.05)' : 'transparent' }}
              >
                <span className="text-[10px] font-semibold" style={{ color: isToday ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}>{DAY_SHORT[key]}</span>
                {isRest ? (
                  <span className="text-[9px] leading-none" style={{ color: 'rgba(255,255,255,0.2)' }}>Zzz</span>
                ) : (
                  <div
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ backgroundColor: assignedWorkout?.accentColor ?? (isToday ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.07)') }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-px mx-6 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-6 pt-3 pb-32 md:pb-12">
        {workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
              style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(240,64,122,0.14) 0%, rgba(255,255,255,0.03) 70%)',
                border: '1px solid rgba(240,64,122,0.18)',
                boxShadow: '0 0 60px rgba(240,64,122,0.07)',
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(240,64,122,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-white/60 text-base font-semibold mb-2">No workouts yet</p>
            <p className="text-white/25 text-sm mb-8 max-w-[200px] leading-relaxed">Create your first workout to get started</p>
            <button
              onClick={() => setShowPicker(true)}
              className="px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95"
              style={{ backgroundColor: '#f0407a', color: '#fff', boxShadow: '0 4px 20px rgba(240,64,122,0.35)' }}
            >
              Create workout
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-white/30 text-sm py-10 text-center">No workouts match "{query}"</p>
        ) : (
          <>
            {(() => {
              const todayWorkoutId = schedule[todayKey]
              if (todayWorkoutId === '__rest__') {
                return (
                  <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-base leading-none">😴</span>
                    <div>
                      <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Today</p>
                      <p className="text-white/60 text-sm font-medium">Rest day</p>
                    </div>
                  </div>
                )
              }
              const todayWorkout = todayWorkoutId ? workouts.find(w => w.id === todayWorkoutId) : null
              if (todayWorkout) {
                return (
                  <button
                    onClick={() => handleSelect(todayWorkout.id)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 w-full text-left transition-all active:scale-98"
                    style={{ backgroundColor: `${todayWorkout.accentColor ?? '#f0407a'}14`, border: `1px solid ${todayWorkout.accentColor ?? '#f0407a'}25` }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: todayWorkout.accentColor ?? '#f0407a' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Today</p>
                      <p className="text-white/80 text-sm font-medium truncate">{todayWorkout.name}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )
              }
              if (todaySuggestion) {
                return (
                  <button
                    onClick={() => handleSelect(todaySuggestion.id)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 w-full text-left transition-all active:scale-98"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: todaySuggestion.accentColor ?? '#f0407a', opacity: 0.6 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/30 text-[10px] font-semibold tracking-widest uppercase">Suggested for today</p>
                      <p className="text-white/65 text-sm font-medium truncate">{todaySuggestion.name}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )
              }
              return null
            })()}
          {filtered.map((workout, i) => {
            const globalIdx = workouts.indexOf(workout)
            const isDragging = dragActive?.id === workout.id
            const canDrag = !query.trim()
            return (
              <div key={workout.id} style={{ position: 'relative', marginBottom: 8 }}>
                {canDrag && dropTarget === i && dragActive && dragActive.id !== workout.id && (
                  <div className="h-0.5 rounded-full mx-2 mb-1" style={{ backgroundColor: '#f0407a' }} />
                )}
                <div
                  ref={(el) => { if (el) rowEls.current.set(workout.id, el); else rowEls.current.delete(workout.id) }}
                  style={{ opacity: isDragging ? 0.4 : 1, transition: 'opacity 0.15s' }}
                >
                  <WorkoutCard
                    workout={workout}
                    onSelect={handleSelect}
                    selected={selectedId === workout.id}
                    onDelete={() => setDeletingId(workout.id)}
                    onDragHandlePointerDown={canDrag ? (e) => startDrag(e, { fromIdx: globalIdx, id: workout.id }) : undefined}
                  />
                </div>
              </div>
            )
          })}
          </>
        )}
        {!query.trim() && dropTarget === workouts.length && dragActive && (
          <div className="h-0.5 rounded-full mx-2 mt-1" style={{ backgroundColor: '#f0407a' }} />
        )}

        {/* Session history */}
        {sessions.length > 0 && (
          <div className="mt-10">
            <button
              className="flex items-center justify-between w-full mb-3"
              onClick={() => setShowHistory((v) => !v)}
            >
              <span className="text-white/35 text-xs font-semibold tracking-widest uppercase">History</span>
              <div className="flex items-center gap-2">
                {weekSessions.length > 0 && (
                  <span className="text-white/25 text-xs">{weekSessions.length} this week · {fmtDuration(weekTotalTime)}</span>
                )}
                <span className="text-white/30 text-xs">{showHistory ? '▲' : '▼'}</span>
              </div>
            </button>
            {showHistory && (
              <div className="flex flex-col gap-1.5">
                {weekSessions.length > 0 && (
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wide">This week</p>
                      <p className="text-white/70 text-sm font-semibold mt-0.5">{weekSessions.length} session{weekSessions.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex-1 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wide">Total time</p>
                      <p className="text-white/70 text-sm font-semibold mt-0.5">{fmtDuration(weekTotalTime)}</p>
                    </div>
                  </div>
                )}
                {sessions.slice(0, 20).map((s) => {
                  const sessionAccent = TYPE_COLOR[workoutTypeMap.get(s.workoutId) ?? 'hiit']
                  const isPR = (sessionCountByWorkout.get(s.workoutId) ?? 0) >= 2 && s.durationSeconds === bests.get(s.workoutId)
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                    >
                      <div
                        className="self-stretch w-[3px] rounded-full shrink-0"
                        style={{ backgroundColor: sessionAccent + '70' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white/70 text-sm font-medium truncate">{s.workoutName}</p>
                        <p className="text-white/25 text-xs mt-0.5">{relativeDate(s.date)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPR && (
                          <span className="text-[10px] font-bold px-1.5 py-px rounded" style={{ backgroundColor: 'rgba(251,191,36,0.18)', color: '#fbbf24' }}>PR</span>
                        )}
                        <span className="text-white/30 text-sm tabular-nums">{fmtDuration(s.durationSeconds)}</span>
                        {s.rounds && <span className="text-white/20 text-xs">·</span>}
                        {s.rounds && <span className="text-white/30 text-xs">{s.rounds}r</span>}
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => { if (window.confirm('Clear all history?')) clearHistory() }}
                  className="mt-2 text-white/20 text-xs hover:text-white/40 transition-colors"
                >
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ backgroundColor: '#12121a' }}>

      {/* Sidebar — full width on mobile, 360px on desktop */}
      <div
        className="flex flex-col h-full w-full md:w-[45%] md:shrink-0 md:border-r"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {sidebar}
      </div>

      {/* Main panel — hidden on mobile (CSS), no overflow so WorkoutDetail manages its own scroll */}
      <div className="hidden md:flex flex-1 h-full flex-col">
        {selectedWorkout ? (
          <WorkoutDetail
            key={selectedWorkout.id}
            workout={selectedWorkout}
            onClose={() => setSelectedId(null)}
            onDuplicate={(newId) => setSelectedId(newId)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-5">
            {/* Icon with accent glow */}
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(240,64,122,0.18) 0%, rgba(255,255,255,0.04) 70%)',
                border: '1px solid rgba(240,64,122,0.2)',
                boxShadow: '0 0 40px rgba(240,64,122,0.08)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(240,64,122,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>

            <div className="text-center">
              <p className="text-white/70 text-base font-medium mb-1">No workout selected</p>
              <p className="text-white/30 text-sm">Pick one from the list or create a new one</p>
            </div>

            <button
              onClick={() => setShowPicker(true)}
              className="mt-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ backgroundColor: '#f0407a', color: '#fff' }}
            >
              + New workout
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm sheet */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-5"
            style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <p className="text-white text-lg font-semibold text-center mb-1">Delete workout?</p>
            <p className="text-white/35 text-sm text-center mb-6">This cannot be undone.</p>
            <button
              onClick={() => { deleteWorkout(deletingId); setDeletingId(null) }}
              className="w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-98"
              style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#f87171' }}
            >
              Delete
            </button>
            <button
              onClick={() => setDeletingId(null)}
              className="w-full py-3 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* FAB — mobile only */}
      <button
        onClick={() => setShowPicker(true)}
        className="md:hidden fixed z-40 flex items-center justify-center rounded-full shadow-xl transition-all active:scale-95"
        style={{
          width: 56, height: 56,
          right: 20,
          bottom: 'max(calc(env(safe-area-inset-bottom) + 20px), 28px)',
          backgroundColor: '#f0407a',
          boxShadow: '0 4px 24px rgba(240,64,122,0.45)',
          color: '#fff',
        }}
        aria-label="New workout"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <OverflowSheet
        isOpen={showOverflow}
        onClose={() => setShowOverflow(false)}
        onExport={() => { exportWorkouts(workouts); setLastBackupAt(Date.now()); setShowOverflow(false) }}
        onImport={() => { importInputRef.current?.click(); setShowOverflow(false) }}
        onDeduplicate={handleDeduplicate}
        onSettings={() => { setShowOverflow(false); setShowSettings(true) }}
      />

      <SettingsSheet isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <TypePickerSheet isOpen={showPicker} onClose={() => setShowPicker(false)} onCreate={handleCreate} />

      <SchedulingSheet day={schedulingDay} onClose={() => setSchedulingDay(null)} />
    </div>
  )
}
