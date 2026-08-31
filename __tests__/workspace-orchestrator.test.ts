import { describe, it, expect } from 'vitest'
import {
  parseMediatorPlan,
  fallbackPlan,
  trimThread,
  buildMemberMessages,
  createInitialState,
  isBudgetExhausted,
  getNextMember,
  advanceState,
  shouldRequestHandoff,
  TURN_BUDGET_DEFAULT,
  type ThreadMessage,
} from '../app/(main)/studio/_lib/workspace-orchestrator'
import type { WorkspaceSpec } from '../app/(main)/studio/_types/workspace'

const VALID_IDS = ['the-builder', 'the-tester', 'the-reviewer']

describe('parseMediatorPlan', () => {
  it('parses plain JSON', () => {
    const raw = JSON.stringify({ members: [{ id: 'the-builder', task: 'do A', order: 0 }] })
    expect(parseMediatorPlan(raw, VALID_IDS)).toEqual({ members: [{ id: 'the-builder', task: 'do A', order: 0 }] })
  })

  it('strips ```json fences', () => {
    const raw = '```json\n' + JSON.stringify({ members: [{ id: 'the-builder', task: 'x', order: 1 }] }) + '\n```'
    expect(parseMediatorPlan(raw, VALID_IDS)).toEqual({ members: [{ id: 'the-builder', task: 'x', order: 1 }] })
  })

  it('strips plain ``` fences', () => {
    const raw = '```\n' + JSON.stringify({ members: [{ id: 'the-tester', task: 'y', order: 0 }] }) + '\n```'
    expect(parseMediatorPlan(raw, VALID_IDS)).toEqual({ members: [{ id: 'the-tester', task: 'y', order: 0 }] })
  })

  it('extracts JSON embedded in prose', () => {
    const raw = 'Here is the plan: ' + JSON.stringify({ members: [{ id: 'the-reviewer', task: 'review', order: 0 }] }) + ' good luck'
    expect(parseMediatorPlan(raw, VALID_IDS)).toEqual({ members: [{ id: 'the-reviewer', task: 'review', order: 0 }] })
  })

  it('sorts by order', () => {
    const raw = JSON.stringify({
      members: [
        { id: 'the-tester', task: 'b', order: 1 },
        { id: 'the-builder', task: 'a', order: 0 },
      ],
    })
    expect(parseMediatorPlan(raw, VALID_IDS)!.members[0].id).toBe('the-builder')
    expect(parseMediatorPlan(raw, VALID_IDS)!.members[1].id).toBe('the-tester')
  })

  it('filters invalid ids', () => {
    const raw = JSON.stringify({
      members: [
        { id: 'the-builder', task: 'ok', order: 0 },
        { id: 'unknown-agent', task: 'bad', order: 1 },
      ],
    })
    expect(parseMediatorPlan(raw, VALID_IDS)).toEqual({ members: [{ id: 'the-builder', task: 'ok', order: 0 }] })
  })

  it('returns null when no valid members', () => {
    const raw = JSON.stringify({ members: [{ id: 'bad', task: 'x', order: 0 }] })
    expect(parseMediatorPlan(raw, VALID_IDS)).toBeNull()
  })

  it('returns null for missing members array', () => {
    expect(parseMediatorPlan(JSON.stringify({ foo: 1 }), VALID_IDS)).toBeNull()
    expect(parseMediatorPlan('not json at all', VALID_IDS)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseMediatorPlan('{ broken', VALID_IDS)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseMediatorPlan('', VALID_IDS)).toBeNull()
  })

  it('validates members shape', () => {
    const raw = JSON.stringify({ members: [{ id: 'the-builder', task: 123, order: 0 }] })
    expect(parseMediatorPlan(raw, VALID_IDS)).toBeNull()
  })
})

