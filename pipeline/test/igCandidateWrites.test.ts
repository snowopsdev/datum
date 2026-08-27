import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Payload } from 'payload'

import { recordCandidateSightings } from '../src/informationGain/candidates'
import type { CandidateSighting } from '../src/informationGain/lib'

const sighting = (overrides: Partial<CandidateSighting> = {}): CandidateSighting => ({
  domain: 'cited.test',
  kind: 'cited',
  articleId: 7,
  keyword: 'best crm',
  runId: 42,
  seenAt: '2026-08-26T00:00:00.000Z',
  url: 'https://cited.test/a',
  citations: 2,
  sourceKind: 'secondary',
  ...overrides,
})

interface Call {
  op: 'find' | 'create' | 'update'
  id?: number
  data?: Record<string, unknown>
  overrideAccess?: boolean
}

/**
 * A Payload stand-in over an in-memory row list. `createFails` makes the first
 * create throw a unique-violation, standing in for another writer winning.
 */
const fakePayload = (
  rows: Record<string, unknown>[] = [],
  options: { createFails?: boolean } = {},
): { payload: Payload; calls: Call[]; rows: Record<string, unknown>[] } => {
  const calls: Call[] = []
  let nextId = rows.length + 1
  let failNext = options.createFails ?? false
  const payload = {
    find: async ({
      where,
      overrideAccess,
    }: {
      where: { domain: { equals: string } }
      overrideAccess?: boolean
    }) => {
      calls.push({ op: 'find', overrideAccess })
      return { docs: rows.filter((row) => row.domain === where.domain.equals) }
    },
    create: async ({
      data,
      overrideAccess,
    }: {
      data: Record<string, unknown>
      overrideAccess?: boolean
    }) => {
      if (failNext) {
        failNext = false
        // The losing writer's row is already there by the time it retries.
        rows.push({ id: nextId++, ...data })
        throw new Error('duplicate key value violates unique constraint')
      }
      calls.push({ op: 'create', data, overrideAccess })
      const row = { id: nextId++, ...data }
      rows.push(row)
      return row
    },
    update: async ({
      id,
      data,
      overrideAccess,
    }: {
      id: number
      data: Record<string, unknown>
      overrideAccess?: boolean
    }) => {
      calls.push({ op: 'update', id, data, overrideAccess })
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, data)
      return row
    },
  } as unknown as Payload
  return { payload, calls, rows }
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  domain: 'cited.test',
  status: 'pending',
  suggestedClass: 'secondary',
  citationCount: 3,
  serpCount: 1,
  domainRating: 55,
  firstSeenAt: '2026-08-01T00:00:00.000Z',
  lastSeenAt: '2026-08-01T00:00:00.000Z',
  sightings: [],
  ...overrides,
})

describe('recordCandidateSightings', () => {
  it('creates a pending row for a domain nobody has seen', async () => {
    const { payload, calls } = fakePayload()
    const result = await recordCandidateSightings(payload, [sighting()])

    assert.deepEqual(result, { created: 1, updated: 0 })
    const created = calls.find((call) => call.op === 'create')
    assert.equal(created?.data?.domain, 'cited.test')
    assert.equal(created?.data?.status, 'pending')
    assert.equal(created?.data?.citationCount, 2)
    assert.equal(created?.data?.serpCount, 0)
    assert.equal(created?.data?.firstSeenAt, '2026-08-26T00:00:00.000Z')
  })

  it('collapses one domain seen twice in a run into a single row', async () => {
    const { payload, calls } = fakePayload()
    const result = await recordCandidateSightings(payload, [
      sighting({ citations: 2 }),
      sighting({ kind: 'serp', citations: undefined, position: 3, domainRating: 61 }),
    ])

    assert.deepEqual(result, { created: 1, updated: 0 })
    assert.equal(calls.filter((call) => call.op === 'create').length, 1)
    const created = calls.find((call) => call.op === 'create')
    assert.equal(created?.data?.citationCount, 2)
    assert.equal(created?.data?.serpCount, 1)
    assert.equal(created?.data?.domainRating, 61)
  })

  it('adds to the counts on a domain already in the queue', async () => {
    const { payload, calls } = fakePayload([row()])
    const result = await recordCandidateSightings(payload, [sighting({ citations: 2 })])

    assert.deepEqual(result, { created: 0, updated: 1 })
    const updated = calls.find((call) => call.op === 'update')
    assert.equal(updated?.data?.citationCount, 5)
    assert.equal(updated?.data?.lastSeenAt, '2026-08-26T00:00:00.000Z')
    // firstSeenAt is not in the update payload: it is when we first saw it.
    assert.equal(Object.hasOwn(updated?.data ?? {}, 'firstSeenAt'), false)
  })

  // Being sighted at all means no active rule covered it, so an approved row's
  // rule must have been deactivated — the domain needs deciding again.
  it('reopens an approved candidate whose rule is gone', async () => {
    const { payload, calls } = fakePayload([row({ status: 'approved' })])
    await recordCandidateSightings(payload, [sighting()])
    assert.equal(calls.find((call) => call.op === 'update')?.data?.status, 'pending')
  })

  it('leaves a dismissal standing however often the domain turns up', async () => {
    const { payload, calls } = fakePayload([row({ status: 'dismissed' })])
    await recordCandidateSightings(payload, [sighting()])
    const updated = calls.find((call) => call.op === 'update')
    assert.equal(Object.hasOwn(updated?.data ?? {}, 'status'), false)
    // Counts still move, so a domain that keeps recurring stays visible.
    assert.equal(updated?.data?.citationCount, 5)
  })

  it('keeps the last known rating when this run saw none', async () => {
    const { payload, calls } = fakePayload([row({ domainRating: 78 })])
    await recordCandidateSightings(payload, [sighting({ domainRating: undefined })])
    assert.equal(calls.find((call) => call.op === 'update')?.data?.domainRating, 78)
  })

  it('retries as an update when another writer created the row first', async () => {
    const { payload, calls } = fakePayload([], { createFails: true })
    const result = await recordCandidateSightings(payload, [sighting()])

    assert.deepEqual(result, { created: 0, updated: 1 })
    assert.equal(calls.filter((call) => call.op === 'update').length, 1)
  })

  it('writes with overrideAccess, since the collection refuses API writes', async () => {
    const { payload, calls } = fakePayload()
    await recordCandidateSightings(payload, [sighting()])
    assert.ok(calls.every((call) => call.overrideAccess === true))
  })

  it('does nothing when there is nothing to record', async () => {
    const { payload, calls } = fakePayload()
    assert.deepEqual(await recordCandidateSightings(payload, []), { created: 0, updated: 0 })
    assert.deepEqual(calls, [])
  })
})
