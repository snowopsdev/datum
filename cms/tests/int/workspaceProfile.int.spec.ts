import config from '@/payload.config'
import { loadWorkspaceSetup } from '@/lib/loadWorkspaceReadiness'
import { resolveWorkspaceProfile, type WorkspaceProfileDoc } from '@/lib/tenant'
import { WorkspaceProfile } from '@/globals/WorkspaceProfile'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

/** Whatever the workspace looked like before this file ran, restored afterwards. */
let original: WorkspaceProfileDoc

const readGlobal = () =>
  payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true })

const auditRowsSince = async (createdAfter: string) => {
  const { docs } = await payload.find({
    collection: 'governance-audit',
    where: {
      and: [
        { subjectGlobal: { equals: 'workspace-profile' } },
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

describe('workspace profile global', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    original = (await readGlobal()) as WorkspaceProfileDoc
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: {
        companyName: original.companyName ?? null,
        targetDomain: original.targetDomain ?? null,
        competitors: (original.competitors ?? []).flatMap((row) =>
          row?.domain ? [{ domain: row.domain, name: row.name ?? null }] : [],
        ),
        siteNotes: original.siteNotes ?? null,
      },
    })
  })

  it('is readable and writable only when signed in', async () => {
    for (const operation of ['read', 'update'] as const) {
      expect(await WorkspaceProfile.access?.[operation]?.({ req: { user: null } } as never)).toBe(
        false,
      )
      expect(
        await WorkspaceProfile.access?.[operation]?.({ req: { user: { id: 1 } } } as never),
      ).toBe(true)
    }
  })

  it('names the environment variables it falls back to', () => {
    expect(WorkspaceProfile.admin?.description).toContain('TARGET_DOMAIN')
    expect(WorkspaceProfile.admin?.description).toContain('COMPETITOR_DOMAINS')
  })

  it('writes an audit row carrying the before and after of every changed field', async () => {
    const startedAt = new Date().toISOString()
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: { companyName: 'Acme Analytics', targetDomain: 'acme.example' },
    })
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: { targetDomain: 'acme-two.example' },
    })

    const rows = await auditRowsSince(startedAt)
    expect(rows.length).toBeGreaterThanOrEqual(2)

    const latest = rows[0]!
    expect(latest.subjectGlobal).toBe('workspace-profile')
    expect(latest.event).toBe('workspace_profile_updated')
    expect(latest.summary).toBe('workspace profile updated')
    const details = latest.details as {
      changedFields: string[]
      before: Record<string, unknown>
      after: Record<string, unknown>
    }
    expect(details.changedFields).toContain('targetDomain')
    expect(details.before.targetDomain).toBe('acme.example')
    expect(details.after.targetDomain).toBe('acme-two.example')
  })

  it('stores competitors as rows the resolver can read back', async () => {
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: {
        targetDomain: 'acme.example',
        competitors: [{ domain: 'rivalone.com', name: 'Rival One' }, { domain: 'rivaltwo.io' }],
      },
    })

    const profile = resolveWorkspaceProfile((await readGlobal()) as WorkspaceProfileDoc, {})

    expect(profile.competitors).toEqual([
      { domain: 'rivalone.com', name: 'Rival One' },
      { domain: 'rivaltwo.io', name: 'rivaltwo.io' },
    ])
  })

  it('lets the admin field win over the environment variable', async () => {
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: { targetDomain: 'acme.example', competitors: [{ domain: 'rivalone.com' }] },
    })
    const doc = (await readGlobal()) as WorkspaceProfileDoc

    const resolved = resolveWorkspaceProfile(doc, {
      TARGET_DOMAIN: 'env.example',
      COMPETITOR_DOMAINS: 'envrival.example',
    })

    expect(resolved.targetDomain).toBe('acme.example')
    expect(resolved.source).toEqual({ targetDomain: 'admin', competitors: 'admin' })
  })

  it('is what loadWorkspaceSetup reports as the workspace readiness', async () => {
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: {
        targetDomain: 'acme.example',
        competitors: [{ domain: 'rivalone.com', name: 'Rival One' }],
      },
    })

    const { readiness } = await loadWorkspaceSetup(payload)

    expect(readiness.tenant.profile.ready).toBe(true)
    expect(readiness.tenant.profile.targetDomain).toBe('acme.example')
    expect(readiness.tenant.profile.competitorCount).toBe(1)
    expect(readiness.tenant.profile.source.targetDomain).toBe('admin')
    // The global answers both variables, so neither is reported as missing.
    expect(readiness.runtime.missing).not.toContain('TARGET_DOMAIN')
    expect(readiness.runtime.missing).not.toContain('COMPETITOR_DOMAINS')
  })
})
