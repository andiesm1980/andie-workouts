'use client'

import type { WorkoutType } from '@/types/workout'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreate: (type: WorkoutType) => void
}

export function TypePickerSheet({ isOpen, onClose, onCreate }: Props) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-6 pt-6"
        style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Workout type</p>
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          <button
            onClick={() => onCreate('hiit')}
            className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-98"
            style={{ backgroundColor: '#1e1e2a' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,80,64,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0407a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">HIIT</p>
              <p className="text-white/35 text-xs mt-0.5">High-intensity intervals with timed work and rest</p>
            </div>
          </button>
          <button
            onClick={() => onCreate('circuit')}
            className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-98"
            style={{ backgroundColor: '#1e1e2a' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78,143,255,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4e8fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Circuit</p>
              <p className="text-white/35 text-xs mt-0.5">Named exercises performed in sequence</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
