import { describe, it, expect } from 'vitest'
import { parseMentions } from '../app/(main)/studio/_lib/workspace-mentions'

const IDS = ['the-builder', 'the-reviewer', 'the-mediator']

describe('workspace-mentions', () => {
  it('routes a direct mention with mediator skipped', () => {
    const r = parseMentions('@the-builder fix this test', IDS)
    expect(r.targets).toEqual(['the-builder'])
    expect(r.cleanText).toBe('fix this test')
    expect(r.skipsMediator).toBe(true)
  })

  it('keeps written order for multi-mentions', () => {
    const r = parseMentions('@the-reviewer then @the-builder check', IDS)
    expect(r.targets).toEqual(['the-reviewer', 'the-builder'])
  })

  it('accepts the short form without the- prefix', () => {
    expect(parseMentions('@builder go', IDS).targets).toEqual(['the-builder'])
  })

  it('flags @user separately for HITL', () => {
    const r = parseMentions('@user which API key?', IDS)
    expect(r.userMention).toBe(true)
    expect(r.targets).toEqual([])
  })

  it('errors on unknown members without touching the LLM', () => {
    const r = parseMentions('@the-ghost hello', IDS)
    expect(r.error).toMatch(/unknown member/i)
  })

  it('ignores email addresses and other mid-word @', () => {
    const r = parseMentions('mail me at foo@bar.com please', IDS)
    expect(r.targets).toEqual([])
    expect(r.error).toBeUndefined()
    expect(r.cleanText).toBe('mail me at foo@bar.com please')
  })

  it('returns empty for plain chat', () => {
    const r = parseMentions('hello there', IDS)
    expect(r.targets).toEqual([])
    expect(r.userMention).toBe(false)
  })
})
