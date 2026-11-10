import { randomUUID } from 'node:crypto'

import { renderToStaticMarkup } from 'react-dom/server'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'

/**
 * The review actions and the public site, against a real database.
 *
 * What a mocked Payload cannot show: that the real `beforeChange` gates let the
 * writes these actions make through (a brief revisit clears an access-guarded
 * group), that a gate's own message comes back as a value, and that a lookup
 * the public site makes really leaves out an archived article.
 */

let payload: Payload
let user: { id: number; email: string }

const authStub = vi.fn(async () => ({ user }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/headers.js', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: async (args: Parameters<typeof actual.getPayload>[0]) => {
      const instance = await actual.getPayload(args)
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

const { revisitBriefAction, saveBriefAction } = await import('@/components/ops/briefActions')
const {
  archiveArticleAction,
  approveArticleAction,
  overrideReviewAction,
  regenerateArticleAction,
  resetToDraftedAction,
  scheduleArticleAction,
  unarchiveArticleAction,
  unscheduleArticleAction,
} = await import('@/components/ops/actions')
const { findPublishedArticle } = await import('@/lib/findPublishedArticle')
const { default: HomePage } = await import('@/app/(frontend)/page')

const makeArticle = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'articles',
    overrideAccess: true,
    data: { keyword: `review actions ${randomUUID()}`, ...data } as never,
  })

const reload = (id: number) =>
  payload.findByID({ collection: 'articles', id, depth: 0, overrideAccess: true })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const doc = await payload.create({
    collection: 'users',
    data: { email: `review-actions-${randomUUID()}@example.com`, password: 'test' },
    overrideAccess: true,
  })
  user = { id: doc.id, email: doc.email }
})

describe('archiving a published article withdraws it from the public site', () => {
  it('findPublishedArticle skips it by slug and by id, and finds it again once unarchived', async () => {
    const slug = `archive-public-${randomUUID()}`
    const article = await makeArticle({ status: 'published', slug, title: 'Public piece' })

    expect((await findPublishedArticle(payload, slug))?.id).toBe(article.id)
    expect((await findPublishedArticle(payload, String(article.id)))?.id).toBe(article.id)

    expect(await archiveArticleAction(article.id)).toEqual({ ok: true })
    expect((await reload(article.id)).status).toBe('published')
    expect(await findPublishedArticle(payload, slug)).toBeNull()
    expect(await findPublishedArticle(payload, String(article.id))).toBeNull()

    expect(await unarchiveArticleAction(article.id)).toEqual({ ok: true })
    expect((await findPublishedArticle(payload, slug))?.id).toBe(article.id)
  })

  it('the home list leaves out an archived piece and keeps its neighbours', async () => {
    const live = await makeArticle({
      status: 'published',
      slug: `home-live-${randomUUID()}`,
      title: `Home live ${randomUUID()}`,
      publishedAt: new Date().toISOString(),
    })
    const archived = await makeArticle({
      status: 'published',
      slug: `home-archived-${randomUUID()}`,
      title: `Home archived ${randomUUID()}`,
      publishedAt: new Date().toISOString(),
      archived: true,
    })
    const html = renderToStaticMarkup(await HomePage())
    expect(html).toContain(live.title as string)
    expect(html).not.toContain(archived.title as string)
  })
})

describe('revisitBriefAction through the real gates', () => {
  it('reopens the brief and clears the schedule, notes, QA and decision it leaves behind', async () => {
    const article = await makeArticle({
      status: 'needs_revision',
      publishAt: new Date(Date.now() + 3_600_000).toISOString(),
      revisionNotes: '- [noveltyFloor] thin',
      brief: { angle: 'Old angle', approvedAt: '2026-01-01T00:00:00.000Z', approvedBy: 'x' },
      qaResults: {
        structural: { passed: false, violations: ['BANNED_PHRASE'] },
        factCheck: { passed: true, notes: 'OK' },
        qualitativeReview: { passed: false, notes: 'too salesy' },
        evidenceCheck: { passed: false, notes: 'unsupported' },
      },
      informationGain: { decision: 'REVISE', verifiedGainUnits: 2 },
    })
    const before = await reload(article.id)
    expect(before.informationGain?.decision).toBe('REVISE')

    const result = await revisitBriefAction(article.id)
    expect(result.ok).toBe(true)

    const after = await reload(article.id)
    expect(after.status).toBe('brief_review')
    expect(after.brief?.approvedAt).toBeNull()
    expect(after.brief?.angle).toBe('Old angle')
    expect(after.publishAt).toBeNull()
    expect(after.revisionNotes).toBeNull()
    expect(after.qaResults?.structural?.passed).toBeNull()
    expect(after.qaResults?.qualitativeReview?.notes).toBeNull()
    expect(after.qaResults?.evidenceCheck?.passed).toBeNull()
    expect(after.informationGain?.decision).toBeNull()
    expect(after.informationGain?.verifiedGainUnits).toBeNull()
  })

  it('refuses while an active run lists the article', async () => {
    const article = await makeArticle({ status: 'needs_revision' })
    const template = await payload.create({
      collection: 'templates',
      data: { name: `Review actions ${randomUUID()}` },
      overrideAccess: true,
    })
    const run = await payload.create({
      collection: 'pipeline-runs',
      overrideAccess: true,
      data: {
        runId: `review-actions-${randomUUID()}`,
        source: 'selected',
        status: 'queued',
        mode: 'mock',
        template: template.id,
        requestedCount: 1,
        articles: [article.id],
        configFingerprint: 'review-actions',
        configSnapshot: {},
        requestedBy: user.email,
      } as never,
    })
    try {
      const result = await revisitBriefAction(article.id)
      expect(result).toEqual({ ok: false, error: expect.stringContaining('active run') })
      expect((await reload(article.id)).status).toBe('needs_revision')
    } finally {
      await payload.update({
        collection: 'pipeline-runs',
        id: run.id,
        overrideAccess: true,
        data: { status: 'failed' } as never,
      })
    }
  })
})

