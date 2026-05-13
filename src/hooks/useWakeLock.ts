'use client'

import { useEffect, useRef } from 'react'

export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<any>(null)

  useEffect(() => {
    if (!active) {
      sentinelRef.current?.release()
      sentinelRef.current = null
      return
    }

    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    const request = async () => {
      try {
        sentinelRef.current = await (navigator as any).wakeLock.request('screen')
        sentinelRef.current.addEventListener('release', () => {
          sentinelRef.current = null
        })
      } catch {
        // Not available or permission denied — silently ignore
      }
    }

    request()

    // Browser auto-releases wake lock when page becomes hidden.
    // Re-request it when the user comes back.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      sentinelRef.current?.release()
      sentinelRef.current = null
    }
  }, [active])
}