describe('fallbackPlan', () => {
  it('maps memberIds in order with shared instruction', () => {
    const spec: WorkspaceSpec = { memberIds: ['the-builder', 'the-tester'], instruction: 'hello' }
    expect(fallbackPlan(spec)).toEqual({
      members: [
        { id: 'the-builder', task: 'hello', order: 0 },
        { id: 'the-tester', task: 'hello', order: 1 },
      ],
    })
  })
})

describe('trimThread', () => {
  it('returns as-is when under limit', () => {
    const msgs: ThreadMessage[] = [{ role: 'user', content: 'hi' }]
    expect(trimThread(msgs, 100)).toEqual(msgs)
  })

  it('drops oldest messages until under limit', () => {
    const msgs: ThreadMessage[] = [
      { role: 'user', content: 'a'.repeat(50) },
      { role: 'assistant', content: 'b'.repeat(50) },
      { role: 'user', content: 'c'.repeat(50) },
    ]
    const trimmed = trimThread(msgs, 100)
    expect(trimmed.length).toBe(2)
    expect(trimmed[0].content).toBe('b'.repeat(50))
  })

  it('keeps at least one message', () => {
    const msgs: ThreadMessage[] = [{ role: 'user', content: 'x'.repeat(200) }]
    expect(trimThread(msgs, 10)).toEqual(msgs)
  })

  it('handles empty array', () => {
    expect(trimThread([], 10)).toEqual([])
  })
})

describe('buildMemberMessages', () => {
  it('prepends system prompt and trims thread', () => {
    const thread: ThreadMessage[] = [{ role: 'user', content: 'hi' }]
    const out = buildMemberMessages('sys prompt', thread)
    expect(out[0]).toEqual({ role: 'system', content: 'sys prompt' })
    expect(out[1].content).toBe('hi')
  })
})

describe('orchestrator state', () => {
  it('createInitialState uses plan or fallback', () => {
    const spec: WorkspaceSpec = { memberIds: ['the-builder'], instruction: 'task' }
    const s1 = createInitialState(spec, null)
    expect(s1.plan.members[0].id).toBe('the-builder')
    const plan = { members: [{ id: 'the-tester', task: 't', order: 0 }] }
    const s2 = createInitialState(spec, plan)
    expect(s2.plan).toEqual(plan)
    expect(s2.executed).toBe(0)
    expect(s2.turnIndex).toBe(0)
  })

  it('isBudgetExhausted respects budget', () => {
    expect(isBudgetExhausted({ plan: { members: [] }, executed: 10, turnIndex: 0 })).toBe(true)
    expect(isBudgetExhausted({ plan: { members: [] }, executed: 9, turnIndex: 0 })).toBe(false)
    expect(isBudgetExhausted({ plan: { members: [] }, executed: 5, turnIndex: 0 }, 5)).toBe(true)
  })

  it('getNextMember returns done when exhausted', () => {
    const state = { plan: { members: [{ id: 'a', task: 't', order: 0 }] }, executed: 0, turnIndex: 1 }
    expect(getNextMember(state).done).toBe(true)
    expect(getNextMember(state).member).toBeNull()
  })

  it('getNextMember returns current member', () => {
    const state = { plan: { members: [{ id: 'a', task: 't', order: 0 }] }, executed: 0, turnIndex: 0 }
    expect(getNextMember(state).member!.id).toBe('a')
  })

  it('advanceState increments turnIndex and executed', () => {
    const s = { plan: { members: [] }, executed: 1, turnIndex: 1 }
    expect(advanceState(s)).toEqual({ plan: { members: [] }, executed: 2, turnIndex: 2 })
  })
})

describe('shouldRequestHandoff', () => {
  it('only for code_execution', () => {
    expect(shouldRequestHandoff('code_execution')).toBe(true)
    expect(shouldRequestHandoff('web_fetch')).toBe(false)
    expect(shouldRequestHandoff('')).toBe(false)
  })
})

describe('TURN_BUDGET_DEFAULT', () => {
  it('is 10', () => {
    expect(TURN_BUDGET_DEFAULT).toBe(10)
  })
})
