'use client'

import { useState } from 'react'
import { useWorkoutStore } from '@/store/workoutStore'
import { useDrive } from '@/context/DriveContext'
import { exportWorkouts } from '@/lib/exportImport'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SettingsSheet({ isOpen, onClose }: Props) {
  const { workouts, sessions, reminderDays, lastBackupAt, setReminderDays, setLastBackupAt, moveWorkout, setSessions } = useWorkoutStore()
  const drive = useDrive()
  const [tokenCopied, setTokenCopied] = useState(false)

  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-6 pt-5"
        style={{ backgroundColor: '#1a1a26', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />

        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-3">GitHub sync</p>
        {drive.isConnected ? (
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: drive.status === 'error' ? '#f0407a' : drive.status === 'syncing' ? '#fbbf24' : '#48B256' }} />
                  <span className="text-white/80 text-sm font-medium">
                    {drive.status === 'syncing' ? 'Syncing…' : drive.status === 'error' ? 'Sync error' : 'Connected'}
                  </span>
                </div>
                <p className="text-white/35 text-xs">{drive.repo}</p>
                {drive.lastSynced && (
                  <p className="text-white/25 text-xs mt-0.5">
                    Last synced {drive.lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    drive.loadNow().then((data) => {
                      if (!data) return
                      moveWorkout(data.workouts)
                      setSessions(data.sessions)
                    }).catch(() => {})
                  }}
                  disabled={drive.status === 'syncing'}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                >
                  Restore from GitHub
                </button>
                <button
                  onClick={drive.disconnect}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                const t = localStorage.getItem('wk_gh_token') ?? ''
                navigator.clipboard.writeText(t).then(() => {
                  setTokenCopied(true)
                  setTimeout(() => setTokenCopied(false), 2000)
                })
              }}
              className="text-xs text-white/35 hover:text-white/60 transition-colors text-left mt-2"
            >
              {tokenCopied ? '✓ Token copied!' : 'Copy GitHub token'}
            </button>
            {drive.error && <p className="text-xs mt-2" style={{ color: '#f0407a' }}>{drive.error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            <input
              value={drive.repo}
              onChange={(e) => drive.setRepo(e.target.value)}
              placeholder="owner/repo"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <input
              value={drive.token}
              onChange={(e) => drive.setToken(e.target.value)}
              placeholder="Personal access token (contents: write)"
              type="password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            {drive.error && <p className="text-xs px-1" style={{ color: '#f0407a' }}>{drive.error}</p>}
            <button
              onClick={drive.connect}
              disabled={drive.status === 'connecting'}
              className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: '#f0407a', color: '#fff' }}
            >
              {drive.status === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        )}

        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Backup reminder</p>
        <div className="flex flex-col gap-1 mb-6">
          {([
            { label: 'Every week', days: 7 },
            { label: 'Every month', days: 30 },
            { label: 'Every 3 months', days: 90 },
            { label: 'Never', days: 0 },
          ] as const).map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setReminderDays(days)}
              className="flex items-center justify-between py-3.5 px-4 rounded-2xl transition-all"
              style={{ backgroundColor: reminderDays === days ? 'rgba(240,64,122,0.12)' : 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-white text-sm font-medium">{label}</span>
              {reminderDays === days && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0407a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
        {lastBackupAt > 0 && (
          <p className="text-white/25 text-xs text-center mb-4">
            Last backup: {new Date(lastBackupAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <button
          onClick={onClose}
          className="w-full py-3 text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
