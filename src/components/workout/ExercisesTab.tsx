'use client'

import { useState, useRef } from 'react'
import type { Workout, ExerciseGroup, Exercise } from '@/types/workout'
import { generateId } from '@/lib/workoutUtils'

interface Props {
  workout: Workout
  onChange: (updates: Partial<Workout>) => void
}

function DragDots() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="shrink-0">
      {[0, 6, 12].map((x) =>
        [0, 6, 12].map((y) => (
          <circle key={`${x}-${y}`} cx={x + 2} cy={y + 4} r={1.5} fill="rgba(255,255,255,0.2)" />
        ))
      )}
    </svg>
  )
}

export function ExercisesTab({ workout, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRestId, setEditingRestId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restInputRef = useRef<HTMLInputElement>(null)
  const groups = workout.exerciseGroups ?? []

  const updateGroups = (next: ExerciseGroup[]) => onChange({ exerciseGroups: next })

  const addGroup = () => {
    const newGroup: ExerciseGroup = { id: generateId(), exercises: [] }
    updateGroups([...groups, newGroup])
  }

  const deleteGroup = (groupId: string) => {
    updateGroups(groups.filter((g) => g.id !== groupId))
  }

  const updateGroup = (groupId: string, exercises: Exercise[]) => {
    updateGroups(groups.map((g) => (g.id === groupId ? { ...g, exercises } : g)))
  }

  const addExercise = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const newEx: Exercise = { id: generateId(), name: '' }
    updateGroup(groupId, [...group.exercises, newEx])
    setEditingId(newEx.id)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const updateExercise = (groupId: string, exId: string, updates: Partial<Exercise>) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    updateGroup(groupId, group.exercises.map((e) => (e.id === exId ? { ...e, ...updates } : e)))
  }

  const removeExercise = (groupId: string, exId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    updateGroup(groupId, group.exercises.filter((e) => e.id !== exId))
    if (editingId === exId) setEditingId(null)
  }

  const commitEdit = (groupId: string, exId: string, name: string) => {
    if (!name.trim()) {
      removeExercise(groupId, exId)
    } else {
      updateExercise(groupId, exId, { name: name.trim() })
    }
    setEditingId(null)
  }

  return (
    <div className="px-5 pb-8">
      {groups.length === 0 && (
        <p className="text-white/25 text-sm py-8 text-center">No groups yet. Add one below.</p>
      )}

      {groups.map((group, gIdx) => (
        <div key={group.id} className="mb-6">
          {/* Group header */}
          <div className="flex items-center justify-between mb-1 pt-5">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: '#4e8fff' }}
            >
              Group {gIdx + 1}
            </span>
            {groups.length > 1 && (
              <button
                onClick={() => deleteGroup(group.id)}
                className="text-white/15 hover:text-red-400/60 transition-colors p-1 -mr-1"
                aria-label="Delete group"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="mb-1" style={{ height: 1, backgroundColor: 'rgba(78,143,255,0.12)' }} />

          {/* Exercises */}
          {group.exercises.length === 0 && (
            <p className="text-white/20 text-sm py-3 pl-1">No exercises yet</p>
          )}

          {group.exercises.map((ex, exIdx) => {
            const isLastEx = exIdx === group.exercises.length - 1
            const hasCustomRest = ex.restTime !== undefined
            return (
              <div key={ex.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-4 py-3.5">
                  <DragDots />

                  {editingId === ex.id ? (
                    <input
                      ref={inputRef}
                      className="flex-1 bg-transparent text-white text-base focus:outline-none border-b border-white/30 pb-0.5"
                      defaultValue={ex.name}
                      placeholder="Exercise name"
                      onBlur={(e) => commitEdit(group.id, ex.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(group.id, ex.id, e.currentTarget.value)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="flex-1 text-left text-white text-base hover:text-white/80 transition-colors"
                      onClick={() => setEditingId(ex.id)}
                    >
                      {ex.name || <span className="text-white/30 italic">Unnamed exercise</span>}
                    </button>
                  )}

                  {/* Per-exercise rest time (only between exercises, not after last) */}
                  {!isLastEx && (
                    <button
                      onClick={() => { setEditingRestId(ex.id); setTimeout(() => restInputRef.current?.focus(), 50) }}
                      className="shrink-0 px-2 py-1 rounded-lg text-xs tabular-nums transition-colors"
                      style={{
                        backgroundColor: hasCustomRest ? 'rgba(0,217,160,0.12)' : 'rgba(255,255,255,0.05)',
                        color: hasCustomRest ? '#00d9a0' : 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {hasCustomRest ? `${ex.restTime}s` : `${workout.restTime}s`}
                    </button>
                  )}

                  <button
                    onClick={() => removeExercise(group.id, ex.id)}
                    className="text-white/15 hover:text-red-400/60 transition-colors p-1 shrink-0"
                    aria-label="Remove exercise"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Inline rest time editor */}
                {!isLastEx && editingRestId === ex.id && (
                  <div className="flex items-center gap-3 pb-3 pl-10">
                    <span className="text-white/30 text-xs">Rest after this exercise:</span>
                    <input
                      ref={restInputRef}
                      type="number"
                      min={0}
                      max={300}
                      defaultValue={ex.restTime ?? workout.restTime}
                      className="w-16 bg-transparent text-white text-sm text-center focus:outline-none border-b border-white/30"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val) && val >= 0) {
                          updateExercise(group.id, ex.id, { restTime: val })
                        }
                        setEditingRestId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEditingRestId(null)
                      }}
                    />
                    <span className="text-white/30 text-xs">sec</span>
                    {hasCustomRest && (
                      <button
                        onClick={() => { updateExercise(group.id, ex.id, { restTime: undefined }); setEditingRestId(null) }}
                        className="text-white/25 text-xs hover:text-white/50 transition-colors"
                      >
                        reset
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Add exercise within group */}
          <button
            onClick={() => addExercise(group.id)}
            className="flex items-center gap-3 py-3 text-white/30 hover:text-white/55 transition-colors"
          >
            <span className="text-lg font-light leading-none">+</span>
            <span className="text-sm">Add exercise</span>
          </button>
        </div>
      ))}

      {/* Add group */}
      <div className="mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={addGroup}
          className="flex items-center gap-3 py-5 w-full transition-colors"
          style={{ color: '#4e8fff', opacity: 0.6 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          <span className="text-xl font-light leading-none">+</span>
          <span className="text-sm font-medium">Add group</span>
        </button>
      </div>
    </div>
  )
}
