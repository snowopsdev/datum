import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapWithConcurrency } from '../src/corpus/concurrency'

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const items = [40, 5, 30, 0, 20]
    const results = await mapWithConcurrency(items, 2, async (item, index) => {
      await tick(item)
      return `${index}:${item}`
    })
    assert.deepEqual(results, ['0:40', '1:5', '2:30', '3:0', '4:20'])
  })

  it('never runs more than `limit` calls at once', async () => {
    const items = Array.from({ length: 12 }, (_, i) => i)
    let inFlight = 0
    let maxInFlight = 0
    const results = await mapWithConcurrency(items, 3, async (item) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await tick(item % 4)
      inFlight -= 1
      return item * 2
    })
    assert.equal(maxInFlight, 3)
    assert.deepEqual(
      results,
      items.map((i) => i * 2),
    )
  })

  it('runs one at a time when the limit is 1', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await mapWithConcurrency([1, 2, 3, 4], 1, async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await tick(1)
      inFlight -= 1
    })
    assert.equal(maxInFlight, 1)
  })

  it('treats a limit below 1 as 1 rather than stalling', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 0, async (item) => item + 1)
    assert.deepEqual(results, [2, 3, 4])
  })

  it('resolves to an empty array for no items', async () => {
    let calls = 0
    const results = await mapWithConcurrency([], 4, async () => {
      calls += 1
      return calls
    })
    assert.deepEqual(results, [])
    assert.equal(calls, 0)
  })

  it('rejects with the first error and stops starting new work', async () => {
    const started: number[] = []
    await assert.rejects(
      mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (item) => {
        started.push(item)
        await tick(1)
        if (item === 1) throw new Error(`boom ${item}`)
        return item
      }),
      /boom 1/,
    )
    assert.ok(started.length < 6, `expected work to stop early, started ${started.length} items`)
  })
})
