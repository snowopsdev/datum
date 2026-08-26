import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { ActivePipelineRunError, createPipelineRun } from '@/lib/createPipelineRun'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let templateId: number
const runIds: string[] = []

describe('pipeline run launch', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const template = await payload.create({
      collection: 'templates',
      overrideAccess: true,
      data: { name: `Atomic run ${randomUUID()}` },
    })
    templateId = template.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'payload-jobs',
      overrideAccess: true,
      where: { 'input.runId': { in: runIds } },
    })
    await payload.delete({
      collection: 'pipeline-runs',
      overrideAccess: true,
      where: { runId: { in: runIds } },
    })
    await payload.delete({ collection: 'templates', id: templateId, overrideAccess: true })
  })

  it('allows only one active run across concurrent launch transactions', async () => {
    const readiness = evaluateWorkspaceReadiness({
      env: { MOCK_MODE: 'true' },
      models: null,
      activeVoice: { id: 1, updatedAt: new Date(0).toISOString() },
      templates: [{ id: templateId, name: 'Atomic run', updatedAt: new Date(0).toISOString() }],
      verification: null,
    })
    const user = { id: 1, collection: 'users', email: 'admin@datum.local' } as TypedUser
    runIds.push(randomUUID(), randomUUID())

    const results = await Promise.allSettled(
      runIds.map((runId) =>
        createPipelineRun(payload, user, {
          runId,
          source: 'admin',
          templateId,
          count: 1,
          requestedBy: 'admin@datum.local',
          readiness,
        }),
      ),
    )

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const rejection = results.find((result) => result.status === 'rejected')
    expect(
      rejection?.status === 'rejected' &&
        (rejection.reason instanceof ActivePipelineRunError || rejection.reason instanceof Error),
    ).toBe(true)

    const active = await payload.find({
      collection: 'pipeline-runs',
      overrideAccess: true,
      pagination: false,
      where: { and: [{ runId: { in: runIds } }, { status: { in: ['queued', 'running'] } }] },
    })
    expect(active.docs).toHaveLength(1)
  })
})
