import { describe, it, expect } from 'vitest'
import { applyThreshold } from '../app/(main)/studio/_lib/workspace-router'

describe('applyThreshold', () => {
  it('auto-continues at 70 and above', () => {
    expect(applyThreshold({ nextId: 'the-builder', confidence: 70, reason: 'c' })).toBe('auto')
    expect(applyThreshold({ nextId: 'the-builder', confidence: 95, reason: 'c' })).toBe('auto')
  })

  it('asks inline between 50 and 69', () => {
    expect(applyThreshold({ nextId: 'the-builder', confidence: 50, reason: 'c' })).toBe('ask')
    expect(applyThreshold({ nextId: 'the-builder', confidence: 69, reason: 'c' })).toBe('ask')
  })

  it('stops below 50 or when the router has nothing', () => {
    expect(applyThreshold({ nextId: 'the-builder', confidence: 49, reason: 'c' })).toBe('stop')
    expect(applyThreshold(null)).toBe('stop')
  })
})
