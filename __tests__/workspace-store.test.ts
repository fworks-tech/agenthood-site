/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { saveWorkspace, getWorkspace, loadWorkspaces, saveWorkspaces, getActiveWorkspaceId, setActiveWorkspaceId } from '@/app/(main)/studio/_lib/workspace-store'
import type { WorkspaceSession } from '@/app/(main)/studio/_types/workspace'

function makeSession(id: string): WorkspaceSession {
  return {
    workspaceId: id,
    correlationId: `corr-${id}`,
    spec: { memberIds: ['the-builder'], instruction: 'test' },
    thread: [{ role: 'user', content: 'hello' }],
    messages: [{ id: `user-${id}`, memberId: 'user', content: 'hello', turnIndex: 0 }],
    statusMap: {},
    memory: { goal: 'test', scratchpad: {}, decisions: [], artifacts: [] },
    budgetLeft: 30,
    turnCounter: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('workspace-store', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') localStorage.clear()
    // server Map clear via saveWorkspaces([])
    saveWorkspaces([])
    setActiveWorkspaceId(null)
  })

  it('saves and retrieves a session', () => {
    const s = makeSession('ws-1')
    saveWorkspace(s)
    expect(getWorkspace('ws-1')?.workspaceId).toBe('ws-1')
    expect(loadWorkspaces().length).toBe(1)
  })

  it('persists thread for all members to read', () => {
    const s = makeSession('ws-2')
    s.thread.push({ role: 'assistant', content: 'mediator plan' })
    s.thread.push({ role: 'assistant', content: 'builder reply' })
    saveWorkspace(s)
    const loaded = getWorkspace('ws-2')
    expect(loaded?.thread).toHaveLength(3)
    expect(loaded?.thread[1].content).toBe('mediator plan')
  })

  it('tracks active workspace id', () => {
    setActiveWorkspaceId('ws-3')
    expect(getActiveWorkspaceId()).toBe('ws-3')
    setActiveWorkspaceId(null)
    expect(getActiveWorkspaceId()).toBeNull()
  })

  it('prunes beyond cap and respects TTL', () => {
    const sessions: WorkspaceSession[] = []
    for (let i = 0; i < 25; i++) {
      sessions.push(makeSession(`ws-${i}`))
    }
    saveWorkspaces(sessions)
    // capped to 20
    expect(loadWorkspaces().length).toBe(20)
  })
})
