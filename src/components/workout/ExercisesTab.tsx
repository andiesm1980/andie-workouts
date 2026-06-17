'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
interface ExDropTarget { groupId: string; idx: number }
interface GroupDragState { fromIdx: number }

function isExDropNoop(drag: ExDragState, drop: ExDropTarget): boolean {
  return drop.groupId === drag.groupId &&
    (drop.idx === drag.fromIdx || drop.idx === drag.fromIdx + 1)
}

export function ExercisesTab({ workout, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingExtra, setEditingExtra] = useState<{ id: string; field: 'work' | 'rest' } | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [editingGroupRounds, setEditingGroupRounds] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const extraInputRef = useRef<HTMLInputElement>(null)
  const notesInputRef = useRef<HTMLInputElement>(null)
  const groupRoundsInputRef = useRef<HTMLInputElement>(null)
  const rowEls = useRef<Map<string, HTMLElement>>(new Map())
  const groupEls = useRef<Map<string, HTMLElement>>(new Map())

  const groups = workout.exerciseGroups ?? []
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const updateGroups = useCallback((next: ExerciseGroup[]) => onChange({ exerciseGroups: next }), [onChange])
  const updateGroupsRef = useRef(updateGroups)
  updateGroupsRef.current = updateGroups

  const updateGroup = useCallback((groupId: string, exercises: Exercise[]) => {
    onChange({ exerciseGroups: (workout.exerciseGroups ?? []).map((g) => (g.id === groupId ? { ...g, exercises } : g)) })
  }, [workout.exerciseGroups, onChange])

  const updateGroupRounds = useCallback((groupId: string, rounds: number | undefined) => {
    updateGroups((workout.exerciseGroups ?? []).map((g) => (g.id === groupId ? { ...g, rounds } : g)))
  }, [workout.exerciseGroups, updateGroups])

  // Cross-group exercise drag
  const [exDragActive, setExDragActive] = useState<ExDragState | null>(null)
  const [exDropTarget, setExDropTarget] = useState<ExDropTarget | null>(null)
  const exDragActiveRef = useRef<ExDragState | null>(null)
  const exDropTargetRef = useRef<ExDropTarget | null>(null)

  useEffect(() => {
    if (!exDragActive) return

    const computeTarget = (y: number): ExDropTarget | null => {
      const currentGroups = groupsRef.current
      if (!currentGroups.length) return null

      // Find which group the pointer is in, or the nearest one
      let bestGroupId: string | null = null
      let bestDist = Infinity
      for (const group of currentGroups) {
        const el = groupEls.current.get(group.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y >= rect.top && y <= rect.bottom) { bestGroupId = group.id; break }
        const dist = y < rect.top ? rect.top - y : y - rect.bottom
        if (dist < bestDist) { bestDist = dist; bestGroupId = group.id }
      }
      if (!bestGroupId) return null

      const group = currentGroups.find((g) => g.id === bestGroupId)!
      let target = group.exercises.length
      for (let i = 0; i < group.exercises.length; i++) {
        const el = rowEls.current.get(group.exercises[i].id)
        if (!el) continue
        if (y < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) { target = i; break }
      }
      return { groupId: bestGroupId, idx: target }
    }

    const move = (e: PointerEvent) => {
      e.preventDefault()
      const t = computeTarget(e.clientY)
      if (t) { setExDropTarget(t); exDropTargetRef.current = t }
    }

    const up = () => {
      const drag = exDragActiveRef.current
      const drop = exDropTargetRef.current
      if (drag && drop && !isExDropNoop(drag, drop)) {
        const newGroups = groupsRef.current.map((g) => ({ ...g, exercises: [...g.exercises] }))
        const src = newGroups.find((g) => g.id === drag.groupId)
        const dst = newGroups.find((g) => g.id === drop.groupId)
        if (src && dst) {
          const [moved] = src.exercises.splice(drag.fromIdx, 1)
          const isSame = drop.groupId === drag.groupId
          const insertIdx = isSame && drop.idx > drag.fromIdx ? drop.idx - 1 : drop.idx
          dst.exercises.splice(insertIdx, 0, moved)
          updateGroupsRef.current(newGroups)
        }
      }
      setExDragActive(null); exDragActiveRef.current = null
      setExDropTarget(null); exDropTargetRef.current = null
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [exDragActive]) // eslint-disable-line react-hooks/exhaustive-deps

  const startExDrag = (e: React.PointerEvent, groupId: string, exId: string, fromIdx: number) => {
    e.preventDefault()
    const state: ExDragState = { groupId, exId, fromIdx }
    setExDragActive(state); exDragActiveRef.current = state
    const initial: ExDropTarget = { groupId, idx: fromIdx }
    setExDropTarget(initial); exDropTargetRef.current = initial
  }

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
    setEditingNotes(null)
  }

  const isDraggingAny = !!exDragActive || !!groupDrag.active

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
              <button
                onClick={() => { setEditingGroupRounds(group.id); setTimeout(() => groupRoundsInputRef.current?.focus(), 50) }}
                className="shrink-0 px-2 py-1 rounded-lg text-xs tabular-nums transition-colors"
                style={{
                  backgroundColor: group.rounds !== undefined ? 'rgba(78,143,255,0.18)' : 'rgba(255,255,255,0.05)',
                  color: group.rounds !== undefined ? '#4e8fff' : 'rgba(255,255,255,0.2)',
                }}
              >
                {group.rounds ?? workout.rounds}×
              </button>
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

            {editingGroupRounds === group.id && (
              <div className="flex items-center gap-3 py-2 pl-1 mb-1">
                <span className="text-white/30 text-xs">Sets:</span>
                <input
                  ref={groupRoundsInputRef}
                  type="number"
                  min={1} max={20} step={1}
                  defaultValue={group.rounds ?? workout.rounds}
                  className="w-12 bg-transparent text-white text-sm text-center focus:outline-none border-b border-white/30"
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val) && val >= 1) updateGroupRounds(group.id, val)
                    setEditingGroupRounds(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditingGroupRounds(null)
                  }}
                />
                <span className="text-white/30 text-xs">sets</span>
                {group.rounds !== undefined && (
                  <button
                    onPointerDown={(e) => { e.preventDefault(); updateGroupRounds(group.id, undefined); setEditingGroupRounds(null) }}
                    className="text-white/25 text-xs hover:text-white/50 transition-colors"
                  >
                    reset to global
                  </button>
                )}
              </div>
            )}

            {group.exercises.length === 0 && (
              <p className="text-white/20 text-sm py-3 pl-1">No exercises yet</p>
            )}

            {group.exercises.map((ex, exIdx) => {
              const isDragging = exDragActive?.exId === ex.id
              const showDropAbove = exDragActive !== null &&
                exDropTarget?.groupId === group.id &&
                exDropTarget?.idx === exIdx &&
                !isExDropNoop(exDragActive, exDropTarget)
              const hasCustomWork = ex.workTime !== undefined
              const hasCustomRest = ex.restTime !== undefined
              const isLastEx = exIdx === group.exercises.length - 1
              const isEditingWork = editingExtra?.id === ex.id && editingExtra.field === 'work'
              const isEditingRest = editingExtra?.id === ex.id && editingExtra.field === 'rest'

              const openExtra = (field: 'work' | 'rest') => {
                setEditingExtra({ id: ex.id, field })
                setEditingNotes(null)
                setTimeout(() => extraInputRef.current?.focus(), 50)
              }

              const openNotes = () => {
                setEditingNotes(ex.id)
                setEditingId(null)
                setEditingExtra(null)
                setTimeout(() => notesInputRef.current?.focus(), 50)
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
                      onPointerDown={(e) => startExDrag(e, group.id, ex.id, exIdx)}
                      style={{ cursor: exDragActive ? 'grabbing' : 'grab', touchAction: 'none' }}
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
                        onClick={() => { setEditingId(ex.id); setEditingNotes(null) }}
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

                    <button
                      onClick={openNotes}
                      className="shrink-0 p-1 transition-colors"
                      aria-label="Form cue"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        stroke={ex.notes ? '#f0407a' : 'rgba(255,255,255,0.2)'}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>

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

                  {isEditingWork && (
                    <div className="flex items-center gap-3 pb-3 pl-10">
                      <span className="text-white/30 text-xs">Work time:</span>
                      <input
                        ref={extraInputRef}
                        type="number"
                        min={5} max={3600} step={5}
                        defaultValue={ex.workTime ?? workout.workTime}
                        className="w-16 bg-transparent text-white text-sm text-center focus:outline-none border-b border-white/30"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val) && val >= 5) updateExercise(group.id, ex.id, { workTime: val })
                          setEditingExtra(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditingExtra(null)
                        }}
                      />
                      <span className="text-white/30 text-xs">sec</span>
                      {hasCustomWork && (
                        <button
                          onPointerDown={(e) => { e.preventDefault(); updateExercise(group.id, ex.id, { workTime: undefined }); setEditingExtra(null) }}
                          className="text-white/25 text-xs hover:text-white/50 transition-colors">reset</button>
                      )}
                    </div>
                  )}

                  {editingNotes === ex.id && (
                    <div className="flex items-center gap-3 pb-3 pl-10">
                      <span className="text-white/30 text-xs">Form cue:</span>
                      <input
                        ref={notesInputRef}
                        type="text"
                        defaultValue={ex.notes ?? ''}
                        placeholder="e.g. keep hips square"
                        className="flex-1 bg-transparent text-white/70 text-sm focus:outline-none border-b border-white/20 pb-0.5"
                        onBlur={(e) => {
                          const val = e.target.value.trim()
                          updateExercise(group.id, ex.id, { notes: val || undefined })
                          setEditingNotes(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditingNotes(null)
                        }}
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Rest separator between this exercise and the next */}
                  {!isLastEx && (
                    isEditingRest ? (
                      <div className="flex items-center gap-3 py-2 pl-10">
                        <span className="text-white/30 text-xs">Rest:</span>
                        <input
                          ref={extraInputRef}
                          type="number"
                          min={0} max={300} step={5}
                          defaultValue={ex.restTime ?? workout.restTime}
                          className="w-16 bg-transparent text-white text-sm text-center focus:outline-none border-b border-white/30"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value)
                            if (!isNaN(val) && val >= 0) updateExercise(group.id, ex.id, { restTime: val })
                            setEditingExtra(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') setEditingExtra(null)
                          }}
                          autoFocus
                        />
                        <span className="text-white/30 text-xs">sec</span>
                        {hasCustomRest && (
                          <button
                            onPointerDown={(e) => { e.preventDefault(); updateExercise(group.id, ex.id, { restTime: undefined }); setEditingExtra(null) }}
                            className="text-white/25 text-xs hover:text-white/50 transition-colors">reset</button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => openExtra('rest')}
                        className="flex items-center w-full py-1 gap-2 group"
                      >
                        <div className="h-px flex-1 ml-9 transition-colors" style={{ backgroundColor: hasCustomRest ? 'rgba(0,217,160,0.25)' : 'rgba(255,255,255,0.06)' }} />
                        <span className="text-xs tabular-nums transition-colors shrink-0"
                          style={{ color: hasCustomRest ? (ex.restTime === 0 ? 'rgba(255,255,255,0.2)' : '#00d9a0') : 'rgba(255,255,255,0.2)' }}>
                          {ex.restTime === 0 ? 'no rest' : `rest ${ex.restTime ?? workout.restTime}s`}
                        </span>
                        <div className="h-px flex-1 mr-1 transition-colors" style={{ backgroundColor: hasCustomRest ? 'rgba(0,217,160,0.25)' : 'rgba(255,255,255,0.06)' }} />
                      </button>
                    )
                  )}
                </div>
              )
            })}

            {/* Drop indicator at end of exercise list */}
            {exDragActive !== null &&
              exDropTarget?.groupId === group.id &&
              exDropTarget?.idx === group.exercises.length &&
              !isExDropNoop(exDragActive, exDropTarget) && (
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
