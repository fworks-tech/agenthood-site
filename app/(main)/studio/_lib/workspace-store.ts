// WorkspaceStore — shared memory for Studio Workspaces.
// Server: Upstash Redis when KV_REST_API_* is configured (same as middleware),
// with a per-instance Map fallback for local dev. Client: localStorage mirror.
// All agents + user share thread + scratchpad via workspaceId.

import type { Redis } from '@upstash/redis'
import { STORAGE_KEYS } from './constants'
import type { WorkspaceSession } from '../_types/workspace'

export type { WorkspaceSession }

const MAX_WORKSPACES = 20
const MAX_AGE_MS = 45 * 60 * 1000 // 45m TTL — debug object stays scannable, not forever
const STORE_KEY = STORAGE_KEYS.WORKSPACES as string
const ACTIVE_KEY = STORAGE_KEYS.ACTIVE_WORKSPACE as string
const REDIS_PREFIX = 'workspace:'
const REDIS_TTL_SECONDS = Math.ceil(MAX_AGE_MS / 1000)

let redisPromise: Promise<Redis | null> | null = null

// Dynamic import keeps the Redis client out of the browser bundle; type-only
// import above is erased at build time.
async function serverRedis(): Promise<Redis | null> {
  if (!isServer()) return null
  if (redisPromise === null) {
    const url = process.env.KV_REST_API_URL
    const token = process.env.KV_REST_API_TOKEN
    if (!url || !token) return null
    redisPromise = import('@upstash/redis')
      .then(({ Redis: Client }) => new Client({ url, token }))
      .catch(() => null)
  }
  return redisPromise
}

declare global {
  var __workspaceStore: Map<string, WorkspaceSession> | undefined
}

function serverStore(): Map<string, WorkspaceSession> {
  if (!globalThis.__workspaceStore) globalThis.__workspaceStore = new Map()
  return globalThis.__workspaceStore
}

function isServer(): boolean {
  return typeof window === 'undefined'
}

// ---- pruning ----
function prune(sessions: WorkspaceSession[]): WorkspaceSession[] {
  const now = Date.now()
  const fresh = sessions.filter((s) => now - s.updatedAt < MAX_AGE_MS)
  fresh.sort((a, b) => b.updatedAt - a.updatedAt)
  return fresh.slice(0, MAX_WORKSPACES)
}

// ---- client: localStorage; server: Map ----
export function loadWorkspaces(): WorkspaceSession[] {
  if (isServer()) {
    return prune([...serverStore().values()])
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WorkspaceSession[]
    return prune(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}

export function saveWorkspaces(sessions: WorkspaceSession[]): void {
  const pruned = prune(sessions)
  if (isServer()) {
    const m = serverStore()
    m.clear()
    for (const s of pruned) m.set(s.workspaceId, s)
    return
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(pruned))
  } catch {
    // quota full — clear oldest
  }
}

export function getWorkspace(workspaceId: string): WorkspaceSession | null {
  if (isServer()) return serverStore().get(workspaceId) ?? null
  return loadWorkspaces().find((s) => s.workspaceId === workspaceId) ?? null
}

export function saveWorkspace(session: WorkspaceSession): void {
  session.updatedAt = Date.now()
  if (isServer()) {
    serverStore().set(session.workspaceId, session)
    // evict if over cap
    if (serverStore().size > MAX_WORKSPACES) {
      const sorted = [...serverStore().values()].sort((a, b) => a.updatedAt - b.updatedAt)
      for (let i = 0; i < sorted.length - MAX_WORKSPACES; i++) serverStore().delete(sorted[i].workspaceId)
    }
    return
  }
  const all = loadWorkspaces().filter((s) => s.workspaceId !== session.workspaceId)
  all.unshift(session)
  saveWorkspaces(all)
}

// Async server path: keeps the sync exports above intact for the client hook
// while making a turn visible to every lambda instance in production.
export async function getWorkspaceAsync(workspaceId: string): Promise<WorkspaceSession | null> {
  const redis = await serverRedis()
  if (!redis) return getWorkspace(workspaceId)
  try {
    return await redis.get<WorkspaceSession>(`${REDIS_PREFIX}${workspaceId}`)
  } catch {
    return getWorkspace(workspaceId)
  }
}

export async function saveWorkspaceAsync(session: WorkspaceSession): Promise<void> {
  session.updatedAt = Date.now()
  saveWorkspace(session)
  const redis = await serverRedis()
  if (!redis) return
  try {
    await redis.set(`${REDIS_PREFIX}${session.workspaceId}`, session, { ex: REDIS_TTL_SECONDS })
  } catch {
    // Instance-local Map still serves this lambda if Redis is unavailable.
  }
}

export function getActiveWorkspaceId(): string | null {
  if (isServer()) return null
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveWorkspaceId(id: string | null): void {
  if (isServer()) return
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {}
}

// WorkspaceStore interface — future Redis implements same shape
export interface WorkspaceStore {
  get(workspaceId: string): Promise<WorkspaceSession | null>
  set(session: WorkspaceSession): Promise<void>
  getActiveId(): Promise<string | null>
  setActiveId(id: string | null): Promise<void>
}
