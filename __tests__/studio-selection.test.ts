import { describe, it, expect } from 'vitest'
import { resolveActiveAgent } from '@/app/(main)/studio/_lib/studio-selection'
import type { Conversation } from '@/app/(main)/studio/_hooks/useStudioChat'
import type { AgentEntry } from '@/app/(main)/studio/_data/agents'

const conv = (id: string, agentId: string): Conversation => ({
  id,
  agentId,
  title: id,
  messages: [],
  config: {},
  createdAt: 1,
  tokenCount: 0,
})
const agent = (id: string): AgentEntry => ({ id } as AgentEntry)
const agents = [agent('the-scribe'), agent('the-architect')]

describe('resolveActiveAgent', () => {
  it("returns the agent that owns the active conversation", () => {
    const convs = [conv('c1', 'the-scribe'), conv('c2', 'the-architect')]
    expect(resolveActiveAgent(convs, 'c2', agents)?.id).toBe('the-architect')
  })

  it('follows a switch to a different agent (the reported bug)', () => {
    const convs = [conv('c1', 'the-scribe'), conv('c2', 'the-architect')]
    expect(resolveActiveAgent(convs, 'c1', agents)?.id).toBe('the-scribe')
    expect(resolveActiveAgent(convs, 'c2', agents)?.id).toBe('the-architect')
  })

  it('resolves on reload — active id present with a hydrated conversation', () => {
    const convs = [conv('c1', 'the-scribe')]
    expect(resolveActiveAgent(convs, 'c1', agents)).not.toBeNull()
  })

  it('returns null when nothing is active', () => {
    expect(resolveActiveAgent([conv('c1', 'the-scribe')], null, agents)).toBeNull()
  })

  it('returns null until the directory loads or the conversation is gone', () => {
    expect(resolveActiveAgent([conv('c1', 'the-scribe')], 'c1', [])).toBeNull()
    expect(resolveActiveAgent([], 'c1', agents)).toBeNull()
  })
})