describe('resetToDraftedAction at researched', () => {
  it('refuses and leaves the article where it was', async () => {
    const article = await makeArticle({ status: 'researched' })
    const result = await resetToDraftedAction(article.id, 'again', { queueRun: false })
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not been drafted') })
    expect((await reload(article.id)).status).toBe('researched')
  })
})

describe('a real gate refusal arrives as a value', () => {
  it('overrideReviewAction returns the justification gate’s own message', async () => {
    // A stale justification riding along is what the gate exists to refuse.
    const article = await makeArticle({
      status: 'needs_review',
      reviewJustification: 'same reason as last time',
    })
    const result = await overrideReviewAction(article.id, 'same reason as last time')
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('new reviewJustification'),
    })
    expect((await reload(article.id)).status).toBe('needs_review')
  })

  it('approveArticleAction returns the publication-path gate’s message', async () => {
    const article = await makeArticle({ status: 'drafted' })
    const result = await approveArticleAction(article.id)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/cannot move from drafted to approved/)
    expect((await reload(article.id)).status).toBe('drafted')
  })
})

// The actions read only the article fields they use (`select`); these run the
// real queries, which a mocked `findByID` cannot check.
describe('the narrowed article reads still see what the actions need', () => {
  it('saveBriefAction saves a fresh brief and refuses one opened before another save', async () => {
    const article = await makeArticle({
      status: 'brief_review',
      brief: { angle: 'First', sections: [{ heading: 'A', source: 'template' }] },
    })
    const edits = { angle: 'Second', audience: '', sections: [], notes: '', icpId: null }
    const opened = (await reload(article.id)).updatedAt

    const first = await saveBriefAction(article.id, edits, opened)
    expect(first.ok).toBe(true)
    expect((await reload(article.id)).brief?.angle).toBe('Second')

    // Someone else's save moved `updatedAt` on; this editor still holds `opened`.
    const stale = await saveBriefAction(article.id, { ...edits, angle: 'Third' }, opened)
    expect(stale).toEqual({
      ok: false,
      error: 'Someone else saved this brief since you opened it. Reload to see their changes.',
    })
    expect((await reload(article.id)).brief?.angle).toBe('Second')

    // Holding the version the first save returned, the next save goes through.
    const stored = first.ok ? first.updatedAt : undefined
    expect((await saveBriefAction(article.id, { ...edits, angle: 'Third' }, stored ?? null)).ok).toBe(true)
  })

  it('regenerate builds its notes from the stored QA failure and counts the revision', async () => {
    const article = await makeArticle({
      status: 'needs_revision',
      revisionCount: 1,
      qaResults: {
        structural: { passed: true, violations: [] },
        factCheck: { passed: false, notes: 'unsupported stat' },
      },
    })
    const result = await regenerateArticleAction(article.id, 'tighten it', { queueRun: false })
    expect(result).toEqual({ ok: true, queued: false })
    const after = await reload(article.id)
    expect(after.status).toBe('researched')
    expect(after.revisionCount).toBe(2)
    expect(after.revisionNotes).toContain('unsupported stat')
    expect(after.revisionNotes).toContain('Reviewer note: tighten it')
  })

  it('schedule and unschedule hand back the date they took off', async () => {
    const article = await makeArticle({ status: 'approved' })
    const at = new Date(Date.now() + 86_400_000).toISOString()
    expect(await scheduleArticleAction(article.id, at)).toEqual({ ok: true, publishAt: at })
    expect(await unscheduleArticleAction(article.id)).toEqual({ ok: true, previousPublishAt: at })
    expect((await reload(article.id)).publishAt).toBeNull()

    const draft = await makeArticle({ status: 'drafted' })
    expect(await scheduleArticleAction(draft.id, at)).toEqual({
      ok: false,
      error: 'Only an approved article can be scheduled. Approve it first.',
    })
  })
})
