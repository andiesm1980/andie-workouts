'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Workout, Phase } from '@/types/workout'
import { playCountdownBeep, playPhaseStart, playComplete } from '@/lib/audio'
import { haptic } from '@/lib/haptics'

interface Segment {
  phase: Exclude<Phase, 'idle' | 'complete'>
  duration: number
  label: string
  round: number
  exerciseIndex: number
  groupIndex: number
}

export function buildSegments(workout: Workout): Segment[] {
  const segments: Segment[] = []
  const intervals = Math.max(1, workout.intervals || 1)
  const rounds = Math.max(1, workout.rounds || 1)
  const cycleBreak = workout.cycleBreak || 0

  if (workout.warmup > 0) {
    segments.push({ phase: 'warmup', duration: workout.warmup, label: 'Get Ready', round: 0, exerciseIndex: 0, groupIndex: -1 })
  }

  if (workout.type === 'hiit') {
    for (let cycle = 1; cycle <= rounds; cycle++) {
      const isLastCycle = cycle === rounds
      for (let interval = 1; interval <= intervals; interval++) {
        const isLastInterval = interval === intervals
        segments.push({ phase: 'work', duration: workout.workTime, label: 'Work', round: cycle, exerciseIndex: interval - 1, groupIndex: 0 })
        if (!isLastInterval) {
          segments.push({ phase: 'rest', duration: workout.restTime, label: 'Rest', round: cycle, exerciseIndex: interval - 1, groupIndex: 0 })
        }
      }
      if (!isLastCycle && cycleBreak > 0) {
        segments.push({ phase: 'break', duration: cycleBreak, label: 'Break', round: cycle, exerciseIndex: 0, groupIndex: 0 })
      }
    }
  } else {
    const groups = workout.exerciseGroups ?? []
    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const group = groups[gIdx]
      const isLastGroup = gIdx === groups.length - 1
      const exCount = (group.exercises ?? []).length

      for (let set = 1; set <= rounds; set++) {
        const isLastSet = set === rounds
        for (let exIdx = 0; exIdx < exCount; exIdx++) {
          const ex = group.exercises[exIdx]
          const isLastEx = exIdx === exCount - 1
          const workDur = ex.workTime ?? workout.workTime
          segments.push({ phase: 'work', duration: workDur, label: ex.name, round: set, exerciseIndex: exIdx, groupIndex: gIdx })
          if (!isLastEx || !isLastSet) {
            const restDur = ex.restTime ?? workout.restTime
            if (restDur > 0) {
              segments.push({ phase: 'rest', duration: restDur, label: 'Rest', round: set, exerciseIndex: exIdx, groupIndex: gIdx })
            }
          }
        }
      }

      if (!isLastGroup && cycleBreak > 0) {
        segments.push({ phase: 'break', duration: cycleBreak, label: 'Break', round: rounds, exerciseIndex: 0, groupIndex: gIdx })
      }
    }
  }

  if (workout.cooldown > 0) {
    segments.push({ phase: 'cooldown', duration: workout.cooldown, label: 'Cool Down', round: 0, exerciseIndex: 0, groupIndex: -1 })
  }

  return segments
}

interface TimerState {
  segmentIndex: number
  timeRemaining: number
  isRunning: boolean
  isComplete: boolean
}

