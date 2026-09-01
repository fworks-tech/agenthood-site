import { describe, it, expect } from 'vitest'
import { toPolished } from '../app/(main)/studio/_lib/workspace-polish'

describe('toPolished', () => {
  it('passes through normal prose', () => {
    expect(toPolished('## Heading\nSome **bold** text.')).toBe('## Heading\nSome **bold** text.')
  })

  it('strips [tool_call:] lines', () => {
    const raw = '[tool_call: web_fetch(url=https://x)]\nReal answer here'
    expect(toPolished(raw)).toBe('Real answer here')
  })

  it('strips [tool_result:] lines', () => {
    const raw = '[tool_result: some html]\nReal answer here'
    expect(toPolished(raw)).toBe('Real answer here')
  })

  it('strips Max tool iterations line', () => {
    const raw = 'Max tool iterations reached.\nReal answer here'
    expect(toPolished(raw)).toBe('Real answer here')
  })

  it('hides a pure mediator JSON plan', () => {
    const raw = JSON.stringify({ members: [{ id: 'the-builder', task: 'x', order: 0 }] })
    expect(toPolished(raw)).toBe('')
  })

  it('strips JSON plan embedded in prose but keeps the prose', () => {
    const plan = JSON.stringify({ members: [{ id: 'the-builder', task: 'x', order: 0 }] })
    const raw = `Here is the plan: ${plan}`
    expect(toPolished(raw)).toBe('Here is the plan:')
  })

  it('collapses runs of blank lines', () => {
    expect(toPolished('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('returns empty for empty input', () => {
    expect(toPolished('')).toBe('')
    expect(toPolished('   ')).toBe('')
  })

  it('keeps json that is not a mediator plan', () => {
    expect(toPolished('{"foo":1}')).toBe('{"foo":1}')
  })
})