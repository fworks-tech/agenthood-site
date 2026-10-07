import { describe, it, expect } from 'vitest'
import {
  getChainSuccessor,
  parseHandoffMention,
  scoreNext,
  shouldContinue,
  AUTO_THRESHOLD,
  ASK_THRESHOLD,
} from '../app/(main)/studio/_lib/workspace-router'

describe('workspace-router', () => {
  it('follows the full-cycle chain for lane members', () => {
    expect(getChainSuccessor('the-tester')).toBe('the-builder')
    expect(getChainSuccessor('the-builder')).toBe('the-reviewer')
    expect(getChainSuccessor('the-reviewer')).toBe('the-auditor')
    expect(getChainSuccessor('the-strategist')).toBe('the-architect')
    expect(getChainSuccessor('the-scribe')).toBe('the-herald')
  })

  it('maps bug/authoring lanes onto their chains', () => {
    expect(getChainSuccessor('the-debugger')).toBe('the-tester')
    expect(getChainSuccessor('the-oracle')).toBe('the-sentinel')
    expect(getChainSuccessor('the-sentinel')).toBe('the-builder')
  })

  it('returns null where no chain continues', () => {
    expect(getChainSuccessor('the-librarian')).toBeNull()
    expect(getChainSuccessor('the-mediator')).toBeNull()
    expect(getChainSuccessor('nobody')).toBeNull()
  })

  it('parses talk-to-The-X lane deferrals', () => {
    expect(parseHandoffMention('For that, talk to The Builder', ['the-builder'])).toBe('the-builder')
    expect(parseHandoffMention('nothing here', ['the-builder'])).toBeNull()
    expect(parseHandoffMention('talk to The Auditor', ['the-builder'])).toBeNull()
  })

  it('prefers an explicit mention at high confidence', () => {
    const r = scoreNext('For that, talk to The Builder', 'the-reviewer', ['the-builder'])
    expect(r?.nextId).toBe('the-builder')
    expect(r!.confidence).toBeGreaterThanOrEqual(AUTO_THRESHOLD)
  })

  it('falls back to the chain successor at auto confidence', () => {
    const r = scoreNext('done, nothing special', 'the-tester', ['the-builder'])
    expect(r?.nextId).toBe('the-builder')
    expect(r!.confidence).toBeGreaterThanOrEqual(AUTO_THRESHOLD)
  })

  it('returns null when nothing applies so the mediator is consulted', () => {
    expect(scoreNext('done', 'the-librarian', ['the-builder'])).toBeNull()
  })

  it('stops the loop on hop cap, triple-repeat, or blocking signal', () => {
    expect(shouldContinue({ hops: 8, history: ['a'], lastOutput: 'ok' }).stop).toBe(true)
    expect(shouldContinue({ hops: 1, history: ['a', 'a', 'a'], lastOutput: 'ok' }).stop).toBe(true)
    expect(shouldContinue({ hops: 1, history: ['a'], lastOutput: 'blocking issue found' }).stop).toBe(true)
    expect(shouldContinue({ hops: 1, history: ['a'], lastOutput: 'the test failed, here is the fix' }).stop).toBe(false)
    expect(shouldContinue({ hops: 1, history: ['a'], lastOutput: 'ok' }).stop).toBe(false)
    expect(ASK_THRESHOLD).toBeLessThan(AUTO_THRESHOLD)
  })
})
