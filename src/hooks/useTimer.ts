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
          // rest between exercises, AND after the last exercise before the next set starts
          if (!isLastEx || !isLastSet) {
            const restDur = ex.restTime ?? workout.restTime
            segments.push({ phase: 'rest', duration: restDur, label: 'Rest', round: set, exerciseIndex: exIdx, groupIndex: gIdx })
          }
        }
        if (!isLastSet && cycleBreak > 0) {
          segments.push({ phase: 'break', duration: cycleBreak, label: 'Break', round: set, exerciseIndex: 0, groupIndex: gIdx })
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

  const tick = useCallback(() => {
    const { segmentIndex, timeRemaining, isRunning, isComplete } = stateRef.current
    const segs = segmentsRef.current
    if (!isRunning || isComplete) return

    if (timeRemaining > 1) {
      if (timeRemaining <= 4) { playCountdownBeep(); haptic('countdown') }
      setState((s) => ({ ...s, timeRemaining: s.timeRemaining - 1 }))
    } else {
      const nextIndex = segmentIndex + 1
      if (nextIndex >= segs.length) {
        setState((s) => ({ ...s, isRunning: false, isComplete: true, timeRemaining: 0 }))
        playComplete(); haptic('complete')
      } else {
        playPhaseStart(); haptic('phase')
        setState((s) => ({ ...s, segmentIndex: nextIndex, timeRemaining: segs[nextIndex].duration }))
      }
    }
  }, [])

  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (!state.isRunning) return
    const id = setInterval(() => tickRef.current(), 1000)
    return () => clearInterval(id)
  }, [state.isRunning])

  const start = useCallback(() => setState((s) => ({ ...s, isRunning: true })), [])
  const pause = useCallback(() => setState((s) => ({ ...s, isRunning: false })), [])
  const toggle = useCallback(() => setState((s) => ({ ...s, isRunning: !s.isRunning })), [])

  const reset = useCallback(() => {
    setState({ segmentIndex: 0, timeRemaining: segmentsRef.current[0]?.duration ?? 0, isRunning: false, isComplete: false })
  }, [])

  const skipToNext = useCallback(() => {
    const { segmentIndex } = stateRef.current
    const segs = segmentsRef.current
    const nextIndex = segmentIndex + 1
    if (nextIndex >= segs.length) {
      setState((s) => ({ ...s, isRunning: false, isComplete: true, timeRemaining: 0 }))
      playComplete()
    } else {
      playPhaseStart()
      setState((s) => ({ ...s, segmentIndex: nextIndex, timeRemaining: segs[nextIndex].duration }))
    }
  }, [])

  const skipToPrev = useCallback(() => {
    const { segmentIndex, timeRemaining } = stateRef.current
    const segs = segmentsRef.current
    const currentDuration = segs[segmentIndex]?.duration ?? 0
    const elapsed = currentDuration - timeRemaining
    if (elapsed > 2 || segmentIndex === 0) {
      setState((s) => ({ ...s, timeRemaining: currentDuration }))
    } else {
      const prevIndex = segmentIndex - 1
      playPhaseStart()
      setState((s) => ({ ...s, segmentIndex: prevIndex, timeRemaining: segs[prevIndex].duration }))
    }
  }, [])

  const skipToNextExercise = useCallback(() => {
    const { segmentIndex } = stateRef.current
    const segs = segmentsRef.current
    const nextWork = segs.findIndex((s, i) => i > segmentIndex && s.phase === 'work')
    if (nextWork === -1) {
      setState((s) => ({ ...s, isRunning: false, isComplete: true, timeRemaining: 0 }))
      playComplete()
    } else {
      playPhaseStart()
      setState((s) => ({ ...s, segmentIndex: nextWork, timeRemaining: segs[nextWork].duration }))
    }
  }, [])

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
    skipToNextExercise,
  }
}
