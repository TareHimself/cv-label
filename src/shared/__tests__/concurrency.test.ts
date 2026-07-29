import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from '../concurrency'

describe('mapWithConcurrency', () => {
  it('preserves result order regardless of completion order', async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, (ms) => {
      return new Promise<number>((resolve) => setTimeout(() => resolve(ms), ms))
    })

    expect(results).toEqual([30, 10, 20])
  })

  it('never runs more than `limit` items at once', async () => {
    let active = 0
    let maxActive = 0

    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
      }
    )

    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it('processes every item exactly once, even with more workers than items', async () => {
    const seen: number[] = []

    await mapWithConcurrency([1, 2], 8, async (item) => {
      seen.push(item)
    })

    expect(seen.sort()).toEqual([1, 2])
  })

  it('returns an empty array for an empty input', async () => {
    await expect(mapWithConcurrency([], 4, async (x) => x)).resolves.toEqual([])
  })

  it('propagates a thrown error from any worker', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('boom')
        return item
      })
    ).rejects.toThrow('boom')
  })
})
