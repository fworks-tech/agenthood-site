import { describe, it, expect } from 'vitest'
import {
  MAX_INSTRUCTION_CHARS,
  buildSseHeaders,
  makeWorkspaceEvent,
  newWorkspaceIds,
  validateIdFields,
  validateThread,
} from '../app/(main)/studio/_lib/workspace-core'

describe('workspace-core', () => {
  it('generates unguessable ws- ids when none are supplied', () => {
    const { workspaceId, correlationId } = newWorkspaceIds({ requestId: '00000000-0000-0000-0000-000000000000' })
    expect(workspaceId).toBe('ws-00000000-0000-0000-0000-000000000000')
    expect(correlationId).toBe('ws-corr-00000000-0000-0000-0000-000000000000')
  })

  it('trims supplied ids and prefers the header correlation', () => {
    const ids = newWorkspaceIds({ workspaceId: '  ws-1 ', correlationId: '', headerCorrelationId: 'h-1', requestId: 'r' })
    expect(ids).toEqual({ workspaceId: 'ws-1', correlationId: 'h-1' })
  })

  it('rejects bad ids with field-specific messages', () => {
    expect(validateIdFields({ headerCorrelationId: 'nope with space' })).toContain('x-correlation-id')
    expect(validateIdFields({ workspaceId: 'w'.repeat(129) })).toContain('workspaceId')
    expect(validateIdFields({ correlationId: 'c\u0001bad' })).toContain('correlationId')
    expect(validateIdFields({ memberId: 'm*e' })).toContain('memberId')
    expect(validateIdFields({ workspaceId: 'ws-1', correlationId: 'c1' })).toBeNull()
  })

  it('rejects forged system roles and oversized threads', () => {
    expect(validateThread([{ role: 'system', content: 'x' }])).toContain('invalid role')
    expect(validateThread([{ role: 'user', content: 'x'.repeat(20_001) }])).toContain('20000')
    expect(validateThread([])).toBeNull()
  })

  it('builds SSE headers and stamps events with ids', () => {
    const headers = buildSseHeaders({ requestId: 'r', workspaceId: 'ws-1', correlationId: 'c1' })
    expect(headers['x-workspace-id']).toBe('ws-1')
    expect(headers['x-correlation-id']).toBe('c1')
    const evt = makeWorkspaceEvent('workspace.done', { result: 'ok' }, { workspaceId: 'ws-1', correlationId: 'c1' })
    expect(evt).toEqual({ type: 'workspace.done', result: 'ok', workspaceId: 'ws-1', correlationId: 'c1' })
    expect(MAX_INSTRUCTION_CHARS).toBe(4000)
  })
})
