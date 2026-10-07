import { describe, it, expect } from 'vitest'
import { parseWorkspaceCommand, WORKSPACE_COMMANDS, isEmptyPing } from '../app/(main)/studio/_lib/workspace-commands'

describe('workspace-commands', () => {
  it('parses known commands with args', () => {
    expect(parseWorkspaceCommand('/summarize')).toEqual({ name: 'summarize', args: '' })
    expect(parseWorkspaceCommand('/continue with retries')).toEqual({ name: 'continue', args: 'with retries' })
  })

  it('is case-insensitive and trims', () => {
    expect(parseWorkspaceCommand('  /Help  ')?.name).toBe('help')
  })

  it('flags unknown slash input so it never hits the LLM', () => {
    const r = parseWorkspaceCommand('/frobnicate x')
    expect(r && 'unknown' in r && r.unknown).toBe(true)
  })

  it('returns null for plain chat', () => {
    expect(parseWorkspaceCommand('hello there')).toBeNull()
    expect(parseWorkspaceCommand('')).toBeNull()
  })

  it('covers exactly the scoped command set', () => {
    expect([...WORKSPACE_COMMANDS].sort()).toEqual(
      ['continue', 'help', 'new', 'plan', 'retry', 'stop', 'summarize'].sort(),
    )
  })

  it('spots empty pings that would burn a round-trip', () => {
    expect(isEmptyPing('')).toBe(true)
    expect(isEmptyPing('   ')).toBe(true)
    expect(isEmptyPing('...')).toBe(true)
    expect(isEmptyPing('…')).toBe(true)
    expect(isEmptyPing('hello')).toBe(false)
    expect(isEmptyPing('@the-builder hi')).toBe(false)
    expect(isEmptyPing('/summarize')).toBe(false)
  })
})
