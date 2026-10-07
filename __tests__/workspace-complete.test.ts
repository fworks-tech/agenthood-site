import { describe, it, expect } from 'vitest'
import { getCompletions, applyCompletion } from '../app/(main)/studio/_lib/workspace-complete'

const IDS = ['the-builder', 'the-reviewer']

describe('workspace-complete', () => {
  it('suggests commands after a trailing / token', () => {
    const out = getCompletions('/sum', IDS)
    expect(out.map((c) => c.value)).toContain('/summarize')
    expect(out.every((c) => c.kind === 'command')).toBe(true)
  })

  it('lists all commands on a bare /', () => {
    expect(getCompletions('/', IDS).length).toBeGreaterThan(3)
  })

  it('suggests members after a trailing @ token, short form included', () => {
    const out = getCompletions('ask @bui', IDS)
    expect(out.map((c) => c.value)).toContain('@the-builder')
  })

  it('offers @user for HITL alongside members', () => {
    expect(getCompletions('ask @', IDS).map((c) => c.value)).toContain('@user')
  })

  it('stays silent without an active trailing token', () => {
    expect(getCompletions('hello there', IDS)).toEqual([])
    expect(getCompletions('mail foo@bar.com', IDS)).toEqual([])
    expect(getCompletions('/summarize ', IDS)).toEqual([])
  })

  it('applies a completion by replacing only the active token', () => {
    expect(applyCompletion('ask @bui', '@the-builder')).toBe('ask @the-builder ')
    expect(applyCompletion('/sum', '/summarize')).toBe('/summarize ')
  })
})
