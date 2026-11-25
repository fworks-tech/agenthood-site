/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGet, mockSet } = vi.hoisted(() => ({ mockGet: vi.fn(), mockSet: vi.fn() }))

vi.mock('@upstash/redis', () => {
  class Redis {
    get = mockGet
    set = mockSet
  }
  return { Redis }
})

const originalEnv = process.env

function makeSession(id: string) {
  return {
    workspaceId: id,
    correlationId: 'c',
    spec: { memberIds: ['the-builder'], instruction: 'test' },
    thread: [],
    messages: [],
    statusMap: {},
    memory: { goal: 'test', scratchpad: {}, decisions: [], artifacts: [] },
    budgetLeft: 30,
    turnCounter: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv, KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 'token' }
  mockGet.mockReset()
  mockSet.mockReset()
})

afterEach(() => {
  process.env = originalEnv
  vi.restoreAllMocks()
})

describe('workspace-store async server path', () => {
  it('shares sessions through Redis so a second lambda can read them', async () => {
    const { saveWorkspaceAsync, getWorkspaceAsync } = await import('@/app/(main)/studio/_lib/workspace-store')
    const session = makeSession('ws-shared')
    await saveWorkspaceAsync(session)
    expect(mockSet).toHaveBeenCalledWith('workspace:ws-shared', session, expect.objectContaining({ ex: 2700 }))
    mockGet.mockResolvedValueOnce(session)
    expect((await getWorkspaceAsync('ws-shared'))?.workspaceId).toBe('ws-shared')
  })

  it('falls back to the in-memory map when KV env is absent', async () => {
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    const { saveWorkspaceAsync, getWorkspaceAsync } = await import('@/app/(main)/studio/_lib/workspace-store')
    await saveWorkspaceAsync(makeSession('ws-local'))
    expect(mockSet).not.toHaveBeenCalled()
    expect((await getWorkspaceAsync('ws-local'))?.workspaceId).toBe('ws-local')
  })

  it('falls back to the map when Redis read fails', async () => {
    const { saveWorkspaceAsync, getWorkspaceAsync } = await import('@/app/(main)/studio/_lib/workspace-store')
    const session = makeSession('ws-flaky')
    await saveWorkspaceAsync(session)
    mockGet.mockRejectedValueOnce(new Error('redis down'))
    expect((await getWorkspaceAsync('ws-flaky'))?.workspaceId).toBe('ws-flaky')
  })
})
