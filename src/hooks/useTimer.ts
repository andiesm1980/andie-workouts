'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Workout, Phase } from '@/types/workout'
import { scheduleCountdown, playPhaseStart, playComplete, speakText, stopSpeech, initAudio, logTiming } from '@/lib/audio'
import { haptic } from '@/lib/haptics'
import { usesGroups, notesWithSets } from '@/lib/workoutUtils'

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
      const groupRounds = group.rounds ?? rounds

      for (let set = 1; set <= groupRounds; set++) {
        const isLastSet = set === groupRounds
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
      // Break once after all rounds are done, before the next group
      if (!isLastGroup && cycleBreak > 0) {
        segments.push({ phase: 'break', duration: cycleBreak, label: 'Break', round: groupRounds, exerciseIndex: 0, groupIndex: gIdx })
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
  const workoutRef = useRef(workout)
  workoutRef.current = workout
  const spokenNotesRef = useRef<Set<string>>(new Set())

  // Wall-clock timestamp when the current segment ends. Anchored to the
  // previous segment's end (not Date.now()) so segments never accumulate drift.
  const endAtRef = useRef<number>(0)

  // The 3-2-1 beeps themselves play on the audio clock (scheduleCountdown); these
  // setTimeouts only arm them a few seconds ahead and drive the haptics, where a
  // little JS timer jitter doesn't matter.
  const beepTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const cancelCountdownRef = useRef<(() => void) | null>(null)

  const clearBeeps = useCallback(() => {
    beepTimers.current.forEach(clearTimeout)
    beepTimers.current = []
    cancelCountdownRef.current?.()
    cancelCountdownRef.current = null
  }, [])

  const scheduleBeeps = useCallback((endAt: number) => {
    clearBeeps()
    const nowMs = Date.now()
    // Arm close to the countdown so an audio interruption earlier in the segment can't shift it
    const arm = () => { cancelCountdownRef.current = scheduleCountdown(endAt) }
    const armDelay = endAt - nowMs - 4500
    if (armDelay <= 0) arm()
    else beepTimers.current.push(setTimeout(arm, armDelay))
    beepTimers.current.push(...[3, 2, 1].flatMap((sec) => {
      const delay = endAt - nowMs - sec * 1000
      if (delay < 0) return []
      // Cut any long spoken note so it doesn't talk over the countdown
      return [setTimeout(() => { if (sec === 3) stopSpeech(); haptic('countdown') }, delay)]
    }))
  }, [clearBeeps])

  // Stop pending beeps when leaving the timer some other way than Quit (e.g. back gesture)
  useEffect(() => clearBeeps, [clearBeeps])

  const advanceSegment = useCallback((fromIndex: number, segs: Segment[]) => {
    const nextIndex = fromIndex + 1
    if (nextIndex >= segs.length) {
      clearBeeps()
      setState((s) => ({ ...s, isRunning: false, isComplete: true, timeRemaining: 0 }))
      playComplete(); haptic('complete')
    } else {
      const dur = segs[nextIndex].duration
      // Anchor to previous endAt to prevent drift accumulation across segments
      const nextPhase = segs[nextIndex].phase
      const nextLabel = segs[nextIndex].label
      endAtRef.current = endAtRef.current + dur * 1000
      scheduleBeeps(endAtRef.current)
      playPhaseStart()
      haptic(nextPhase === 'work' ? 'work' : nextPhase === 'rest' ? 'rest' : nextPhase === 'break' ? 'break' : 'phase')
      if (nextPhase === 'work' && nextLabel !== 'Work') {
        const nextSeg = segs[nextIndex]
        const key = `${nextSeg.groupIndex}-${nextSeg.exerciseIndex}`
        const group = workoutRef.current.exerciseGroups?.[nextSeg.groupIndex]
        const ex = group?.exercises?.[nextSeg.exerciseIndex]
        if (ex?.notes && !spokenNotesRef.current.has(key)) {
          spokenNotesRef.current.add(key)
          speakText(`${nextLabel}. ${notesWithSets(ex.notes, group?.rounds ?? workoutRef.current.rounds)}`)
        } else {
          speakText(nextLabel)
        }
      }
      setState((s) => ({ ...s, segmentIndex: nextIndex, timeRemaining: dur }))
    }
  }, [clearBeeps, scheduleBeeps])

  // After the page was hidden or timers were throttled, several segments may have
  // ended. Jump straight to the right one instead of replaying each transition's
  // sounds and speech in a burst.
  const catchUp = useCallback((fromIndex: number, segs: Segment[]) => {
    const now = Date.now()
    const lateSec = Math.round((now - endAtRef.current) / 1000)
    let idx = fromIndex
    let end = endAtRef.current
    while (end <= now && idx < segs.length - 1) {
      idx++
      end += segs[idx].duration * 1000
    }
    logTiming(`caught up ${idx - fromIndex} segment(s), ${lateSec} s late`)
    if (end <= now) {
      clearBeeps()
      setState((s) => ({ ...s, segmentIndex: segs.length - 1, isRunning: false, isComplete: true, timeRemaining: 0 }))
      playComplete(); haptic('complete')
      return
    }
    endAtRef.current = end
    scheduleBeeps(end)
    playPhaseStart()
    setState((s) => ({ ...s, segmentIndex: idx, timeRemaining: Math.ceil((end - now) / 1000) }))
  }, [clearBeeps, scheduleBeeps])

  const tick = useCallback(() => {
    const { segmentIndex, isRunning, isComplete } = stateRef.current
    const segs = segmentsRef.current
    if (!isRunning || isComplete) return

    const remainingMs = endAtRef.current - Date.now()

    if (remainingMs > 0) {
      setState((s) => ({ ...s, timeRemaining: Math.ceil(remainingMs / 1000) }))
    } else if (remainingMs > -2000) {
      advanceSegment(segmentIndex, segs)
    } else {
      catchUp(segmentIndex, segs)
    }
  }, [advanceSegment, catchUp])

  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (!state.isRunning) return
    let id: ReturnType<typeof setTimeout>
    // Wake just after the displayed second flips (relative to the segment end),
    // so the number changes in step with the beeps instead of up to 500 ms late
    const loop = () => {
      tickRef.current()
      const r = endAtRef.current - Date.now()
      id = setTimeout(loop, (((r % 1000) + 1000) % 1000) + 15)
    }
    id = setTimeout(loop, 0)
    // Coming back to the foreground: resume audio and resync immediately
    const onVisibility = () => {
      if (document.hidden) return
      initAudio()
      clearTimeout(id)
      loop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
    spokenNotesRef.current.clear()
    setState({ segmentIndex: 0, timeRemaining: segmentsRef.current[0]?.duration ?? 0, isRunning: false, isComplete: false })
  }, [clearBeeps])

  const skipToNext = useCallback(() => {
    clearBeeps()
    endAtRef.current = Date.now() // anchor to now so next segment isn't inflated by remaining time
    advanceSegment(stateRef.current.segmentIndex, segmentsRef.current)
  }, [advanceSegment, clearBeeps])

  const skipToNextBreak = useCallback(() => {
    clearBeeps()
    const segs = segmentsRef.current
    const { segmentIndex } = stateRef.current
    // During a break the upcoming group is the one being skipped
    const cur = segs[segmentIndex]
    const skipGroup = cur.phase === 'break' ? cur.groupIndex + 1 : cur.groupIndex
    let targetIdx = segs.length - 1
    for (let i = segmentIndex + 1; i < segs.length; i++) {
      const seg = segs[i]
      // Land on the break after the skipped group, or the next group's first segment when there's no break
      if (seg.phase === 'cooldown' || seg.groupIndex > skipGroup || (seg.phase === 'break' && seg.groupIndex === skipGroup)) {
        targetIdx = i
        break
      }
    }
    const dur = segs[targetIdx].duration
    endAtRef.current = Date.now() + dur * 1000
    scheduleBeeps(endAtRef.current)
    playPhaseStart()
    haptic('break')
    setState((s) => ({ ...s, segmentIndex: targetIdx, timeRemaining: dur }))
  }, [clearBeeps, scheduleBeeps])

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

  const effectiveGroupRounds =
    usesGroups(workout) && (currentSegment?.groupIndex ?? -1) >= 0
      ? ((workout.exerciseGroups ?? [])[currentSegment?.groupIndex ?? 0]?.rounds ?? workout.rounds)
      : workout.rounds

  return {
    phase: state.isComplete ? ('complete' as Phase) : (currentSegment?.phase ?? ('idle' as Phase)),
    timeRemaining: state.timeRemaining,
    totalTime: totalDuration,
    currentRound: currentSegment?.round ?? 0,
    totalRounds: state.isComplete ? workout.rounds : effectiveGroupRounds,
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
    skipToNextBreak,
  }
}
