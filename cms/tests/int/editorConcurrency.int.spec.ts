import { randomUUID } from 'node:crypto'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { BRAND_VOICE_FIXTURE } from '@/lib/brandVoiceFixture'

/**
 * Whole-document saves from the setup editors refuse to overwrite a record that
 * was saved after the form was opened, and the demo workspace's audit rows name
 * the operator who pressed the button.
 */

let payload: Payload
let user: { id: number; email: string }

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: async (args: Parameters<typeof actual.getPayload>[0]) => {
      const instance = await actual.getPayload(args)
      return new Proxy(instance, {
        get(target, prop, receiver) {
          if (prop === 'auth') return async () => ({ user })
          const value = Reflect.get(target, prop, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    },
  }
})

const {
  activateDefaultTenantAction,
  createIcpAction,
  saveAndActivateIcpAction,
  saveEvidenceBankAction,
  saveIcpAction,
  savePositioningAction,
} = await import('@/components/ops/tenantActions')
const { emptyIcpContent, icpContentOf } = await import('@/lib/tenant/icp')
const { emptyPositioningContent } = await import('@/lib/tenant/positioning')
const { ICP_FIXTURE, ICP_FIXTURE_SECONDARY } = await import('@/lib/tenant/fixtures')

const STALE = 'Someone else saved this since you opened it. Reload to see their changes.'
const createdIcpIds: number[] = []

/** A version clearly older than `iso`, as a form opened before the save that made `iso`. */
const before = (iso: string) => new Date(Date.parse(iso) - 60_000).toISOString()

beforeAll(async () => {
  payload = await getPayload({ config })
  const email = `editor-concurrency-${randomUUID().slice(0, 8)}@example.com`
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
      .update({
        collection: 'icps',
        id,
        data: { status: 'draft', primary: false },
        overrideAccess: true,
      })
      .catch(() => undefined)
    await payload.delete({ collection: 'icps', id, overrideAccess: true }).catch(() => undefined)
  }
  await payload
    .delete({ collection: 'users', id: user.id, overrideAccess: true })
    .catch(() => undefined)
})

describe('positioning', () => {
  it('refuses a save opened before someone else saved, and keeps their text', async () => {
    const first = await savePositioningAction({ ...emptyPositioningContent(), category: 'Theirs' })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    // A colleague saves after this form was opened.
    const theirs = await savePositioningAction(
      { ...emptyPositioningContent(), category: 'Colleague edit' },
      first.updatedAt,
    )
    expect(theirs.ok).toBe(true)

    // The form still holds the older version: its save must not win.
    const stale = await savePositioningAction(
      { ...emptyPositioningContent(), category: 'Stale edit' },
      before(first.updatedAt!),
    )
    expect(stale).toEqual({ ok: false, error: STALE })
    const doc = (await payload.findGlobal({
      slug: 'positioning',
      depth: 0,
      overrideAccess: true,
    })) as {
      category?: string
    }
    expect(doc.category).toBe('Colleague edit')
  })

  it('saves when the version it opened on is still the stored one, or none is given', async () => {
    const first = await savePositioningAction({ ...emptyPositioningContent(), category: 'One' })
    if (!first.ok) throw new Error(first.error)
    const second = await savePositioningAction(
      { ...emptyPositioningContent(), category: 'Two' },
      first.updatedAt,
    )
    expect(second.ok).toBe(true)
    const third = await savePositioningAction({ ...emptyPositioningContent(), category: 'Three' })
    expect(third.ok).toBe(true)
  })
})

