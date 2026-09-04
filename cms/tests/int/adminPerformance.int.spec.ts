import { randomUUID } from 'node:crypto'
import {
  createLocalReq,
  getPayload,
  type Payload,
  type PayloadRequest,
  type TypedUser,
} from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { loadContentPage } from '@/components/ops/contentListData'
import { readAuditDetails } from '@/lib/readAuditDetails'
import { loadReportCosts } from '@/lib/reportQueries'
import { summarizeReportArticles } from '@/lib/articleReportSummary'

let payload: Payload
let req: PayloadRequest
let user: TypedUser
const prefix = `perf-${randomUUID()}`
const ids: number[] = []
let costId: number
let auditId: number

beforeAll(async () => {
  payload = await getPayload({ config })
  const doc = await payload.create({
    collection: 'users',
    data: { email: `${prefix}@test.local`, password: 'test-password' },
  })
  user = { ...doc, collection: 'users' }
  req = await createLocalReq({ user }, payload)
  for (let i = 0; i < 65; i++) {
    const article = await payload.create({
      collection: 'articles',
      data: {
        status: 'topic_selected',
        keyword: `${prefix} ${i}`,
        title: i === 0 ? `${prefix} Distant Needle` : `${prefix} row ${i}`,
        research: { rankingPagesSummary: 'UNUSED_RESEARCH_MARKER' },
        archived: i === 64,
      },
    })
    ids.push(article.id)
  }
  const audit = await payload.create({
    collection: 'article-audit',
    overrideAccess: true,
    data: {
      article: ids[0],
      actor: 'test',
      actorType: 'system',
      event: 'performance_test',
      summary: 'test',
      details: { evidence: 'audit detail' },
    },
  })
  auditId = audit.id
  const cost = await payload.create({
    collection: 'cost-log',
    overrideAccess: true,
    data: {
      article: ids[0],
      pipelineRunId: prefix,
      stage: 'generate',
      costUsd: 0.25,
      inputTokens: 2,
      outputTokens: 1,
      request: { prompt: 'detail request' },
      response: { answer: 'detail response' },
    },
  })
  costId = cost.id
}, 60000)

afterAll(async () => {
  for (const id of ids)
    await payload.update({ collection: 'articles', id, data: { archived: true } })
  if (user) await payload.delete({ collection: 'users', id: user.id })
})

describe('admin queries against Postgres', () => {
  it('returns only 50 small rows and searches past the first page', async () => {
    const first = await loadContentPage(req, { filter: 'all', q: prefix })
    expect(first.articles).toHaveLength(50)
    expect(first.totalDocs).toBe(64)
    expect(first.totalPages).toBe(2)
    expect(JSON.stringify(first)).not.toContain('UNUSED_RESEARCH_MARKER')
    expect(Object.keys(first.articles[0]).sort()).toEqual([
      'id',
      'keyword',
      'status',
      'templateName',
      'title',
      'totalCostUsd',
      'updatedAt',
    ])
    const second = await loadContentPage(req, { filter: 'all', q: prefix, page: '2' })
    expect(second.articles).toHaveLength(14)
    expect(new Set([...first.articles, ...second.articles].map((a) => a.id)).size).toBe(64)
    const search = await loadContentPage(req, { filter: 'all', q: `${prefix} distant needle` })
    expect(search.articles.map((a) => a.id)).toEqual([ids[0]])
    expect(search.counts).toEqual(first.counts)
    expect((await loadContentPage(req, { filter: 'all', q: prefix, page: '99999' })).page).toBe(2)
    expect((await loadContentPage(req, { filter: 'all', q: prefix, page: '-1' })).page).toBe(1)
  })

  it('returns evidence only for the requested article and event kind', async () => {
    expect(
      await readAuditDetails(payload, user, {
        articleId: ids[0],
        kind: 'audit',
        recordId: auditId,
      }),
    ).toEqual({ ok: true, details: { evidence: 'audit detail' } })
    const result = await readAuditDetails(payload, user, {
      articleId: ids[0],
      kind: 'cost',
      recordId: costId,
    })
    expect(result.ok).toBe(true)
    expect(JSON.stringify(result)).toContain('detail request')
    expect(
      (await readAuditDetails(payload, user, { articleId: ids[1], kind: 'cost', recordId: costId }))
        .ok,
    ).toBe(false)
    expect(
      (
        await readAuditDetails(payload, user, {
          articleId: ids[1],
          kind: 'audit',
          recordId: auditId,
        })
      ).ok,
    ).toBe(false)
  })

  it('accumulates all cost rows beyond 5,000 without reading request bodies', async () => {
    // Real inserts exercise Payload's stored numeric types and pagination.
    for (let offset = 0; offset < 5025; offset += 25) {
      await Promise.all(
        Array.from({ length: 25 }, () =>
          payload.create({
            collection: 'cost-log',
            overrideAccess: true,
            data: {
              pipelineRunId: prefix,
              article: ids[0],
              stage: 'generate',
              costUsd: 0.25,
              inputTokens: 2,
              outputTokens: 1,
              request: { prompt: 'UNUSED_COST_REQUEST' },
            },
          }),
        ),
      )
    }
    const result = await loadReportCosts(req, { pipelineRunId: { equals: prefix } })
    expect(result.aggregate.rowCount).toBe(5026)
    expect(result.aggregate.totalUsd).toBe(5026 * 0.25)
    expect(result.stages[0]).toMatchObject({ calls: 5026, inputTokens: 10052, outputTokens: 5026 })
    expect(JSON.stringify(result)).not.toContain('UNUSED_COST_REQUEST')
    const empty = await loadReportCosts(req, { pipelineRunId: { equals: `${prefix}-empty` } })
    expect(empty.aggregate.rowCount).toBe(0)
  }, 120000)
})

it('report summaries preserve missing decisions, QA denominators, and spend', () => {
  const base = {
    id: 1,
    title: null,
    keyword: 'topic',
    templateName: null,
    totalCostUsd: 2,
    qaResults: undefined,
    informationGain: undefined,
  }
  const summary = summarizeReportArticles([
    {
      ...base,
      status: 'published',
      informationGain: { decision: 'PASS' },
      qaResults: { structural: { passed: true } },
    },
    {
      ...base,
      id: 2,
      status: 'needs_revision',
      qaResults: { structural: { passed: false, violations: ['bad heading'] } },
    },
    { ...base, id: 3, status: 'blocked' },
  ])
  expect(summary.articleCount).toBe(3)
  expect(summary.st).toEqual({ t: 2, p: 1 })
  expect(summary.ig.scored).toBe(1)
  expect(summary.waste).toBe(4)
  expect(summary.failures[0].details).toEqual(['bad heading'])
  expect(summary.igReviewQueue[0].informationGain).toBeNull()
})
