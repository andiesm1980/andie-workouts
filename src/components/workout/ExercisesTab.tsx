'use client'

import { useState, useRef, useCallback } from 'react'
import type { Workout, ExerciseGroup, Exercise } from '@/types/workout'
import { generateId } from '@/lib/workoutUtils'
import { useDrag } from '@/hooks/useDrag'

interface Props {
  workout: Workout
  onChange: (updates: Partial<Workout>) => void
}

function DragDots({ small }: { small?: boolean }) {
  const r = small ? 1.2 : 1.5
  const gap = small ? 5 : 6
  return (
    <svg width={small ? 12 : 16} height={small ? 16 : 20} viewBox={`0 0 16 20`} fill="none" className="shrink-0">
      {[0, gap, gap * 2].map((x) =>
        [0, gap, gap * 2].map((y) => (
          <circle key={`${x}-${y}`} cx={x + 2} cy={y + 4} r={r} fill="rgba(255,255,255,0.2)" />
        ))
      )}
    </svg>
  )
}

interface ExDragState { groupId: string; exId: string; fromIdx: number }
interface GroupDragState { fromIdx: number }

export function ExercisesTab({ workout, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingExtra, setEditingExtra] = useState<{ id: string; field: 'work' | 'rest' } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const extraInputRef = useRef<HTMLInputElement>(null)
  const rowEls = useRef<Map<string, HTMLElement>>(new Map())
  const groupEls = useRef<Map<string, HTMLElement>>(new Map())

  const groups = workout.exerciseGroups ?? []

  const updateGroups = useCallback((next: ExerciseGroup[]) => onChange({ exerciseGroups: next }), [onChange])

  const updateGroup = useCallback((groupId: string, exercises: Exercise[]) => {
    onChange({ exerciseGroups: (workout.exerciseGroups ?? []).map((g) => (g.id === groupId ? { ...g, exercises } : g)) })
  }, [workout.exerciseGroups, onChange])

  // Exercise drag-to-reorder
  const exDrag = useDrag<ExDragState>(
    (drag, drop) => {
      const group = (workout.exerciseGroups ?? []).find((g) => g.id === drag.groupId)
      if (!group) return
      const newExs = [...(group.exercises ?? [])]
      const [moved] = newExs.splice(drag.fromIdx, 1)
      newExs.splice(drop > drag.fromIdx ? drop - 1 : drop, 0, moved)
      updateGroup(drag.groupId, newExs)
    },
    (y, drag) => {
      const group = (workout.exerciseGroups ?? []).find((g) => g.id === drag.groupId)
      if (!group) return drag.fromIdx
      const exes = group.exercises ?? []
      let target = exes.length
      for (let i = 0; i < exes.length; i++) {
        const el = rowEls.current.get(exes[i].id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) { target = i; break }
      }
      return target
    }
  )

  // Superset drag-to-reorder
  const groupDrag = useDrag<GroupDragState>(
    (drag, drop) => {
      const newGroups = [...(workout.exerciseGroups ?? [])]
      const [moved] = newGroups.splice(drag.fromIdx, 1)
      newGroups.splice(drop > drag.fromIdx ? drop - 1 : drop, 0, moved)
      updateGroups(newGroups)
    },
    (y, drag) => {
      const currentGroups = workout.exerciseGroups ?? []
      let target = currentGroups.length
      for (let i = 0; i < currentGroups.length; i++) {
        const el = groupEls.current.get(currentGroups[i].id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) { target = i; break }
      }
      return target
    }
  )

  const addGroup = () => {
    updateGroups([...groups, { id: generateId(), exercises: [] }])
  }

  const deleteGroup = (groupId: string) => updateGroups(groups.filter((g) => g.id !== groupId))

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
    if (!name.trim()) removeExercise(groupId, exId)
    else updateExercise(groupId, exId, { name: name.trim() })
    setEditingId(null)
  }

  const isDraggingAny = !!exDrag.active || !!groupDrag.active

  return (
    <div className="px-5 pb-8" style={{ userSelect: isDraggingAny ? 'none' : undefined }}>
      {groups.length === 0 && (
        <p className="text-white/25 text-sm py-8 text-center">No supersets yet. Add one below.</p>
      )}

      {groups.map((group, gIdx) => {
        const isDraggingThisGroup = groupDrag.active?.fromIdx === gIdx
        const showGroupDropAbove = groupDrag.active !== null &&
          groupDrag.dropTarget === gIdx &&
          !(groupDrag.dropTarget === groupDrag.active.fromIdx || groupDrag.dropTarget === groupDrag.active.fromIdx + 1)
        const isDraggingExInThisGroup = exDrag.active?.groupId === group.id

        return (
          <div
            key={group.id}
            ref={(el) => { if (el) groupEls.current.set(group.id, el); else groupEls.current.delete(group.id) }}
            className="mb-2"
            style={{ opacity: isDraggingThisGroup ? 0.3 : 1, transition: isDraggingThisGroup ? 'none' : 'opacity 0.15s' }}
          >
            {/* Drop indicator above group */}
            {showGroupDropAbove && (
              <div style={{ height: 2, backgroundColor: '#4e8fff', borderRadius: 1, margin: '4px 0' }} />
            )}

            {/* Superset header */}
            <div className="flex items-center gap-2 mb-1 pt-5">
              {/* Superset drag handle */}
              <div
                onPointerDown={(e) => groupDrag.start(e, { fromIdx: gIdx })}
                style={{ cursor: groupDrag.active ? 'grabbing' : 'grab', touchAction: 'none' }}
                className="shrink-0 -ml-1"
              >
                <DragDots small />
              </div>
              <span className="flex-1 text-xs font-semibold tracking-widest uppercase" style={{ color: '#4e8fff' }}>
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
              const isDragging = exDrag.active?.exId === ex.id
              const showDropAbove = isDraggingExInThisGroup && exDrag.dropTarget === exIdx &&
                !(exDrag.dropTarget === exDrag.active?.fromIdx || exDrag.dropTarget === exDrag.active!.fromIdx + 1)
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
                      onPointerDown={(e) => exDrag.start(e, { groupId: group.id, exId: ex.id, fromIdx: exIdx })}
                      style={{ cursor: exDrag.active ? 'grabbing' : 'grab', touchAction: 'none' }}
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

                    {(!isLastEx || workout.rounds > 1) && (
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

                  {(isEditingWork || isEditingRest) && (
                    <div className="flex items-center gap-3 pb-3 pl-10">
                      <span className="text-white/30 text-xs">{isEditingWork ? 'Work time:' : 'Rest after:'}</span>
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
            {isDraggingExInThisGroup && exDrag.dropTarget === group.exercises.length && (
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

          </div>
        )
      })}

      {/* Drop indicator at end of group list */}
      {groupDrag.active !== null && groupDrag.dropTarget === groups.length && (
        <div style={{ height: 2, backgroundColor: '#4e8fff', borderRadius: 1, margin: '4px 0' }} />
      )}

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
