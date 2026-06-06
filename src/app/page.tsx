'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/store/workoutStore'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { WorkoutDetail } from '@/components/workout/WorkoutDetail'
import { generateId } from '@/lib/workoutUtils'
import { exportWorkouts, parseImportFile } from '@/lib/exportImport'
import { useDrag } from '@/hooks/useDrag'
import { useDrive } from '@/context/DriveContext'
import type { Workout, WorkoutType } from '@/types/workout'

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

export default function HomePage() {
  const router = useRouter()
  const { workouts, sessions, addWorkout, deleteWorkout, clearHistory, moveWorkout, setSessions, reminderDays, lastBackupAt, reminderSnoozedAt, setReminderDays, setLastBackupAt, setReminderSnoozedAt } = useWorkoutStore()
  const drive = useDrive()
  const readyToSave = useRef(false)

  // On startup, load from GitHub before enabling auto-save
  useEffect(() => {
    if (!drive.isConnected) { readyToSave.current = true; return }
    drive.loadNow().then((data) => {
      if (data) { moveWorkout(data.workouts); setSessions(data.sessions) }
    }).catch(() => {}).finally(() => { readyToSave.current = true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save to GitHub whenever workouts or sessions change (skip initial mount)
  useEffect(() => {
    if (!readyToSave.current) return
    drive.scheduleSave({ workouts, sessions })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, sessions])
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
            <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
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
          filtered.map((workout, i) => {
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
          })
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
              <span className="text-white/30 text-xs">{showHistory ? '▲' : '▼'}</span>
            </button>
            {showHistory && (
              <div className="flex flex-col gap-1.5">
                {sessions.slice(0, 20).map((s) => {
                  const sessionAccent = TYPE_COLOR[workoutTypeMap.get(s.workoutId) ?? 'hiit']
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
                      <span className="text-white/30 text-sm tabular-nums shrink-0">{fmtDuration(s.durationSeconds)}</span>
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

      {/* Overflow bottom sheet */}
      {showOverflow && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowOverflow(false)}
        >
          <div
            className="w-full rounded-t-3xl px-4 pt-4"
            style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />

            {/* Export */}
            <button
              onClick={() => { exportWorkouts(workouts); setLastBackupAt(Date.now()); setShowOverflow(false) }}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>Export workouts</span>
            </button>

            {/* Import */}
            <button
              onClick={() => { importInputRef.current?.click(); setShowOverflow(false) }}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 5 17 10" />
                  <line x1="12" y1="5" x2="12" y2="17" />
                </svg>
              </div>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>Import workouts</span>
            </button>

            {/* Deduplicate */}
            <button
              onClick={handleDeduplicate}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  <line x1="17" y1="13" x2="17" y2="19" />
                  <line x1="14" y1="16" x2="20" y2="16" />
                </svg>
              </div>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>Remove duplicates</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => { setShowOverflow(false); setShowSettings(true) }}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings sheet */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-5"
            style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />

            {/* GitHub sync */}
            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-3">GitHub sync</p>
            {drive.isConnected ? (
              <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: drive.status === 'error' ? '#f0407a' : drive.status === 'syncing' ? '#fbbf24' : '#48B256' }} />
                      <span className="text-white/80 text-sm font-medium">
                        {drive.status === 'syncing' ? 'Syncing…' : drive.status === 'error' ? 'Sync error' : 'Connected'}
                      </span>
                    </div>
                    <p className="text-white/35 text-xs">{drive.repo}</p>
                    {drive.lastSynced && (
                      <p className="text-white/25 text-xs mt-0.5">
                        Last synced {drive.lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        drive.loadNow().then((data) => {
                          if (!data) return
                          moveWorkout(data.workouts)
                          setSessions(data.sessions)
                        }).catch(() => {})
                      }}
                      disabled={drive.status === 'syncing'}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                    >
                      Restore from GitHub
                    </button>
                    <button
                      onClick={drive.disconnect}
                      className="text-xs text-white/25 hover:text-white/50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
                {drive.error && <p className="text-xs mt-2" style={{ color: '#f0407a' }}>{drive.error}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                <input
                  value={drive.repo}
                  onChange={(e) => drive.setRepo(e.target.value)}
                  placeholder="owner/repo"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                <input
                  value={drive.token}
                  onChange={(e) => drive.setToken(e.target.value)}
                  placeholder="Personal access token (contents: write)"
                  type="password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                {drive.error && <p className="text-xs px-1" style={{ color: '#f0407a' }}>{drive.error}</p>}
                <button
                  onClick={drive.connect}
                  disabled={drive.status === 'connecting'}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: '#f0407a', color: '#fff' }}
                >
                  {drive.status === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            )}

            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Backup reminder</p>
            <div className="flex flex-col gap-1 mb-6">
              {([
                { label: 'Every week', days: 7 },
                { label: 'Every month', days: 30 },
                { label: 'Every 3 months', days: 90 },
                { label: 'Never', days: 0 },
              ] as const).map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => setReminderDays(days)}
                  className="flex items-center justify-between py-3.5 px-4 rounded-2xl transition-all"
                  style={{ backgroundColor: reminderDays === days ? 'rgba(240,64,122,0.12)' : 'rgba(255,255,255,0.04)' }}
                >
                  <span className="text-white text-sm font-medium">{label}</span>
                  {reminderDays === days && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0407a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {lastBackupAt > 0 && (
              <p className="text-white/25 text-xs text-center mb-4">
                Last backup: {new Date(lastBackupAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-3 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Type picker sheet */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-6"
            style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Workout type</p>
            <div className="flex flex-col gap-3 max-w-lg mx-auto">
              <button
                onClick={() => handleCreate('hiit')}
                className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-98"
                style={{ backgroundColor: '#1e1e2a' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,80,64,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0407a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">HIIT</p>
                  <p className="text-white/35 text-xs mt-0.5">High-intensity intervals with timed work and rest</p>
                </div>
              </button>
              <button
                onClick={() => handleCreate('circuit')}
                className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-98"
                style={{ backgroundColor: '#1e1e2a' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78,143,255,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4e8fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Circuit</p>
                  <p className="text-white/35 text-xs mt-0.5">Named exercises performed in sequence</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
