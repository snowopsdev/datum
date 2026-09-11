import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  ACTIVE_RUN_STATUSES,
  activeRunArticleIds,
  activeRunIncludesArticle,
} from '@/lib/activeRuns'

/** A Payload stand-in: these two helpers are one query each, so assert the query. */
const payloadWith = (overrides: Partial<Payload>) => overrides as unknown as Payload

describe('active run membership', () => {
  it('asks for every active run rather than the first page of them', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    await activeRunArticleIds(payloadWith({ find }), null)

    expect(find).toHaveBeenCalledTimes(1)
    const [args] = find.mock.calls[0]
    expect(args.collection).toBe('pipeline-runs')
    expect(args.where).toEqual({ status: { in: [...ACTIVE_RUN_STATUSES] } })
    // The whole point of the assertion: `pagination: false` does NOT lift the
    // row cap — the drizzle adapter clears `limit` only when it is exactly 0.
    // Any other value silently truncates the set, which marks articles a run
    // is carrying as stalled.
    expect(args.limit).toBe(0)
  })

  it('collects ids whether the relationship arrives populated or not, without duplicates', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ articles: [1, 2] }, { articles: [{ id: 2 }, { id: 3 }] }, { articles: null }, {}],
    })
    expect([...(await activeRunArticleIds(payloadWith({ find }), null))].sort()).toEqual([1, 2, 3])
  })

  it('asks one counting question about one article', async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 1 })
    expect(await activeRunIncludesArticle(payloadWith({ count }), null, 7)).toBe(true)

    const [args] = count.mock.calls[0]
    expect(args.collection).toBe('pipeline-runs')
    expect(args.where).toEqual({
      and: [{ status: { in: [...ACTIVE_RUN_STATUSES] } }, { articles: { in: [7] } }],
    })

    count.mockResolvedValue({ totalDocs: 0 })
    expect(await activeRunIncludesArticle(payloadWith({ count }), null, 7)).toBe(false)
  })
})
