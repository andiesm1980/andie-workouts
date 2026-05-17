'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Workout } from '@/types/workout'
import { useWorkoutStore } from '@/store/workoutStore'
import { TimerSettingsTab } from './TimerSettingsTab'
import { ExercisesTab } from './ExercisesTab'
import { computeTotalTime, formatDuration, generateId } from '@/lib/workoutUtils'
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

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

  const handleDelete = () => setShowDeleteConfirm(true)

  const confirmDelete = () => {
    deleteWorkout(workout.id)
    goBack()
  }

  const handleDuplicate = () => {
    const copy = { ...workout, id: generateId(), name: `${workout.name} (copy)`, createdAt: Date.now() }
    addWorkout(copy)
    if (onDuplicate) onDuplicate(copy.id)
    else router.push(`/workout/${copy.id}`)
  }

  const handleShare = async () => {
    const url = shareUrl(workout)
    if (navigator.share) {
      await navigator.share({ title: workout.name, text: `Check out my workout: ${workout.name}`, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const tabs: Tab[] = workout.type === 'circuit' ? ['timer', 'exercises'] : ['timer']

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0c0c0f', minHeight: onClose ? undefined : '100dvh' }}>
      {/* Header */}
      <div
        className="shrink-0 px-5"
        style={{ paddingTop: onClose ? 20 : 'max(env(safe-area-inset-top), 20px)' }}
      >
        <div className="flex items-center gap-3 mb-5">
          {/* Back / Close */}
          <button
            onClick={goBack}
            className="text-white/40 hover:text-white/70 transition-colors p-1 -ml-1"
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
                className="w-full bg-transparent text-white font-semibold text-base focus:outline-none border-b border-white/30 pb-0.5"
                defaultValue={workout.name}
                onBlur={(e) => {
                  update({ name: e.target.value.trim() || workout.name })
                  setEditingName(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') nameRef.current?.blur()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-white font-semibold text-base truncate w-full text-left hover:text-white/80 transition-colors"
              >
                {workout.name}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => togglePin(workout.id)}
              className="p-2 transition-colors"
              style={{ color: workout.pinned ? '#ffcb38' : 'rgba(255,255,255,0.35)' }}
              aria-label={workout.pinned ? 'Unpin workout' : 'Pin workout'}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill={workout.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              onClick={handleDuplicate}
              className="p-2 text-white/35 hover:text-white/60 transition-colors"
              aria-label="Duplicate workout"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              onClick={handleShare}
              className="p-2 transition-colors"
              style={{ color: shareCopied ? '#00d9a0' : 'rgba(255,255,255,0.35)' }}
              aria-label="Share workout"
            >
              {shareCopied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              )}
            </button>
            {!onClose && (
              <button
                onClick={goBack}
                className="p-2 text-white/40 hover:text-white/70 transition-colors"
                aria-label="Save and go back"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 text-white/25 hover:text-red-400/60 transition-colors"
              aria-label="Delete workout"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
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
                backgroundColor: workout.type === t ? '#f0407a' : 'transparent',
                color: workout.type === t ? '#fff' : 'rgba(255,255,255,0.35)',
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
              style={{
                color: activeTab === tab ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
              }}
            >
              {tab === 'timer' ? 'Timer' : 'Exercises'}
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: '#f0407a' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timer' ? (
          <TimerSettingsTab workout={workout} onChange={update} />
        ) : (
          <ExercisesTab workout={workout} onChange={update} />
        )}
      </div>

      {/* Start button */}
      <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: onClose ? 24 : 'max(env(safe-area-inset-bottom), 24px)' }}>
        <button
          onClick={() => router.push(`/timer/${workout.id}`)}
          className="w-full py-4 rounded-2xl font-semibold text-base transition-all active:scale-98"
          style={{ backgroundColor: '#f0407a', color: '#ffffff' }}
        >
          Start - Total time {formatDuration(totalTime)}
        </button>
      </div>

      {/* Delete confirm sheet */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full rounded-t-3xl px-6 pt-5"
            style={{ backgroundColor: '#13131a', paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
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