describe('positioning schema', () => {
  it('holds at most three core claims', async () => {
    const claims = (n: number) => Array.from({ length: n }, (_, i) => ({ claim: `Claim ${i + 1}` }))
    await expect(
      payload.updateGlobal({
        slug: 'positioning',
        data: { coreClaims: claims(4) },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    await expect(
      payload.updateGlobal({
        slug: 'positioning',
        data: { coreClaims: claims(3) },
        overrideAccess: true,
      }),
    ).resolves.toBeTruthy()
  })
})

describe('evidence bank', () => {
  const bank = (fact: string) => ({
    verifiedClaims: [],
    rejectedClaims: [],
    facts: [{ ref: '', fact, source: 'us', owner: '', lastConfirmedAt: '' }],
  })

  it('refuses a save opened before someone else saved', async () => {
    const first = await saveEvidenceBankAction(bank('first'))
    if (!first.ok) throw new Error(first.error)
    const theirs = await saveEvidenceBankAction(bank('colleague fact'), undefined, first.updatedAt)
    expect(theirs.ok).toBe(true)

    const stale = await saveEvidenceBankAction(
      bank('stale fact'),
      undefined,
      before(first.updatedAt!),
    )
    expect(stale).toEqual({ ok: false, error: STALE })
    const doc = (await payload.findGlobal({
      slug: 'evidence-bank',
      depth: 0,
      overrideAccess: true,
    })) as {
      facts?: { fact: string }[]
    }
    expect(doc.facts?.map((row) => row.fact)).not.toContain('stale fact')
  })
})

describe('audiences', () => {
  const complete = (name: string) => ({
    ...emptyIcpContent(name),
    who: 'Runs content for a 60-person company with no writers.',
    pains: [
      {
        statement: 'Ships five pieces nobody can tell apart.',
        evidence: [],
        confidence: 'inference' as const,
      },
    ],
    solution: {
      mechanism: 'A pipeline that stops for a reviewer.',
      sampleLines: [],
      confidence: null,
    },
  })

  it('refuses a save of an audience changed since the form opened, and writes nothing', async () => {
    const created = await createIcpAction(complete(`Concurrency ${randomUUID().slice(0, 8)}`))
    if (!created.ok) throw new Error(created.error)
    createdIcpIds.push(created.id)

    const theirs = await saveIcpAction(
      created.id,
      { ...created.saved, who: 'Their words.' },
      created.updatedAt,
    )
    expect(theirs.ok).toBe(true)

    const stale = await saveIcpAction(
      created.id,
      { ...created.saved, who: 'Stale words.' },
      before(created.updatedAt!),
    )
    expect(stale).toEqual({ ok: false, error: STALE })
    const doc = await payload.findByID({
      collection: 'icps',
      id: created.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(icpContentOf(doc).who).toBe('Their words.')
  })

  it('saves with the current version, and with none', async () => {
    const created = await createIcpAction(complete(`Concurrency ok ${randomUUID().slice(0, 8)}`))
    if (!created.ok) throw new Error(created.error)
    createdIcpIds.push(created.id)
    const saved = await saveIcpAction(
      created.id,
      { ...created.saved, who: 'Edit one.' },
      created.updatedAt,
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.updatedAt).toBeTruthy()
    const again = await saveIcpAction(created.id, { ...created.saved, who: 'Edit two.' })
    expect(again.ok).toBe(true)
  })

  it('save-and-activate refuses a stale form before it activates anything', async () => {
    const created = await createIcpAction(complete(`Concurrency act ${randomUUID().slice(0, 8)}`))
    if (!created.ok) throw new Error(created.error)
    createdIcpIds.push(created.id)
    await saveIcpAction(created.id, { ...created.saved, who: 'Their words.' }, created.updatedAt)

    const stale = await saveAndActivateIcpAction(
      created.id,
      { ...created.saved, who: 'Stale words.' },
      { makePrimary: false, openedAt: before(created.updatedAt!) },
    )
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.error).toBe(STALE)
    const doc = await payload.findByID({
      collection: 'icps',
      id: created.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc.status).toBe('draft')
    expect(icpContentOf(doc).who).toBe('Their words.')
  })
})

describe('demo workspace audit', () => {
  it('attributes every row it writes to the operator, with the demo event', async () => {
    // Make the workspace look new for the pieces that are create-only.
    for (const name of [ICP_FIXTURE.name, ICP_FIXTURE_SECONDARY.name]) {
      const { docs } = await payload.find({
        collection: 'icps',
        where: { name: { equals: name } },
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of docs) {
        await payload.update({
          collection: 'icps',
          id: doc.id,
          data: { status: 'draft', primary: false },
          overrideAccess: true,
        })
        await payload.delete({ collection: 'icps', id: doc.id, overrideAccess: true })
      }
    }
    const { docs: voices } = await payload.find({
      collection: 'brand-voices',
      where: { name: { equals: BRAND_VOICE_FIXTURE.name } },
      depth: 0,
      overrideAccess: true,
    })
    for (const voice of voices) {
      await payload.update({
        collection: 'brand-voices',
        id: voice.id,
        data: { status: 'archived' },
        overrideAccess: true,
      })
      await payload
        .delete({ collection: 'brand-voices', id: voice.id, overrideAccess: true })
        .catch(() => undefined)
    }

    const startedAt = new Date().toISOString()
    expect(await activateDefaultTenantAction()).toEqual({ ok: true })

    const { docs: rows } = await payload.find({
      collection: 'governance-audit',
      where: { createdAt: { greater_than_equal: startedAt } },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    })
    const demo = rows.filter((row) => row.event === 'demo_workspace_applied')
    expect(demo.length).toBeGreaterThan(0)
    // Nothing the button wrote is credited to the system.
    expect(rows.filter((row) => row.actor === 'system' || row.actorType === 'system')).toEqual([])
    for (const row of demo) {
      expect(row.actor).toBe(user.email)
      expect(row.actorType).toBe('user')
    }
    const { docs: created } = await payload.find({
      collection: 'icps',
      where: { name: { in: [ICP_FIXTURE.name, ICP_FIXTURE_SECONDARY.name] } },
      depth: 0,
      overrideAccess: true,
    })
    createdIcpIds.push(...created.map((doc) => doc.id))
  })
})
