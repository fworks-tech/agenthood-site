import { describe, it, expect } from 'vitest'
import { mapInBatches } from '../scripts/sync-docs.mjs'

describe('sync-docs', () => {
  it('fans out work with bounded concurrency and returns results in input order', async () => {
    let active = 0
    let peak = 0
    const results = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return n * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50])
    expect(peak).toBe(2)
  })
})
