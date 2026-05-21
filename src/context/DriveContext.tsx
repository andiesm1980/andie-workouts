'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { Workout, CompletedSession } from '@/types/workout'

const CONNECTED_KEY = 'wk_gh_connected'
const REPO_KEY      = 'wk_gh_repo'
const TOKEN_KEY     = 'wk_gh_token'
const SHA_KEY       = 'wk_gh_file_sha'
const FILE_NAME     = 'my-workouts-data.json'

function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

function b64decode(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function ghLoad(token: string, repo: string): Promise<{ data: unknown; sha: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${FILE_NAME}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`GitHub ${res.status}: ${(body as { message?: string }).message ?? 'unknown error'}`)
  }
  const json = await res.json() as { content: string; sha: string }
  return { data: JSON.parse(b64decode(json.content)), sha: json.sha }
}

async function ghSave(token: string, repo: string, payload: unknown, sha?: string): Promise<string> {
  const body: Record<string, string> = {
    message: 'sync',
    content: b64encode(JSON.stringify(payload)),
  }
  if (sha) body.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${FILE_NAME}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub save ${res.status}: ${(err as { message?: string }).message ?? 'unknown error'}`)
  }
  const result = await res.json() as { content: { sha: string } }
  return result.content.sha
}

export type DriveStatus = 'idle' | 'connecting' | 'syncing' | 'error'

export interface WorkoutsPayload {
  workouts: Workout[]
  sessions: CompletedSession[]
}

interface DriveCtx {
  isConnected: boolean
  status: DriveStatus
  lastSynced: Date | null
  error: string | null
  repo: string
  setRepo: (r: string) => void
  token: string
  setToken: (t: string) => void
  connect: () => Promise<void>
  disconnect: () => void
  scheduleSave: (data: WorkoutsPayload) => void
  loadNow: () => Promise<WorkoutsPayload | null>
}

const Ctx = createContext<DriveCtx | null>(null)

export function useDrive() {
  const c = useContext(Ctx)
  if (!c) throw new Error('DriveProvider missing')
  return c
}

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(CONNECTED_KEY) === '1'
  )
  const [status, setStatus]       = useState<DriveStatus>('idle')
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [repo, setRepoState]      = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(REPO_KEY) ?? '') : ''
  )
  const [token, setTokenState]    = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(TOKEN_KEY) ?? '') : ''
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-reconnect if credentials exist but connected flag was lost
  useEffect(() => {
    if (localStorage.getItem(CONNECTED_KEY) === '1') return
    const r = localStorage.getItem(REPO_KEY)
    const t = localStorage.getItem(TOKEN_KEY)
    if (r && t) connect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setRepo = useCallback((r: string) => {
    setRepoState(r)
    localStorage.setItem(REPO_KEY, r)
  }, [])

  const setToken = useCallback((t: string) => {
    setTokenState(t)
    localStorage.setItem(TOKEN_KEY, t)
  }, [])

  const connect = useCallback(async () => {
    const r = localStorage.getItem(REPO_KEY) ?? ''
    const t = localStorage.getItem(TOKEN_KEY) ?? ''
    if (!r || !t) { setError('Enter a repository and token first.'); return }
    setStatus('connecting')
    setError(null)
    try {
      const res = await fetch(`https://api.github.com/repos/${r}`, {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' },
      })
      if (res.status === 401) throw new Error('Invalid token — check your Personal Access Token')
      if (res.status === 404) throw new Error('Repo not found — check the name and token permissions')
      if (!res.ok) throw new Error(`GitHub error (${res.status})`)
      localStorage.setItem(CONNECTED_KEY, '1')
      setIsConnected(true)
      setStatus('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
      setStatus('error')
    }
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(CONNECTED_KEY)
    localStorage.removeItem(SHA_KEY)
    setIsConnected(false)
    setStatus('idle')
    setError(null)
    setLastSynced(null)
  }, [])

  const loadNow = useCallback(async (): Promise<WorkoutsPayload | null> => {
    if (!isConnected) return null
    const r = localStorage.getItem(REPO_KEY) ?? ''
    const t = localStorage.getItem(TOKEN_KEY) ?? ''
    setStatus('syncing')
    setError(null)
    try {
      const result = await ghLoad(t, r)
      setLastSynced(new Date())
      setStatus('idle')
      if (!result) return null
      localStorage.setItem(SHA_KEY, result.sha)
      const d = result.data as { workouts?: Workout[]; sessions?: CompletedSession[] }
      return { workouts: d.workouts ?? [], sessions: d.sessions ?? [] }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setStatus('error')
      throw e
    }
  }, [isConnected])

  const scheduleSave = useCallback((data: WorkoutsPayload) => {
    if (!isConnected) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const r = localStorage.getItem(REPO_KEY) ?? ''
      const t = localStorage.getItem(TOKEN_KEY) ?? ''
      const payload = { version: 1, savedAt: new Date().toISOString(), ...data }
      setStatus('syncing')
      try {
        const sha = localStorage.getItem(SHA_KEY) ?? undefined
        let newSha: string
        try {
          newSha = await ghSave(t, r, payload, sha)
        } catch (e) {
          if (e instanceof Error && (e.message.includes('409') || e.message.includes('422'))) {
            const latest = await ghLoad(t, r)
            newSha = await ghSave(t, r, payload, latest?.sha)
          } else {
            throw e
          }
        }
        localStorage.setItem(SHA_KEY, newSha)
        setLastSynced(new Date())
        setStatus('idle')
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
        setStatus('error')
      }
    }, 2000)
  }, [isConnected])

  return (
    <Ctx.Provider value={{
      isConnected, status, lastSynced, error,
      repo, setRepo, token, setToken,
      connect, disconnect, scheduleSave, loadNow,
    }}>
      {children}
    </Ctx.Provider>
  )
}
