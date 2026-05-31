'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Workout } from '@/types/workout'
import { useWorkoutStore } from '@/store/workoutStore'
import { TimerSettingsTab } from './TimerSettingsTab'
import { ExercisesTab } from './ExercisesTab'
import { computeTotalTime, formatDuration, generateId, accentText } from '@/lib/workoutUtils'
import { shareUrl } from '@/lib/shareWorkout'

type Tab = 'timer' | 'exercises'

interface Props {
  workout: Workout
  onClose?: () => void
  onDuplicate?: (newId: string) => void
}

export function WorkoutDetail({ workout: initial, onClose, onDuplicate }: Props) {
  const router = useRouter()
  const { updateWorkout, deleteWorkout, addWorkout, togglePin } = useWorkoutStore()
  const [workout, setWorkout] = useState<Workout>(initial)
  const [activeTab, setActiveTab] = useState<Tab>('timer')
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const cancelEditRef = useRef(false)

  const accent = workout.accentColor ?? '#f0407a'
  const goBack = () => onClose ? onClose() : router.push('/')

  const update = useCallback(
    (updates: Partial<Workout>) => {
      const next = { ...workout, ...updates }
      setWorkout(next)
      updateWorkout(next.id, updates)
    },
    [workout, updateWorkout]
  )

  const totalTime = computeTotalTime(workout)

  const confirmDelete = () => {
    deleteWorkout(workout.id)
    goBack()
  }

  const handleDuplicate = () => {
    const copy = { ...workout, id: generateId(), name: `${workout.name} (copy)`, createdAt: Date.now() }
    addWorkout(copy)
    setShowMenu(false)
    if (onDuplicate) onDuplicate(copy.id)
    else router.push(`/workout/${copy.id}`)
  }

  const handleShare = async () => {
    setShowMenu(false)
    const url = shareUrl(workout)
    if (navigator.share) {
      await navigator.share({ title: workout.name, text: `Check out my workout: ${workout.name}`, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const handlePin = () => {
    togglePin(workout.id)
    setWorkout((w) => ({ ...w, pinned: !w.pinned }))
    setShowMenu(false)
  }

  const tabs: Tab[] = workout.type === 'circuit' ? ['timer', 'exercises'] : ['timer']

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ backgroundColor: '#12121a', minHeight: onClose ? undefined : '100dvh' }}>

      {/* Accent glow behind header */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, left: 0, right: 0,
          height: '50%',
          background: `radial-gradient(ellipse 80% 60% at 20% 20%, ${accent}16 0%, transparent 65%)`,
          zIndex: 0,
        }}
      />

      {/* Header */}
      <div
        className="shrink-0 px-5 relative z-10"
        style={{ paddingTop: onClose ? 20 : 'max(env(safe-area-inset-top), 20px)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          {/* Back / Close */}
          <button
            onClick={goBack}
            className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-1 -ml-1"
            aria-label={onClose ? 'Close' : 'Back'}
          >
            {onClose ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            )}
          </button>

          {/* Workout name */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameRef}
                className="w-full bg-transparent text-white font-bold text-lg focus:outline-none border-b border-white/30 pb-0.5"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (cancelEditRef.current) { cancelEditRef.current = false; return }
                  const trimmed = editName.trim()
                  update({ name: trimmed || workout.name })
                  setEditingName(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') nameRef.current?.blur()
                  if (e.key === 'Escape') {
                    cancelEditRef.current = true
                    setEditingName(false)
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setEditName(workout.name); setEditingName(true) }}
                className="text-white font-bold text-lg truncate w-full text-left hover:text-white/80 transition-colors"
              >
                {workout.name}
              </button>
            )}
          </div>

          {/* Share copied toast */}
          {shareCopied && (
            <span className="text-xs shrink-0 transition-opacity" style={{ color: '#00d9a0' }}>Copied!</span>
          )}

          {/* ⋯ menu */}
          <button
            onClick={() => setShowMenu(true)}
            className="shrink-0 p-2 -mr-1 text-white/40 hover:text-white/70 transition-colors"
            aria-label="More options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>

        {/* Type toggle */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-xl" style={{ backgroundColor: '#1e1e2a' }}>
          {(['hiit', 'circuit'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                update({ type: t })
                if (t === 'hiit') setActiveTab('timer')
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all"
              style={{
                backgroundColor: workout.type === t ? accent : 'transparent',
                color: workout.type === t ? accentText(accent) : 'rgba(255,255,255,0.35)',
                boxShadow: workout.type === t ? `0 2px 14px ${accent}60` : 'none',
              }}
            >
              {t === 'hiit' ? 'HIIT' : 'Circuit'}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="py-3 px-1 mr-7 text-xs font-semibold tracking-widest uppercase transition-colors relative"
              style={{ color: activeTab === tab ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}
            >
              {tab === 'timer' ? 'Timer' : 'Exercises'}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: accent }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {activeTab === 'timer' ? (
          <TimerSettingsTab workout={workout} onChange={update} />
        ) : (
          <ExercisesTab workout={workout} onChange={update} />
        )}
        {/* Scroll fade into footer */}
        <div
          className="sticky bottom-0 h-10 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #12121a, transparent)' }}
        />
      </div>

      {/* Notes */}
      <div className="shrink-0 px-5 pb-3 pt-1 relative z-10">
        <textarea
          value={workout.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Notes…"
          rows={2}
          className="w-full text-white/50 text-sm resize-none focus:outline-none leading-relaxed focus:text-white/70 transition-colors px-4 py-3 rounded-2xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            caretColor: accent,
          }}
          onFocus={(e) => { (e.target as HTMLTextAreaElement).rows = 4 }}
          onBlur={(e) => { (e.target as HTMLTextAreaElement).rows = 2 }}
        />
      </div>

      {/* Start button with upward accent bloom */}
      <div
        className="shrink-0 px-5 pt-2 relative z-10"
        style={{ paddingBottom: onClose ? 24 : 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div
          className="absolute inset-x-5 bottom-full h-16 pointer-events-none rounded-b-none"
          style={{ background: `linear-gradient(to top, ${accent}18 0%, transparent 100%)` }}
        />
        <button
          onClick={() => router.push(`/timer/${workout.id}`)}
          className="w-full py-4 rounded-2xl font-semibold text-base transition-all active:scale-98"
          style={{ backgroundColor: accent, color: accentText(accent), boxShadow: `0 6px 28px ${accent}55` }}
        >
          Start — {formatDuration(totalTime)}
        </button>
      </div>

      {/* ⋯ menu sheet */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full rounded-t-3xl px-4 pt-4"
            style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />

            {/* Pin */}
            <button
              onClick={handlePin}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: workout.pinned ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24"
                  fill={workout.pinned ? '#fbbf24' : 'none'} stroke={workout.pinned ? '#fbbf24' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="text-base" style={{ color: workout.pinned ? '#fbbf24' : 'rgba(255,255,255,0.8)' }}>
                {workout.pinned ? 'Unpin workout' : 'Pin workout'}
              </span>
            </button>

            {/* Duplicate */}
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </div>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>Duplicate</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>Share</span>
            </button>

            <div className="my-2 mx-2" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

            {/* Delete */}
            <button
              onClick={() => { setShowMenu(false); setShowDeleteConfirm(true) }}
              className="flex items-center gap-4 w-full px-2 py-3.5 rounded-2xl transition-colors active:bg-white/5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <span className="text-base" style={{ color: '#f87171' }}>Delete workout</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm sheet */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowDeleteConfirm(false)}
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
              onClick={confirmDelete}
              className="w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-98"
              style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#f87171' }}
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-3 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