export function useTimer(workout: Workout) {
  const segments = useMemo(() => buildSegments(workout), [workout])

  const [state, setState] = useState<TimerState>({
    segmentIndex: 0,
    timeRemaining: segments[0]?.duration ?? 0,
    isRunning: false,
    isComplete: false,
  })

  const stateRef = useRef(state)
  stateRef.current = state
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments

  // Wall-clock timestamp when the current segment ends. Anchored to the
  // previous segment's end (not Date.now()) so segments never accumulate drift.
  const endAtRef = useRef<number>(0)

  // setTimeout IDs for the 3-2-1 countdown beeps, scheduled precisely
  // relative to endAtRef so they fire exactly when the second changes.
  const beepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearBeeps = useCallback(() => {
    beepTimers.current.forEach(clearTimeout)
    beepTimers.current = []
  }, [])

  const scheduleBeeps = useCallback((endAt: number) => {
    clearBeeps()
    const nowMs = Date.now()
    beepTimers.current = [3, 2, 1].flatMap((sec) => {
      const delay = endAt - nowMs - sec * 1000
      if (delay < 0) return []
      return [setTimeout(() => { playCountdownBeep(); haptic('countdown') }, delay)]
    })
  }, [clearBeeps])

  const advanceSegment = useCallback((fromIndex: number, segs: Segment[]) => {
    const nextIndex = fromIndex + 1
    if (nextIndex >= segs.length) {
      clearBeeps()
      setState((s) => ({ ...s, isRunning: false, isComplete: true, timeRemaining: 0 }))
      playComplete(); haptic('complete')
    } else {
      const dur = segs[nextIndex].duration
      // Anchor to previous endAt to prevent drift accumulation across segments
      endAtRef.current = endAtRef.current + dur * 1000
      scheduleBeeps(endAtRef.current)
      playPhaseStart(); haptic('phase')
      setState((s) => ({ ...s, segmentIndex: nextIndex, timeRemaining: dur }))
    }
  }, [clearBeeps, scheduleBeeps])

  const tick = useCallback(() => {
    const { segmentIndex, isRunning, isComplete } = stateRef.current
    const segs = segmentsRef.current
    if (!isRunning || isComplete) return

    const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))

    if (remaining > 0) {
      setState((s) => ({ ...s, timeRemaining: remaining }))
    } else {
      advanceSegment(segmentIndex, segs)
    }
  }, [advanceSegment])

  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (!state.isRunning) return
    const id = setInterval(() => tickRef.current(), 500)
    return () => clearInterval(id)
  }, [state.isRunning])

  const start = useCallback(() => {
    const endAt = Date.now() + stateRef.current.timeRemaining * 1000
    endAtRef.current = endAt
    scheduleBeeps(endAt)
    setState((s) => ({ ...s, isRunning: true }))
  }, [scheduleBeeps])

  const pause = useCallback(() => {
    clearBeeps()
    setState((s) => ({ ...s, isRunning: false }))
  }, [clearBeeps])

  const toggle = useCallback(() => {
    const s = stateRef.current
    if (s.isRunning) {
      clearBeeps()
      setState((prev) => ({ ...prev, isRunning: false }))
    } else {
      const endAt = Date.now() + s.timeRemaining * 1000
      endAtRef.current = endAt
      scheduleBeeps(endAt)
      setState((prev) => ({ ...prev, isRunning: true }))
    }
  }, [clearBeeps, scheduleBeeps])

  const reset = useCallback(() => {
    clearBeeps()
    endAtRef.current = 0
    setState({ segmentIndex: 0, timeRemaining: segmentsRef.current[0]?.duration ?? 0, isRunning: false, isComplete: false })
  }, [clearBeeps])

  const skipToNext = useCallback(() => {
    clearBeeps()
    advanceSegment(stateRef.current.segmentIndex, segmentsRef.current)
  }, [advanceSegment, clearBeeps])

  const skipToPrev = useCallback(() => {
    clearBeeps()
    const { segmentIndex, timeRemaining } = stateRef.current
    const segs = segmentsRef.current
    const currentDuration = segs[segmentIndex]?.duration ?? 0
    const elapsed = currentDuration - timeRemaining
    if (elapsed > 2 || segmentIndex === 0) {
      const endAt = Date.now() + currentDuration * 1000
      endAtRef.current = endAt
      scheduleBeeps(endAt)
      setState((s) => ({ ...s, timeRemaining: currentDuration }))
    } else {
      const prevIndex = segmentIndex - 1
      const dur = segs[prevIndex].duration
      const endAt = Date.now() + dur * 1000
      endAtRef.current = endAt
      scheduleBeeps(endAt)
      playPhaseStart()
      setState((s) => ({ ...s, segmentIndex: prevIndex, timeRemaining: dur }))
    }
  }, [clearBeeps, scheduleBeeps])

  const currentSegment = segments[state.segmentIndex]
  const totalDuration = currentSegment?.duration ?? 1
  const progress = 1 - state.timeRemaining / totalDuration

  return {
    phase: state.isComplete ? ('complete' as Phase) : (currentSegment?.phase ?? ('idle' as Phase)),
    timeRemaining: state.timeRemaining,
    totalTime: totalDuration,
    currentRound: currentSegment?.round ?? 0,
    totalRounds: workout.rounds,
    currentGroup: (currentSegment?.groupIndex ?? -1) + 1,
    totalGroups: (workout.exerciseGroups ?? []).length,
    exerciseName: currentSegment?.label ?? '',
    exerciseIndex: currentSegment?.exerciseIndex ?? 0,
    isRunning: state.isRunning,
    isComplete: state.isComplete,
    progress,
    segments,
    segmentIndex: state.segmentIndex,
    start,
    pause,
    toggle,
    reset,
    skipToPrev,
    skipToNext,
  }
}
