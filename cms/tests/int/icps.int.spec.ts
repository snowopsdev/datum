import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { GovernanceAudit } from '@/collections/GovernanceAudit'
import { Icps } from '@/collections/Icps'
import { ICP_FIXTURE } from '@/lib/tenant/fixtures'
import type { IcpContent } from '@/lib/tenant'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let templateId: number
const createdIds: number[] = []
const createdArticleIds: number[] = []

/** The fixture as the collection stores it, with a unique name per test. */
const icpData = (over: Partial<Record<string, unknown>> = {}, icp: IcpContent = ICP_FIXTURE) => ({
  name: `${icp.name} ${randomUUID().slice(0, 8)}`,
  who: icp.who,
  pains: icp.pains.map((pain) => ({
    statement: pain.statement,
    evidence: pain.evidence.map((row) => ({ ref: row.ref, note: row.note })),
    confidence: pain.confidence,
  })),
  motivation: { ...icp.motivation },
  solution: {
    mechanism: icp.solution.mechanism,
    sampleLines: icp.solution.sampleLines.map((text) => ({ text })),
    confidence: icp.solution.confidence,
  },
  competition: icp.competition.map((row) => ({ ...row })),
  whyUs: { ...icp.whyUs },
  channels: icp.channels.map((row) => ({ ...row })),
  churnTriggers: icp.churnTriggers.map((text) => ({ text })),
  notOurUser: icp.notOurUser.map((text) => ({ text })),
  status: 'draft' as const,
  primary: false,
  ...over,
})

const create = async (over: Partial<Record<string, unknown>> = {}) => {
  const doc = await payload.create({ collection: 'icps', data: icpData(over), overrideAccess: true })
  createdIds.push(doc.id)
  return doc
}

const read = (id: number) =>
  payload.findByID({ collection: 'icps', id, depth: 0, overrideAccess: true })

/** A workspace with no active audience, which is what "the first one" means. */
const archiveEveryActive = () =>
  payload.update({
    collection: 'icps',
    where: { status: { equals: 'active' } },
    data: { primary: false, status: 'archived' },
    overrideAccess: true,
  })

