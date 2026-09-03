import { randomUUID } from 'node:crypto'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { GovernanceAudit } from '@/payload-types'

/**
 * The setup editors' save actions, against a real database.
 *
 * These actions exist to do two things a mocked payload cannot show: run the
 * collection and global hooks (the ICP activation gate, the single-primary
 * cascade, the evidence-bank ref counter) and write governance audit rows. So
 * only the two pieces of Next that a server action cannot have in vitest are
 * mocked — the request headers and the cache revalidation — and `getPayload`
 * hands back the real instance with `auth` stubbed to a seeded user.
 */

let payload: Payload
let user: { id: number; email: string }

const authStub = vi.fn(async () => ({ user }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: async (args: Parameters<typeof actual.getPayload>[0]) => {
      const instance = await actual.getPayload(args)
      // A proxy rather than a copy: Payload's methods read `this.db`, so they
      // are bound back to the real instance and only `auth` is replaced.
      return new Proxy(instance, {
        get(target, prop, receiver) {
          if (prop === 'auth') return authStub
          const value = Reflect.get(target, prop, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    },
  }
})

const {
  activateDefaultTenantAction,
  activateIcpAction,
  archiveIcpAction,
  createIcpAction,
  deleteIcpDraftAction,
  saveEvidenceBankAction,
  saveIcpAction,
  savePositioningAction,
  saveWorkspaceProfileAction,
  setPrimaryIcpAction,
} = await import('@/components/ops/tenantActions')

const { emptyIcpContent } = await import('@/lib/tenant/icp')
const { emptyPositioningContent } = await import('@/lib/tenant/positioning')
const { ICP_FIXTURE, ICP_FIXTURE_SECONDARY } = await import('@/lib/tenant/fixtures')

const createdIcpIds: number[] = []

/** A complete-enough audience: name, who, one pain, a mechanism. */
const completeIcp = (name: string) => ({
  ...emptyIcpContent(name),
  who: 'Runs content for a 60-person company with no writers.',
  pains: [{ statement: 'Ships five pieces a month nobody can tell apart.', evidence: [], confidence: 'inference' as const }],
  solution: { mechanism: 'A pipeline that stops for a reviewer.', sampleLines: [], confidence: null },
})

const auditRows = async (event: string) => {
  const { docs } = await payload.find({
    collection: 'governance-audit',
    where: { event: { equals: event } },
    depth: 0,
    limit: 10,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return docs as GovernanceAudit[]
}

beforeAll(async () => {
  payload = await getPayload({ config })
  const email = `tenant-actions-${randomUUID().slice(0, 8)}@example.com`
  const created = await payload.create({
    collection: 'users',
    data: { email, password: randomUUID() },
    overrideAccess: true,
  })
  user = { id: created.id, email }
})

afterAll(async () => {
  for (const id of createdIcpIds) {
    await payload
      .update({ collection: 'icps', id, data: { status: 'draft', primary: false }, overrideAccess: true })
      .catch(() => undefined)
    await payload.delete({ collection: 'icps', id, overrideAccess: true }).catch(() => undefined)
  }
  if (user) {
    await payload.delete({ collection: 'users', id: user.id, overrideAccess: true }).catch(() => undefined)
  }
})

describe('saveWorkspaceProfileAction', () => {
  it('normalises pasted URLs into bare domains, drops junk, and audits the change', async () => {
    const result = await saveWorkspaceProfileAction({
      companyName: '  Acme  ',
      targetDomain: 'https://Acme.example.com/pricing?utm=1',
      siteNotes: ' We sell to clinics. ',
      competitors: [
        { domain: 'HTTPS://Rival.example.com/', name: 'Rival' },
        { domain: 'rival.example.com', name: 'Duplicate' },
        { domain: 'localhost', name: 'Not a site' },
        { domain: 'other.example.com', name: '' },
      ],
    })

    expect(result.ok).toBe(true)
    const doc = (await payload.findGlobal({
      slug: 'workspace-profile',
      depth: 0,
      overrideAccess: true,
    })) as { companyName?: string; targetDomain?: string; competitors?: { domain: string; name: string }[] }
    expect(doc.targetDomain).toBe('acme.example.com')
    expect(doc.companyName).toBe('Acme')
    expect(doc.competitors?.map((row) => row.domain)).toEqual([
      'rival.example.com',
      'other.example.com',
    ])
    // A competitor nobody named is called by its domain, so prose never has a blank.
    expect(doc.competitors?.[1]?.name).toBe('other.example.com')

    const rows = await auditRows('workspace_profile_updated')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].actor).toBe(user.email)
    expect(rows[0].summary).toContain('acme.example.com')
  })

  it('saves a blank form and reports against the resolved profile, not the fields', async () => {
    const result = await saveWorkspaceProfileAction({
      companyName: '',
      targetDomain: '',
      siteNotes: '',
      competitors: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = (await payload.findGlobal({
      slug: 'workspace-profile',
      depth: 0,
      overrideAccess: true,
    })) as { targetDomain?: string; competitors?: unknown[] }
    expect(doc.targetDomain).toBe('')
    expect(doc.competitors ?? []).toHaveLength(0)
    // Nothing is outstanding even so: the problems come from the *resolved*
    // profile, and a mock run falls back to the demo domain and competitors.
    // Clearing the fields is not the same as blocking a run.
    expect(result.problems).toEqual([])

    // Put the workspace back, because every other spec in this suite shares
    // one database and several of them resolve this global.
    await saveWorkspaceProfileAction({
      companyName: 'Acme',
      targetDomain: 'acme.example.com',
      siteNotes: '',
      competitors: [{ domain: 'rival.example.com', name: 'Rival' }],
    })
  })
})

describe('audience lifecycle', () => {
  it('creates a draft, saves it, activates, moves primary, and archives', async () => {
    const nameA = `Editor ${randomUUID().slice(0, 8)}`
    const created = await createIcpAction(completeIcp(nameA))
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdIcpIds.push(created.id)

    const saved = await saveIcpAction(created.id, {
      ...completeIcp(nameA),
      who: 'Owns content for a 60-person company.',
    })
    expect(saved).toEqual({ ok: true, problems: [] })

    const activated = await activateIcpAction(created.id)
    expect(activated).toEqual({ ok: true })
    const afterActivation = await payload.findByID({
      collection: 'icps',
      id: created.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterActivation.status).toBe('active')
    expect(afterActivation.activatedBy).toBe(user.email)

    // A second audience, activated and then made primary: the cascade has to
    // move the flag rather than leave two.
    const nameB = `Founder ${randomUUID().slice(0, 8)}`
    const second = await createIcpAction(completeIcp(nameB))
    expect(second.ok).toBe(true)
    if (!second.ok) return
    createdIcpIds.push(second.id)
    expect(await activateIcpAction(second.id)).toEqual({ ok: true })
    expect(await setPrimaryIcpAction(second.id)).toEqual({ ok: true })

    const first = await payload.findByID({ collection: 'icps', id: created.id, depth: 0, overrideAccess: true })
    const other = await payload.findByID({ collection: 'icps', id: second.id, depth: 0, overrideAccess: true })
    expect(other.primary).toBe(true)
    expect(first.primary).toBe(false)

    const archived = await archiveIcpAction(second.id)
    expect(archived).toEqual({ ok: true })
    const afterArchive = await payload.findByID({
      collection: 'icps',
      id: second.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterArchive.status).toBe('archived')
    expect(afterArchive.primary).toBe(false)

    expect((await auditRows('icp_activated')).length).toBeGreaterThan(0)
  })

  it('surfaces the activation gate’s own words instead of throwing', async () => {
    const created = await createIcpAction({
      ...emptyIcpContent(`Half done ${randomUUID().slice(0, 8)}`),
      who: 'Somebody.',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdIcpIds.push(created.id)

    const result = await activateIcpAction(created.id)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Cannot activate audience')
    expect(result.error).toContain('Add at least one pain statement')
  })

  it('deletes a draft and refuses to delete an active audience', async () => {
    const draft = await createIcpAction(completeIcp(`Throwaway ${randomUUID().slice(0, 8)}`))
    expect(draft.ok).toBe(true)
    if (!draft.ok) return
    expect(await deleteIcpDraftAction(draft.id)).toEqual({ ok: true })

    const active = await createIcpAction(completeIcp(`Kept ${randomUUID().slice(0, 8)}`))
    expect(active.ok).toBe(true)
    if (!active.ok) return
    createdIcpIds.push(active.id)
    await activateIcpAction(active.id)
    const refused = await deleteIcpDraftAction(active.id)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.error).toContain('Only draft audiences can be deleted')
  })
})

/**
 * "Start with the demo workspace" fills the gaps and touches nothing else.
 *
 * The button exists so a new workspace can make its first piece without filling
 * in four forms, and an operator who has done some of that work will press it
 * for the rest. Everything it writes has to be create-only: an audience is the
 * most considered thing in the workspace, and one overwritten by a demo fixture
 * is gone.
 */
describe('activateDefaultTenantAction', () => {
  const findByName = async (name: string) => {
    const { docs } = await payload.find({
      collection: 'icps',
      where: { name: { equals: name } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return docs[0]
  }

  const removeFixtureIcps = async () => {
    for (const name of [ICP_FIXTURE.name, ICP_FIXTURE_SECONDARY.name]) {
      const doc = await findByName(name)
      if (!doc) continue
      await payload
        .update({
          collection: 'icps',
          id: doc.id,
          data: { status: 'draft', primary: false },
          overrideAccess: true,
        })
        .catch(() => undefined)
      await payload.delete({ collection: 'icps', id: doc.id, overrideAccess: true }).catch(() => undefined)
    }
  }

  it('leaves an edited audience of the same name exactly as it was', async () => {
    await removeFixtureIcps()
    // The demo audience, taken over and rewritten: same name, the operator's
    // words, and archived because they are not using it this quarter.
    const mine = await payload.create({
      collection: 'icps',
      overrideAccess: true,
      data: {
        ...completeIcp(ICP_FIXTURE.name),
        who: 'My own words about my own buyer.',
        status: 'draft',
        primary: false,
      } as never,
    })
    createdIcpIds.push(mine.id)

    // And a real, active, primary audience of their own that the cascade must
    // not be allowed to demote.
    const theirs = await createIcpAction(completeIcp(`Mine ${randomUUID().slice(0, 8)}`))
    expect(theirs.ok).toBe(true)
    if (!theirs.ok) return
    createdIcpIds.push(theirs.id)
    await activateIcpAction(theirs.id)
    await setPrimaryIcpAction(theirs.id)

    expect(await activateDefaultTenantAction()).toEqual({ ok: true })

    const after = await payload.findByID({ collection: 'icps', id: mine.id, depth: 0, overrideAccess: true })
    expect(after.who).toBe('My own words about my own buyer.')
    expect(after.status).toBe('draft')
    expect(after.primary).toBe(false)

    const stillPrimary = await payload.findByID({
      collection: 'icps',
      id: theirs.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stillPrimary.status).toBe('active')
    expect(stillPrimary.primary).toBe(true)

    // The audience it did create goes in as a draft, because activating it
    // would have moved `primary` off the one they chose.
    const secondary = await findByName(ICP_FIXTURE_SECONDARY.name)
    expect(secondary?.status).toBe('draft')
    expect(secondary?.primary).toBe(false)
    if (secondary) createdIcpIds.push(secondary.id)
  })

  it('creates both demo audiences, active and primary, when nothing is active', async () => {
    await removeFixtureIcps()
    // Park every audience this suite has made, so the workspace really has
    // nothing live — the state a brand-new install is in.
    const { docs: live } = await payload.find({
      collection: 'icps',
      where: { status: { equals: 'active' } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const doc of live) {
      await payload.update({
        collection: 'icps',
        id: doc.id,
        data: { status: 'draft', primary: false },
        overrideAccess: true,
      })
    }

    expect(await activateDefaultTenantAction()).toEqual({ ok: true })

    const primary = await findByName(ICP_FIXTURE.name)
    const secondary = await findByName(ICP_FIXTURE_SECONDARY.name)
    if (primary) createdIcpIds.push(primary.id)
    if (secondary) createdIcpIds.push(secondary.id)
    expect(primary?.status).toBe('active')
    expect(primary?.primary).toBe(true)
    expect(secondary?.status).toBe('active')
    expect(secondary?.primary).toBe(false)

    // Pressing it twice changes nothing, which is the point of create-only.
    await payload.update({
      collection: 'icps',
      id: primary!.id,
      data: { who: 'Edited after the first press.' },
      overrideAccess: true,
    })
    expect(await activateDefaultTenantAction()).toEqual({ ok: true })
    const again = await findByName(ICP_FIXTURE.name)
    expect(again?.id).toBe(primary?.id)
    expect(again?.who).toBe('Edited after the first press.')
    const { totalDocs } = await payload.find({
      collection: 'icps',
      where: { name: { equals: ICP_FIXTURE.name } },
      depth: 0,
      limit: 0,
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })
})

describe('savePositioningAction', () => {
  it('saves what is written and reports the rest', async () => {
    const result = await savePositioningAction({
      ...emptyPositioningContent(),
      category: 'Content pipelines',
      activePosition: 'the pipeline with a reviewer gate',
      coreClaims: [{ claim: 'Every claim carries its evidence.', evidenceRef: '[e4]' }],
      // An empty date must reach Postgres as null, not ''.
      openRulings: [{ question: 'Agent or pipeline?', status: 'open', ruling: '', ruledAt: '' }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.problems).toContain('Write the customer promise')
    expect(result.problems.some((p) => p.startsWith('Write exactly three core claims'))).toBe(true)

    const doc = (await payload.findGlobal({
      slug: 'positioning',
      depth: 0,
      overrideAccess: true,
    })) as { category?: string; coreClaims?: { evidenceRef?: string }[] }
    expect(doc.category).toBe('Content pipelines')
    // The parser strips the brackets and upper-cases, so `[e4]` and `E4` are
    // the same entry however it was typed.
    expect(doc.coreClaims?.[0]?.evidenceRef).toBe('E4')
    expect((await auditRows('positioning_updated')).length).toBeGreaterThan(0)
  })
})

describe('saveEvidenceBankAction', () => {
  it('keeps saved refs and lets the hook mint one for a new row', async () => {
    const first = await saveEvidenceBankAction({
      verifiedClaims: [{
        claim: 'Reviewers approve 92% of briefs unchanged.',
        primarySource: 'Internal analytics',
        sourceUrl: '',
        sourceDate: '',
        sampleOrMethod: '412 briefs',
        verificationDepth: 'self_reported',
        limits: 'Approval, not quality.',
        clearedSurfaces: [],
        recheckAt: '',
      }],
      facts: [],
      rejectedClaims: [],
    })
    expect(first.ok).toBe(true)

    const afterFirst = (await payload.findGlobal({
      slug: 'evidence-bank',
      depth: 0,
      overrideAccess: true,
    })) as { verifiedClaims?: { ref: string; claim: string }[] }
    const assigned = afterFirst.verifiedClaims?.[0]?.ref
    expect(assigned).toMatch(/^E\d+$/)

    // The saved row goes back with its ref; the new one carries none.
    const second = await saveEvidenceBankAction({
      verifiedClaims: (afterFirst.verifiedClaims ?? []).map((row) => ({
        ...row,
        primarySource: '',
        sourceUrl: '',
        sourceDate: '',
        sampleOrMethod: '',
        verificationDepth: 'self_reported' as const,
        limits: '',
        clearedSurfaces: [],
        recheckAt: '',
      })),
      facts: [{ fact: 'Founded in 2024.', source: 'About page', owner: 'ops', lastConfirmedAt: '' }],
      rejectedClaims: [],
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    // The action hands back the saved document, which is how the editor shows
    // a just-typed row the ref a draft would cite it by.
    expect(second.saved.facts[0]?.ref).toMatch(/^F\d+$/)
    expect(second.saved.verifiedClaims[0]?.ref).toBe(assigned)

    const afterSecond = (await payload.findGlobal({
      slug: 'evidence-bank',
      depth: 0,
      overrideAccess: true,
    })) as { verifiedClaims?: { ref: string }[]; facts?: { ref: string }[] }
    expect(afterSecond.verifiedClaims?.[0]?.ref).toBe(assigned)
    const factRef = afterSecond.facts?.[0]?.ref ?? ''
    expect(factRef).toMatch(/^F\d+$/)
    // Never reused: the fact's number is past the claim's.
    expect(Number(factRef.slice(1))).toBeGreaterThan(Number((assigned ?? 'E0').slice(1)))
    expect((await auditRows('evidence_bank_updated')).length).toBeGreaterThan(0)
  })

  it('drops a row with no text rather than saving a blank claim', async () => {
    const result = await saveEvidenceBankAction({
      verifiedClaims: [],
      facts: [],
      rejectedClaims: [{ claim: '   ', status: 'rejected', reason: 'typo', replacement: '' }],
    })
    expect(result.ok).toBe(true)
    const doc = (await payload.findGlobal({
      slug: 'evidence-bank',
      depth: 0,
      overrideAccess: true,
    })) as { rejectedClaims?: unknown[] }
    expect(doc.rejectedClaims ?? []).toHaveLength(0)
  })
})
