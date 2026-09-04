import config from '@/payload.config'
import { Positioning } from '@/globals/Positioning'
import { loadWorkspaceSetup } from '@/lib/loadWorkspaceReadiness'
import { positioningContentOf, positioningStatus } from '@/lib/tenant'
import { positioningFixtureDoc } from '@/lib/tenant/fixtures'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadTenantContext } from '../../../pipeline/src/tenant'

let payload: Payload

/**
 * Every field the global owns, blanked. Used to restore the workspace between
 * tests: `updateGlobal` merges, so clearing has to be explicit or a later test
 * reads the previous one's rows.
 */
const EMPTY_GLOBAL = {
  category: null,
  goal: null,
  promise: null,
  activePosition: null,
  statement: null,
  macroFrame: null,
  landscape: null,
  coreClaims: [],
  pillars: [],
  enemy: null,
  archetype: null,
  essence: null,
  descriptorLadder: [],
  vocabularyReachFor: [],
  vocabularyAvoid: [],
  openRulings: [],
  notes: null,
}

const readGlobal = () =>
  payload.findGlobal({ slug: 'positioning', depth: 0, overrideAccess: true })

const clear = () =>
  payload.updateGlobal({ slug: 'positioning', data: EMPTY_GLOBAL, overrideAccess: true })

const auditRowsSince = async (createdAfter: string) => {
  const { docs } = await payload.find({
    collection: 'governance-audit',
    where: {
      and: [
        { subjectGlobal: { equals: 'positioning' } },
        { createdAt: { greater_than_equal: createdAfter } },
      ],
    },
    sort: '-createdAt',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return docs
}

describe('positioning global', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await clear()
  })

  afterAll(async () => {
    await clear()
  })

  it('is readable and writable only when signed in', async () => {
    for (const operation of ['read', 'update'] as const) {
      expect(await Positioning.access?.[operation]?.({ req: { user: null } } as never)).toBe(false)
      expect(await Positioning.access?.[operation]?.({ req: { user: { id: 1 } } } as never)).toBe(
        true,
      )
    }
  })

  it('stores every field the parser reads back', async () => {
    await payload.updateGlobal({
      slug: 'positioning',
      overrideAccess: true,
      data: positioningFixtureDoc(),
    })

    const content = positioningContentOf(await readGlobal())

    expect(positioningStatus(content)).toBe('ready')
    expect(content.category).toBe('governed content pipeline for small B2B software teams')
    expect(content.coreClaims).toHaveLength(3)
    expect(content.pillars[0]?.name).toBe('Governance')
    // Row order is the ladder, so it has to survive the round trip intact.
    expect(content.descriptorLadder.map((row) => row.descriptor)).toEqual([
      'software',
      'content platform',
      'governed content pipeline',
    ])
    expect(content.openRulings[0]?.status).toBe('open')
    // The operator's notes are stored but never reach the prompt renderer's
    // input type, so they cannot leak into a draft.
    expect(content).not.toHaveProperty('notes')
  })

  it('writes an audit row carrying the before and after of every changed field', async () => {
    await clear()
    const startedAt = new Date().toISOString()
    await payload.updateGlobal({
      slug: 'positioning',
      overrideAccess: true,
      data: { category: 'analytics for support teams', essence: 'calm certainty' },
    })
    await payload.updateGlobal({
      slug: 'positioning',
      overrideAccess: true,
      data: { category: 'analytics for support leads' },
    })

    const rows = await auditRowsSince(startedAt)
    expect(rows.length).toBeGreaterThanOrEqual(2)

    const latest = rows[0]!
    expect(latest.subjectGlobal).toBe('positioning')
    expect(latest.event).toBe('positioning_updated')
    expect(latest.summary).toBe('positioning updated')
    const details = latest.details as {
      changedFields: string[]
      before: Record<string, unknown>
      after: Record<string, unknown>
    }
    expect(details.changedFields).toContain('category')
    expect(details.before.category).toBe('analytics for support teams')
    expect(details.after.category).toBe('analytics for support leads')
  })

  it('reaches a run as null until something is saved, and as content after', async () => {
    await clear()
    const empty = await loadTenantContext(payload, { mode: 'mock', asOf: '2026-09-01' })
    expect(empty.positioning).toBeNull()

    await payload.updateGlobal({
      slug: 'positioning',
      overrideAccess: true,
      data: positioningFixtureDoc(),
    })
    const filled = await loadTenantContext(payload, { mode: 'mock', asOf: '2026-09-01' })
    expect(filled.positioning?.activePosition).toBe('the content pipeline with a reviewer gate')
    expect(filled.positioning?.coreClaims).toHaveLength(3)
  })

  it('is a recommendation in readiness, never a blocker', async () => {
    await clear()
    const missing = await loadWorkspaceSetup(payload)
    expect(missing.readiness.tenant.positioning.status).toBe('missing')
    expect(missing.readiness.tenant.recommendations).toContain('Add positioning')
    expect(missing.readiness.governance.problems).not.toContain('Add positioning')

    await payload.updateGlobal({
      slug: 'positioning',
      overrideAccess: true,
      data: positioningFixtureDoc(),
    })
    const ready = await loadWorkspaceSetup(payload)
    expect(ready.readiness.tenant.positioning.status).toBe('ready')
    // The evidence bank recommends itself separately; this spec owns only the
    // positioning half of the list.
    expect(ready.readiness.tenant.recommendations).not.toContain('Add positioning')
    expect(
      ready.readiness.tenant.recommendations.some((row) => row.startsWith('Finish positioning')),
    ).toBe(false)
    // Saving it moves the fingerprint, so a verification run done before the
    // position existed is correctly reported as stale.
    expect(ready.readiness.configFingerprint).not.toBe(missing.readiness.configFingerprint)
  })
})
