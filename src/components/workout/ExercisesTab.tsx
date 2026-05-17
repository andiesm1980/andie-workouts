'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

interface DragState {
  groupId: string
  exId: string
  fromIdx: number
}

export function ExercisesTab({ workout, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingExtra, setEditingExtra] = useState<{ id: string; field: 'work' | 'rest' } | null>(null)
  const [editingGroupRest, setEditingGroupRest] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const extraInputRef = useRef<HTMLInputElement>(null)
  const groupRestInputRef = useRef<HTMLInputElement>(null)
  const rowEls = useRef<Map<string, HTMLElement>>(new Map())
  const activeDragRef = useRef(activeDrag)
  const dropTargetRef = useRef(dropTarget)
  activeDragRef.current = activeDrag
  dropTargetRef.current = dropTarget

  const groups = workout.exerciseGroups ?? []

  const updateGroups = (next: ExerciseGroup[]) => onChange({ exerciseGroups: next })

  const addGroup = () => {
    const newGroup: ExerciseGroup = { id: generateId(), exercises: [] }
    updateGroups([...groups, newGroup])
  }

  const deleteGroup = (groupId: string) => {
    updateGroups(groups.filter((g) => g.id !== groupId))
  }

  const updateGroup = useCallback((groupId: string, exercises: Exercise[]) => {
    onChange({ exerciseGroups: (workout.exerciseGroups ?? []).map((g) => (g.id === groupId ? { ...g, exercises } : g)) })
  }, [workout.exerciseGroups, onChange])

  const updateGroupRest = (groupId: string, restAfter: number | undefined) => {
    updateGroups(groups.map((g) => (g.id === groupId ? { ...g, restAfter } : g)))
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
    if (editingExtra?.id === exId) setEditingExtra(null)
  }

  const commitEdit = (groupId: string, exId: string, name: string) => {
    if (!name.trim()) {
      removeExercise(groupId, exId)
    } else {
      updateExercise(groupId, exId, { name: name.trim() })
    }
    setEditingId(null)
  }

  // Drag-to-reorder via pointer events
  const startDrag = (e: React.PointerEvent, groupId: string, exId: string, fromIdx: number) => {
    e.preventDefault()
    setActiveDrag({ groupId, exId, fromIdx })
    setDropTarget(fromIdx)
  }

  useEffect(() => {
    if (!activeDrag) return

    const handleMove = (e: PointerEvent) => {
      e.preventDefault()
      const drag = activeDragRef.current
      if (!drag) return
      const currentGroups = workout.exerciseGroups ?? []
      const group = currentGroups.find((g) => g.id === drag.groupId)
      if (!group) return
      const exes = group.exercises ?? []
      const y = e.clientY
      let target = exes.length
      for (let i = 0; i < exes.length; i++) {
        const el = rowEls.current.get(exes[i].id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) { target = i; break }
      }
      setDropTarget(target)
    }

    const handleUp = () => {
      const drag = activeDragRef.current
      const drop = dropTargetRef.current
      if (drag && drop !== null && drop !== drag.fromIdx && drop !== drag.fromIdx + 1) {
        const currentGroups = workout.exerciseGroups ?? []
        const group = currentGroups.find((g) => g.id === drag.groupId)
        if (group) {
          const newExs = [...(group.exercises ?? [])]
          const [moved] = newExs.splice(drag.fromIdx, 1)
          newExs.splice(drop > drag.fromIdx ? drop - 1 : drop, 0, moved)
          updateGroup(drag.groupId, newExs)
        }
      }
      setActiveDrag(null)
      setDropTarget(null)
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [activeDrag]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-5 pb-8" style={{ userSelect: activeDrag ? 'none' : undefined }}>
      {groups.length === 0 && (
        <p className="text-white/25 text-sm py-8 text-center">No supersets yet. Add one below.</p>
      )}

      {groups.map((group, gIdx) => {
        const isDraggingGroup = activeDrag?.groupId === group.id

        return (
          <div key={group.id} className="mb-2">
            {/* Superset header */}
            <div className="flex items-center justify-between mb-1 pt-5">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4e8fff' }}>
                Superset {gIdx + 1}
              </span>
              {groups.length > 1 && (
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-white/15 hover:text-red-400/60 transition-colors p-1 -mr-1"
                  aria-label="Delete superset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            <div className="mb-1" style={{ height: 1, backgroundColor: 'rgba(78,143,255,0.12)' }} />

            {group.exercises.length === 0 && (
              <p className="text-white/20 text-sm py-3 pl-1">No exercises yet</p>
            )}

            {group.exercises.map((ex, exIdx) => {
              const isDragging = activeDrag?.exId === ex.id
              const showDropAbove = isDraggingGroup && dropTarget === exIdx &&
                !(dropTarget === activeDrag?.fromIdx || dropTarget === activeDrag?.fromIdx + 1)
              const hasCustomWork = ex.workTime !== undefined
              const hasCustomRest = ex.restTime !== undefined
              const isLastEx = exIdx === group.exercises.length - 1
              const isEditingWork = editingExtra?.id === ex.id && editingExtra.field === 'work'
              const isEditingRest = editingExtra?.id === ex.id && editingExtra.field === 'rest'

              const openExtra = (field: 'work' | 'rest') => {
                setEditingExtra({ id: ex.id, field })
                setTimeout(() => extraInputRef.current?.focus(), 50)
              }

              return (
                <div
                  key={ex.id}
                  ref={(el) => { if (el) rowEls.current.set(ex.id, el); else rowEls.current.delete(ex.id) }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {showDropAbove && (
                    <div style={{ height: 2, backgroundColor: '#4e8fff', borderRadius: 1 }} />
                  )}

                  <div
                    className="flex items-center gap-3 py-3.5"
                    style={{ opacity: isDragging ? 0.3 : 1, transition: isDragging ? 'none' : 'opacity 0.15s' }}
                  >
                    <div
                      onPointerDown={(e) => startDrag(e, group.id, ex.id, exIdx)}
                      style={{ cursor: activeDrag ? 'grabbing' : 'grab', touchAction: 'none' }}
                      className="shrink-0"
                    >
                      <DragDots />
                    </div>

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
                        className="flex-1 text-left text-white text-base hover:text-white/80 transition-colors min-w-0 truncate"
                        onClick={() => setEditingId(ex.id)}
                      >
                        {ex.name || <span className="text-white/30 italic">Unnamed</span>}
                      </button>
                    )}

                    {/* Work time badge */}
                    <button
                      onClick={() => openExtra('work')}
                      className="shrink-0 px-2 py-1 rounded-lg text-xs tabular-nums transition-colors"
                      style={{
                        backgroundColor: hasCustomWork ? 'rgba(240,64,122,0.12)' : 'rgba(255,255,255,0.05)',
                        color: hasCustomWork ? '#f0407a' : 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {hasCustomWork ? `${ex.workTime}s` : `${workout.workTime}s`}
                    </button>

                    {/* Rest time badge (between exercises) */}
                    {!isLastEx && (
                      <button
                        onClick={() => openExtra('rest')}
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

                  {/* Inline editor for work or rest time */}
                  {(isEditingWork || isEditingRest) && (
                    <div className="flex items-center gap-3 pb-3 pl-10">
                      <span className="text-white/30 text-xs">
                        {isEditingWork ? 'Work time:' : 'Rest after:'}
                      </span>
                      <input
                        ref={extraInputRef}
                        type="number"
                        min={isEditingWork ? 5 : 0}
                        max={isEditingWork ? 3600 : 300}
                        step={5}
                        defaultValue={isEditingWork ? (ex.workTime ?? workout.workTime) : (ex.restTime ?? workout.restTime)}
                        className="w-16 bg-transparent text-white text-sm text-center focus:outline-none border-b border-white/30"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val) && val >= 0) {
                            updateExercise(group.id, ex.id, isEditingWork ? { workTime: val } : { restTime: val })
                          }
                          setEditingExtra(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditingExtra(null)
                        }}
                      />
                      <span className="text-white/30 text-xs">sec</span>
                      {(isEditingWork ? hasCustomWork : hasCustomRest) && (
                        <button
                          onClick={() => {
                            updateExercise(group.id, ex.id, isEditingWork ? { workTime: undefined } : { restTime: undefined })
                            setEditingExtra(null)
                          }}
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

            {/* Drop indicator at end of exercise list */}
            {isDraggingGroup && dropTarget === group.exercises.length && (
              <div style={{ height: 2, backgroundColor: '#4e8fff', borderRadius: 1, margin: '2px 0' }} />
            )}

            {/* Add exercise */}
            <button
              onClick={() => addExercise(group.id)}
              className="flex items-center gap-3 py-3 text-white/30 hover:text-white/55 transition-colors"
            >
              <span className="text-lg font-light leading-none">+</span>
              <span className="text-sm">Add exercise</span>
            </button>

            {/* Superset rest — shown between supersets */}
            {groups.length > 1 && gIdx < groups.length - 1 && (
              <div style={{ borderTop: '1px solid rgba(78,143,255,0.08)', marginTop: 4 }}>
                {editingGroupRest === group.id ? (
                  <div className="flex items-center gap-3 py-3">
                    <span className="text-white/30 text-xs flex-1">Rest after superset</span>
                    <input
                      ref={groupRestInputRef}
                      type="number"
                      min={0}
                      max={600}
                      step={5}
                      defaultValue={group.restAfter ?? workout.cycleBreak}
                      className="w-14 bg-transparent text-white text-sm text-center focus:outline-none border-b border-white/30"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        updateGroupRest(group.id, isNaN(val) ? undefined : Math.max(0, val))
                        setEditingGroupRest(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEditingGroupRest(null)
                      }}
                      autoFocus
                    />
                    <span className="text-white/30 text-xs">sec</span>
                    {group.restAfter !== undefined && (
                      <button
                        onClick={() => { updateGroupRest(group.id, undefined); setEditingGroupRest(null) }}
                        className="text-white/25 text-xs hover:text-white/50 transition-colors"
                      >
                        reset
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingGroupRest(group.id)
                      setTimeout(() => groupRestInputRef.current?.focus(), 50)
                    }}
                    className="flex items-center justify-between w-full py-3"
                  >
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Rest after superset</span>
                    <span
                      className="px-2 py-1 rounded-lg text-xs tabular-nums"
                      style={{
                        backgroundColor: group.restAfter !== undefined ? 'rgba(0,217,160,0.12)' : 'rgba(255,255,255,0.05)',
                        color: group.restAfter !== undefined ? '#00d9a0' : 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {group.restAfter !== undefined ? `${group.restAfter}s` : `${workout.cycleBreak}s`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add superset */}
      <div className="mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={addGroup}
          className="flex items-center gap-3 py-5 w-full transition-colors"
          style={{ color: '#4e8fff', opacity: 0.6 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          <span className="text-xl font-light leading-none">+</span>
          <span className="text-sm font-medium">Add superset</span>
        </button>
      </div>
    </div>
  )
}
