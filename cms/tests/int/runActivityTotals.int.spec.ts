import { randomUUID } from 'node:crypto'
import { createLocalReq, getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadReportCosts } from '@/lib/reportQueries'

// The run bar used to sum the newest 500 cost-log rows in JavaScript, so a long
// run's call count and cost stopped rising at 500. It now asks the SQL aggregate
// for one run; this proves that aggregate counts past the old ceiling.
const ROWS = 520
let payload: Payload
let user: TypedUser
const runId = `activity-${randomUUID()}`

beforeAll(async () => {
  payload = await getPayload({ config })
  const doc = await payload.create({
    collection: 'users',
    data: { email: `${runId}@test.local`, password: 'test-password' },
  })
  user = { ...doc, collection: 'users' }
  for (let start = 0; start < ROWS; start += 40) {
    await Promise.all(
      Array.from({ length: Math.min(40, ROWS - start) }, (_, i) =>
        payload.create({
          collection: 'cost-log',
          overrideAccess: true,
          data: {
            pipelineRunId: runId,
            stage: (start + i) % 2 === 0 ? 'generate' : 'factCheck',
            costUsd: 0.01,
            inputTokens: 1,
            outputTokens: 1,
          },
        }),
      ),
    )
  }
}, 120000)

afterAll(async () => {
  if (user) await payload.delete({ collection: 'users', id: user.id })
})

it('counts and sums every row of a run, not just the newest 500', async () => {
  const req = await createLocalReq({ user }, payload)
  const { aggregate, stages } = await loadReportCosts(req, { pipelineRunId: runId })
  expect(aggregate.rowCount).toBe(ROWS)
  expect(aggregate.totalUsd).toBeCloseTo(ROWS * 0.01, 6)
  expect(stages.map((s) => [s.stage, s.calls]).sort()).toEqual([
    ['factCheck', ROWS / 2],
    ['generate', ROWS / 2],
  ])
})
