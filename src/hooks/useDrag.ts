'use client'

import { useState, useRef, useEffect } from 'react'

export function useDrag<T extends { fromIdx: number }>(
  onDrop: (drag: T, dropIdx: number) => void,
  getDropIdx: (y: number, drag: T) => number
) {
  const [active, setActive] = useState<T | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const activeRef = useRef(active)
  const dropRef = useRef(dropTarget)
  activeRef.current = active
  dropRef.current = dropTarget

  useEffect(() => {
    if (!active) return
    const move = (e: PointerEvent) => {
      e.preventDefault()
      const drag = activeRef.current
      if (!drag) return
      setDropTarget(getDropIdx(e.clientY, drag))
    }
    const up = () => {
      const drag = activeRef.current
      const drop = dropRef.current
      if (drag && drop !== null && drop !== drag.fromIdx && drop !== drag.fromIdx + 1) {
        onDrop(drag, drop)
      }
      setActive(null)
      setDropTarget(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = (e: React.PointerEvent, state: T) => {
    e.preventDefault()
    setActive(state)
    setDropTarget(state.fromIdx)
  }

  return { active, dropTarget, start }
}
