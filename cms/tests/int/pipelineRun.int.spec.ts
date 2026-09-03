import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { ActivePipelineRunError, createPipelineRun } from '@/lib/createPipelineRun'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import { EVIDENCE_BANK_FIXTURE, POSITIONING_FIXTURE } from '@/lib/tenant/fixtures'
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
      profile: resolveWorkspaceProfile(null, {}, { mockDefault: true }),
      icps: [{ id: 5, updatedAt: new Date(0).toISOString(), name: 'Demo audience', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-09-02' },
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

  it('records the workspace the run wrote for on the run row', async () => {
    const readiness = evaluateWorkspaceReadiness({
      env: { MOCK_MODE: 'true' },
      models: null,
      activeVoice: { id: 1, updatedAt: new Date(0).toISOString() },
      templates: [{ id: templateId, name: 'Snapshot run', updatedAt: new Date(0).toISOString() }],
      verification: null,
      profile: resolveWorkspaceProfile({ targetDomain: 'acme.example' }, {}),
      icps: [
        { id: 5, updatedAt: new Date(0).toISOString(), name: 'Primary audience', primary: true },
        { id: 6, updatedAt: new Date(0).toISOString(), name: 'Other audience', primary: false },
      ],
      positioning: {
        content: POSITIONING_FIXTURE,
        updatedAt: new Date(0).toISOString(),
      },
      evidenceBank: {
        content: EVIDENCE_BANK_FIXTURE,
        updatedAt: new Date(0).toISOString(),
        asOf: '2026-09-02',
      },
    })
    // The concurrency test above deliberately leaves one run queued, and a
    // second `admin` run refuses to start behind it. Close it out first: this
    // test is about the snapshot, not the one-at-a-time rule.
    await payload.update({
      collection: 'pipeline-runs',
      where: { status: { in: ['queued', 'running'] } },
      data: { status: 'succeeded' },
      overrideAccess: true,
    })
    const runId = randomUUID()
    runIds.push(runId)
    await createPipelineRun(
      payload,
      { id: 1, collection: 'users', email: 'admin@datum.local' } as TypedUser,
      {
        runId,
        source: 'admin',
        templateId,
        count: 1,
        requestedBy: 'admin@datum.local',
        readiness,
      },
    )
    const { docs } = await payload.find({
      collection: 'pipeline-runs',
      where: { runId: { equals: runId } },
      overrideAccess: true,
      depth: 0,
    })
    const snapshot = docs[0]?.configSnapshot as { tenant?: Record<string, unknown> }
    expect(snapshot.tenant).toEqual({
      targetDomain: 'acme.example',
      competitorCount: 0,
      icpId: 5,
      icpCount: 2,
      positioning: 'ready',
      // Counts, not claims: a snapshot carrying the bank's text would grow
      // without bound and duplicate the audit trail, and the counts are enough
      // to explain what a draft was allowed to state when this run wrote it.
      evidenceBank: {
        status: 'ready',
        verified: 3,
        usable: 3,
        expired: 0,
        incomplete: 0,
        facts: 2,
        rejected: 1,
      },
    })
  })

  // The gate itself lives in readiness; this pins that the three assets are
  // what it asks for and that the message names the missing one.
  it('reports a workspace with no active audience as not ready to run', () => {
    const withoutIcp = evaluateWorkspaceReadiness({
      env: { MOCK_MODE: 'true' },
      models: null,
      activeVoice: { id: 1, updatedAt: new Date(0).toISOString() },
      templates: [{ id: templateId, name: 'Gate', updatedAt: new Date(0).toISOString() }],
      verification: null,
      profile: resolveWorkspaceProfile({ targetDomain: 'acme.example' }, {}),
      icps: [],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-09-02' },
    })
    expect(withoutIcp.governance.ready).toBe(false)
    expect(withoutIcp.governance.problems).toEqual([
      'Add and activate at least one audience (ICP)',
    ])
    // Positioning is recommended, so it appears in a separate list and never
    // among the things a run waits on.
    expect(withoutIcp.tenant.positioning.status).toBe('missing')
    expect(withoutIcp.tenant.recommendations).toEqual(['Add positioning', 'Add an evidence bank'])
  })
})
