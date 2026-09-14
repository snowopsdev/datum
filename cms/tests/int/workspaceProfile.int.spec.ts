import config from '@/payload.config'
import { loadWorkspaceSetup } from '@/lib/loadWorkspaceReadiness'
import {
  MOCK_TARGET_DOMAIN,
  resolveWorkspaceProfile,
  type WorkspaceProfileDoc,
} from '@/lib/tenant'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
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

/**
 * A copied-but-unedited `.env.example` names `example.com`, and a workspace
 * that inherits it looks configured while researching a site nobody owns.
 * Resolving the placeholder to nothing is what turns that into an honest gate.
 */
describe('the .env.example placeholders', () => {
  it('treats the placeholder domain as unset and drops placeholder competitors', () => {
    const profile = resolveWorkspaceProfile(null, {
      TARGET_DOMAIN: 'example.com',
      COMPETITOR_DOMAINS: 'competitor-a.com,real.com',
    })

    expect(profile.targetDomain).toBeNull()
    expect(profile.competitors).toEqual([{ domain: 'real.com', name: 'real.com' }])
    expect(profile.placeholderDomain).toBe('example.com')
  })

  it('leaves the demo workspace alone in mock mode', () => {
    const profile = resolveWorkspaceProfile(
      null,
      { TARGET_DOMAIN: 'example.com', COMPETITOR_DOMAINS: 'competitor-a.com,competitor-b.com' },
      { mockDefault: true },
    )

    expect(profile.targetDomain).toBe(MOCK_TARGET_DOMAIN)
    expect(profile.competitors.map((competitor) => competitor.domain)).toEqual([
      'competitor-one.com',
      'competitor-two.com',
    ])
    // Nothing to warn about: the run has a domain, it is just not this one.
    expect(profile.placeholderDomain).toBeNull()
  })

  it('names the placeholder in the problem a run reports, tagged with the step that fixes it', () => {
    const env = { MOCK_MODE: 'false', TARGET_DOMAIN: 'example.com' }
    const readiness = evaluateWorkspaceReadiness({
      env,
      models: null,
      activeVoice: { id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      templates: [{ id: 1, name: 'Listicle', updatedAt: '2026-01-01T00:00:00.000Z' }],
      profile: resolveWorkspaceProfile(null, env),
      icps: [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', name: 'Ops lead', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-01-01' },
    })

    expect(readiness.tenant.profile.ready).toBe(false)
    expect(readiness.governance.problems).toEqual([
      'Set the site Datum writes about (example.com is the placeholder from .env.example)',
    ])
    expect(readiness.governance.blockers).toEqual([
      {
        asset: 'workspace',
        message: 'Set the site Datum writes about (example.com is the placeholder from .env.example)',
      },
    ])
  })

  it('never asks a deploy to set variables that are already set', () => {
    const env = {
      MOCK_MODE: 'false',
      AHREFS_API_KEY: 'configured',
      ANTHROPIC_API_KEY: 'configured',
      OPENAI_API_KEY: 'configured',
      TARGET_DOMAIN: 'example.com',
      COMPETITOR_DOMAINS: 'competitor-a.com,competitor-b.com',
    }
    const readiness = evaluateWorkspaceReadiness({
      env,
      models: null,
      activeVoice: { id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      templates: [{ id: 1, name: 'Listicle', updatedAt: '2026-01-01T00:00:00.000Z' }],
      profile: resolveWorkspaceProfile(null, env),
      icps: [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', name: 'Ops lead', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-01-01' },
    })

    // Both variables are set; their values are the placeholders. Listing them
    // as missing sends whoever deploys this to a file that already has them.
    expect(readiness.runtime.ready).toBe(false)
    expect(readiness.runtime.missing).toEqual([])
    expect(readiness.runtime.problems).toEqual([
      'Replace the .env.example placeholders in TARGET_DOMAIN, COMPETITOR_DOMAINS, or fill in the Workspace step (what is saved there is used instead)',
    ])
    expect(readiness.runtime.blockers).toEqual(readiness.runtime.problems)
  })

  it('still names the variables when they are genuinely unset', () => {
    const env = { MOCK_MODE: 'false', AHREFS_API_KEY: 'configured' }
    const readiness = evaluateWorkspaceReadiness({
      env,
      models: null,
      activeVoice: { id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      templates: [{ id: 1, name: 'Listicle', updatedAt: '2026-01-01T00:00:00.000Z' }],
      profile: resolveWorkspaceProfile(null, env),
      icps: [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', name: 'Ops lead', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-01-01' },
    })

    expect(readiness.runtime.missing).toContain('TARGET_DOMAIN')
    expect(readiness.runtime.missing).toContain('COMPETITOR_DOMAINS')
    expect(readiness.runtime.problems).toEqual([])
  })

  it('keeps the plain sentence when no placeholder is involved', () => {
    const env = { MOCK_MODE: 'false' }
    const readiness = evaluateWorkspaceReadiness({
      env,
      models: null,
      activeVoice: { id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      templates: [{ id: 1, name: 'Listicle', updatedAt: '2026-01-01T00:00:00.000Z' }],
      profile: resolveWorkspaceProfile(null, env),
      icps: [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', name: 'Ops lead', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-01-01' },
    })

    expect(readiness.governance.problems).toEqual(['Set the target domain'])
  })
})