describe('icps collection', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    // The primary flag and the auto-primary rule are both workspace-wide, so
    // an audience some other spec left active would decide this file's
    // answers. Park them; `afterAll` leaves the workspace with none either way.
    await payload.update({
      collection: 'icps',
      where: { status: { equals: 'active' } },
      data: { primary: false, status: 'archived' },
      overrideAccess: true,
    })
    const template = await payload.create({
      collection: 'templates',
      overrideAccess: true,
      data: { name: `Icp spec ${randomUUID()}` },
    })
    templateId = template.id
  })

  afterAll(async () => {
    for (const id of createdArticleIds) {
      await payload
        .delete({ collection: 'articles', id, overrideAccess: true })
        .catch(() => undefined)
    }
    // Drafts delete; anything activated has to be dropped back first, which is
    // the rule this file is testing rather than a workaround for it.
    for (const id of createdIds) {
      await payload
        .update({ collection: 'icps', id, data: { primary: false, status: 'draft' }, overrideAccess: true })
        .catch(() => undefined)
      await payload.delete({ collection: 'icps', id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.delete({ collection: 'templates', id: templateId, overrideAccess: true })
  })

  it('is readable and writable only when signed in', async () => {
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      expect(await Icps.access?.[operation]?.({ req: { user: null } } as never)).toBe(false)
      expect(await Icps.access?.[operation]?.({ req: { user: { id: 1 } } } as never)).toBe(true)
    }
  })

  it('is audited: `icps` is a governance subject the audit collection accepts', () => {
    const subject = GovernanceAudit.fields.find(
      (field) => 'name' in field && field.name === 'subject',
    ) as { relationTo: string[] }
    expect(subject.relationTo).toContain('icps')
  })

  // --- activation ---------------------------------------------------------

  it('refuses to activate an audience that is not complete enough to write against', async () => {
    const draft = await create({ who: null, pains: [], solution: { mechanism: null } })
    await expect(
      payload.update({
        collection: 'icps',
        id: draft.id,
        data: { status: 'active' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/Cannot activate audience/)
    expect((await read(draft.id)).status).toBe('draft')
  })

  it('re-validates an active audience, so it cannot be emptied out in place', async () => {
    const active = await create({ status: 'active' })
    await expect(
      payload.update({
        collection: 'icps',
        id: active.id,
        data: { who: '' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/Cannot save active audience/)
  })

  it('stamps who activated it and when', async () => {
    const draft = await create()
    expect(draft.activatedAt).toBeFalsy()
    const activated = await payload.update({
      collection: 'icps',
      id: draft.id,
      data: { status: 'active' },
      overrideAccess: true,
    })
    expect(activated.activatedAt).toMatch(/^\d{4}-/)
    expect(activated.activatedBy).toBe('system')
  })

  // --- the primary flag ---------------------------------------------------

  it('makes the first audience activated the primary one, without being asked', async () => {
    await archiveEveryActive()
    const first = await create({ status: 'active' })
    expect(first.primary).toBe(true)
  })

  it('moves the primary flag rather than allowing two', async () => {
    await archiveEveryActive()
    const first = await create({ status: 'active' })
    expect(first.primary).toBe(true)
    // A second activation does not steal the flag …
    const second = await create({ status: 'active' })
    expect(second.primary).toBe(false)
    expect((await read(first.id)).primary).toBe(true)

    // … but asking for it does, and the previous holder loses it.
    await payload.update({
      collection: 'icps',
      id: second.id,
      data: { primary: true },
      overrideAccess: true,
    })
    expect((await read(second.id)).primary).toBe(true)
    expect((await read(first.id)).primary).toBe(false)
    // Losing the flag is not the same as being archived: both stay active.
    expect((await read(first.id)).status).toBe('active')
  })

  it('refuses to make a draft the primary audience', async () => {
    const draft = await create()
    await expect(
      payload.update({
        collection: 'icps',
        id: draft.id,
        data: { primary: true },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/Only an active audience can be the primary one/)
  })

  // --- deletion and audit -------------------------------------------------

  it('deletes drafts and refuses anything that has governed a run', async () => {
    const active = await create({ status: 'active' })
    await expect(
      payload.delete({ collection: 'icps', id: active.id, overrideAccess: true }),
    ).rejects.toThrow(/Only draft audiences can be deleted/)

    const draft = await create()
    await payload.delete({ collection: 'icps', id: draft.id, overrideAccess: true })
    await expect(read(draft.id)).rejects.toThrow()
  })

  it('records creation and activation in the governance audit', async () => {
    const draft = await create()
    await payload.update({
      collection: 'icps',
      id: draft.id,
      data: { status: 'active' },
      overrideAccess: true,
    })
    const { docs } = await payload.find({
      collection: 'governance-audit',
      where: { 'subject.value': { equals: draft.id } },
      sort: 'createdAt',
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const events = docs.map((row) => row.event)
    expect(events).toContain('icp_created')
    expect(events).toContain('status_changed')
    const activation = docs.find((row) => row.event === 'status_changed')
    expect(activation?.fromStatus).toBe('draft')
    expect(activation?.toStatus).toBe('active')
  })

  // --- the article relationship ------------------------------------------

  it('carries the audience on an article at depth 0 and depth 1', async () => {
    const audience = await create({ status: 'active' })
    const article = await payload.create({
      collection: 'articles',
      overrideAccess: true,
      data: {
        keyword: `icp relationship ${randomUUID().slice(0, 8)}`,
        status: 'topic_selected',
        template: templateId,
        icp: audience.id,
      },
    })
    createdArticleIds.push(article.id)

    const shallow = await payload.findByID({
      collection: 'articles',
      id: article.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(shallow.icp).toBe(audience.id)

    const deep = await payload.findByID({
      collection: 'articles',
      id: article.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(typeof deep.icp === 'object' && deep.icp?.name).toBe(audience.name)
  })
})
