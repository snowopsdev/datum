import type { Payload, TypedUser } from 'payload'
import { expect, it } from 'vitest'

import { CANDIDATE_LIMIT, loadSourceReviewQueue } from '@/components/ops/loadSourceReviewQueue'

/**
 * The review queue is read one status at a time. One query of the newest 200
 * rows of every status hides older pending domains behind a long tail of
 * settled ones, and counts only what it loaded.
 */

type Row = { id: number; domain: string; status: string; lastSeenAt: string; sightings: unknown[] }

const row = (id: number, status: string, day: number): Row => ({
  id,
  domain: `site-${id}.example`,
  status,
  lastSeenAt: new Date(Date.UTC(2026, 0, 1) + day * 86_400_000).toISOString(),
  sightings: [],
})

/** A stand-in for `payload.find` that honours `where.status`, `sort`, `limit` and reports `totalDocs`. */
const fakePayload = (candidates: Row[], rules: unknown[] = []) => {
  const calls: unknown[] = []
  const payload = {
    async find(args: {
      collection: string
      where?: { status?: { equals: string } }
      limit?: number
    }) {
      calls.push(args)
      if (args.collection === 'evidence-sources') return { docs: rules, totalDocs: rules.length }
      const all = candidates
        .filter((c) => !args.where?.status || c.status === args.where.status.equals)
        .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      return { docs: all.slice(0, args.limit ?? all.length), totalDocs: all.length }
    },
  }
  return { payload: payload as unknown as Payload, calls }
}

const user = { id: 1 } as unknown as TypedUser

it('reaches an old pending domain behind more than a page of newer settled ones', async () => {
  const settled = Array.from({ length: CANDIDATE_LIMIT + 50 }, (_, i) =>
    row(1000 + i, i % 2 ? 'dismissed' : 'approved', 100 + i),
  )
  const oldPending = row(1, 'pending', 1)
  const { payload } = fakePayload([...settled, oldPending])

  const { candidates, totals } = await loadSourceReviewQueue(payload, user)

  expect(candidates.map((c) => c.id)).toContain(1)
  expect(totals.review).toBe(1)
  expect(totals.rated).toBe(125)
  expect(totals.dismissed).toBe(125)
})

it('counts pending domains past the cap in the review total', async () => {
  const pending = Array.from({ length: CANDIDATE_LIMIT + 30 }, (_, i) => row(i + 1, 'pending', i))
  const { payload } = fakePayload(pending)

  const { candidates, totals } = await loadSourceReviewQueue(payload, user)

  expect(candidates).toHaveLength(CANDIDATE_LIMIT)
  expect(totals.review).toBe(CANDIDATE_LIMIT + 30)
})

it('moves a pending domain an active rule covers from the review total to the rated one', async () => {
  const { payload } = fakePayload(
    [row(1, 'pending', 1), row(2, 'pending', 2)],
    [{ id: 7, domain: 'site-1.example', qualityClass: 'primary', active: true }],
  )

  const { candidates, totals } = await loadSourceReviewQueue(payload, user)

  expect(totals).toEqual({ review: 1, rated: 1, dismissed: 0 })
  expect(candidates.find((c) => c.id === 1)?.coveredBy?.domain).toBe('site-1.example')
})
