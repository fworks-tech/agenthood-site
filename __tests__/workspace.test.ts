import { describe, it, expect } from 'vitest'
import { TURN_BUDGET_DEFAULT } from '../app/(main)/studio/_types/workspace'

describe('workspace types', () => {
  it('exports TURN_BUDGET_DEFAULT', () => {
    expect(TURN_BUDGET_DEFAULT).toBe(30)
  })
})
