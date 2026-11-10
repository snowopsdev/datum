import assert from 'node:assert/strict'
import { it } from 'node:test'

import type { Payload } from 'payload'

import type { AhrefsClient } from '../src/ahrefs'
import { emptyTenantContext, emptyIcpContent } from '../src/tenant'
import { fetchTopics } from '../src/fetchTopics'

it('creates the requested number of unique topics with the selected template', async () => {
  const keywords = ['already exists', 'first new topic', 'second new topic']
  const created: Array<Record<string, unknown>> = []
  const payload = {
    find: async ({ where }: { where: { keyword: { in: string[] } } }) => ({
      docs: where.keyword.in.includes('already exists')
        ? [{ id: 9, keyword: 'already exists' }]
        : [],
    }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: created.length + 20, ...data }
    },
  } as unknown as Payload
  const ahrefs: AhrefsClient = {
    contentGapKeywords: async () =>
      keywords.map((keyword, index) => ({
        keyword,
        volume: 300 - index * 10,
        difficulty: 10,
        bestCompetitorPosition: index + 1,
      })),
    discoverKeywords: async () => [],
    serpResearch: async () => ({
      rankingPagesSummary: '',
      commonSubtopics: [],
      relatedQuestions: [],
      pages: [],
    }),
  }

  const result = await fetchTopics(
    { payload, ahrefs, mode: 'mock', runId: 'run-1', tenant: emptyTenantContext() },
    { count: 2, templateId: 44 },
  )

  assert.deepEqual(result.createdIds, [21, 22])
  assert.deepEqual(result.skippedIds, [9])
  assert.deepEqual(
    created.map((data) => [data.keyword, data.template, data.status]),
    [
      ['first new topic', 44, 'topic_selected'],
      ['second new topic', 44, 'topic_selected'],
    ],
  )
})

it('skips excluded keywords without spending a model call or exhausting the create quota', async () => {
  const created: string[] = []
  const tenant = {...emptyTenantContext(),icps:[{...emptyIcpContent('Home'),notOurUser:['Wholesale buyers']}]}
  const ctx = {tenant,runId:'exclude',mode:'mock' as const,payload:{find:async()=>({docs:[]}),create:async({data}:{data:{keyword:string}})=>{created.push(data.keyword);return {id:created.length}}} as unknown as Payload,ahrefs:{contentGapKeywords:async()=>[{keyword:'espresso grinders for wholesale buyers',volume:999,difficulty:1},{keyword:'espresso grinder',volume:10,difficulty:1}]} as AhrefsClient}
  await fetchTopics(ctx,{count:1,templateId:1})
  assert.deepEqual(created,['espresso grinder'])
})

it('creates no topic once the run signal is aborted', async () => {
  const created: string[] = []
  let asked = false
  const controller = new AbortController()
  controller.abort(new Error('lease lost'))
  const ctx = {
    tenant: emptyTenantContext(),
    runId: 'aborted',
    mode: 'mock' as const,
    signal: controller.signal,
    payload: {
      find: async () => ({ docs: [] }),
      create: async ({ data }: { data: { keyword: string } }) => {
        created.push(data.keyword)
        return { id: created.length }
      },
    } as unknown as Payload,
    ahrefs: {
      contentGapKeywords: async () => {
        asked = true
        return [{ keyword: 'espresso grinder', volume: 10, difficulty: 1 }]
      },
    } as unknown as AhrefsClient,
  }
  await assert.rejects(fetchTopics(ctx, { count: 1, templateId: 1 }), /lease lost/)
  assert.equal(asked, false)
  assert.deepEqual(created, [])
})

it('creates each topic through the run fence, and stops when it refuses', async () => {
  const created: string[] = []
  const requests: unknown[] = []
  const fence = { req: { transactionID: 'lock' }, owns: true }
  const ctx = {
    tenant: emptyTenantContext(),
    runId: 'fenced',
    mode: 'mock' as const,
    payload: {
      find: async () => ({ docs: [] }),
      create: async ({ data, req }: { data: { keyword: string }; req?: unknown }) => {
        created.push(data.keyword)
        requests.push(req)
        // Recovery takes the row after the first topic lands.
        fence.owns = false
        return { id: created.length }
      },
    } as unknown as Payload,
    ahrefs: {
      contentGapKeywords: async () => [
        { keyword: 'first topic', volume: 20, difficulty: 1, bestCompetitorPosition: 1 },
        { keyword: 'second topic', volume: 10, difficulty: 1, bestCompetitorPosition: 2 },
      ],
    } as unknown as AhrefsClient,
  }
  const commitArticle = async (write: (req?: never) => Promise<void>) => {
    if (!fence.owns) return false
    await write(fence.req as never)
    return true
  }
  await assert.rejects(
    fetchTopics(ctx, { count: 2, templateId: 1, commitArticle }),
    /no longer owns its row/,
  )
  assert.deepEqual(created, ['first topic'])
  assert.deepEqual(requests, [fence.req])
})
