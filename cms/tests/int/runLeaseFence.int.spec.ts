import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Stage } from '../../../pipeline/src/stages'

// The real stage loop with one fake stage, so these tests exercise the actual
// article write the loop commits; only the workspace inputs are faked.
const fake = vi.hoisted(() => ({ stages: [] as Stage[], ahrefs: {} as unknown }))

vi.mock('../../../pipeline/src/runContext', () => ({
  loadStageInputs: vi.fn().mockResolvedValue({
    tenant: { profile: { targetDomain: 'example.com' }, icps: [{ id: 1, primary: true }] },
    brandVoice: { name: 'Test voice' },
  }),
  buildStageContext: vi.fn((payload: unknown, runId: string, mode: string) => ({
    payload,
    runId,
    mode,
    tenant: { icps: [] },
    ahrefs: fake.ahrefs,
  })),
}))
vi.mock('../../../pipeline/src/stages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../pipeline/src/stages')>()
  return {
    ...actual,
    runPipeline: (
      ctx: Parameters<typeof actual.runPipeline>[0],
      options: Parameters<typeof actual.runPipeline>[1],
    ) => actual.runPipeline(ctx, { ...options, stages: fake.stages }),
  }
})

import config from '@/payload.config'
import { executeContentRun } from '@/jobs/contentRun'
import type { PipelineRun } from '@/payload-types'

let payload: Payload
let templateId: number
const articleIds: number[] = []
const runIds: number[] = []

async function topic() {
  const article = await payload.create({
    collection: 'articles',
    data: { keyword: `fence ${randomUUID()}`, status: 'topic_selected', template: templateId },
    depth: 0,
  })
  articleIds.push(article.id)
  return article
}

async function selectedRun(articleId: number): Promise<PipelineRun> {
  const run = await payload.create({
    collection: 'pipeline-runs',
    overrideAccess: true,
    data: {
      runId: randomUUID(),
      source: 'selected',
      status: 'queued',
      mode: 'mock',
      template: templateId,
      requestedCount: 1,
      articles: [articleId],
      requestedBy: 'test',
      configFingerprint: 'test',
      configSnapshot: {},
    },
  })
  runIds.push(run.id)
  return run
}

const readArticle = (id: number) =>
  payload.findByID({ collection: 'articles', id, depth: 0, overrideAccess: true })
const readRun = (id: number) =>
  payload.findByID({ collection: 'pipeline-runs', id, depth: 0, overrideAccess: true })

const quietly = async <T>(body: () => Promise<T>): Promise<T> => {
  const spies = (['log', 'warn', 'error'] as const).map((name) =>
    vi.spyOn(console, name).mockImplementation(() => {}),
  )
  try {
    return await body()
  } finally {
    for (const spy of spies) spy.mockRestore()
  }
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const template = await payload.create({
    collection: 'templates',
    data: { name: `Fence ${randomUUID()}` },
  })
  templateId = template.id
})

afterAll(async () => {
  for (const id of runIds) {
    await payload.delete({ collection: 'pipeline-runs', id, overrideAccess: true })
  }
  for (const id of articleIds) {
    await payload.update({
      collection: 'articles',
      id,
      data: { archived: true },
      overrideAccess: true,
    })
  }
  await payload.delete({ collection: 'templates', id: templateId, overrideAccess: true })
})

describe('the article write a content run commits', () => {
  it('lands, with its audit, while the run owns its row', async () => {
    const article = await topic()
    const run = await selectedRun(article.id)
    fake.stages = [
      {
        name: 'research',
        entryStatus: 'topic_selected',
        exitStatus: 'brief_review',
        run: async () => ({ data: {}, status: 'brief_review' }),
      },
    ]

    await quietly(() => executeContentRun(payload, run, { heartbeatIntervalMs: 60 * 60_000 }))

    expect((await readArticle(article.id)).status).toBe('brief_review')
    expect((await readRun(run.id)).status).toBe('succeeded')
  })

  it('is refused once the run was recovered, before the heartbeat notices', async () => {
    const article = await topic()
    const run = await selectedRun(article.id)
    fake.stages = [
      {
        name: 'research',
        entryStatus: 'topic_selected',
        exitStatus: 'brief_review',
        run: async () => {
          // Recovery fails the run while this article's work is in flight.
          await payload.update({
            collection: 'pipeline-runs',
            id: run.id,
            data: { status: 'failed', errorSummary: 'recovered under the worker' },
            overrideAccess: true,
          })
          return { data: {}, status: 'brief_review' }
        },
      },
    ]

    // A heartbeat far slower than the test: only the fence can stop the write.
    await expect(
      quietly(() => executeContentRun(payload, run, { heartbeatIntervalMs: 60 * 60_000 })),
    ).rejects.toThrow('no longer running')

    expect((await readArticle(article.id)).status).toBe('topic_selected')
    const after = await readRun(run.id)
    expect(after.status).toBe('failed')
    expect(after.errorSummary).toBe('recovered under the worker')
  })
})

describe('the topics a discovery run creates', () => {
  it('are refused once the run was recovered, before the heartbeat notices', async () => {
    const keyword = `fence discovery ${randomUUID()}`
    const run = await payload.create({
      collection: 'pipeline-runs',
      overrideAccess: true,
      data: {
        runId: randomUUID(),
        source: 'admin',
        status: 'queued',
        mode: 'mock',
        template: templateId,
        requestedCount: 1,
        requestedBy: 'test',
        configFingerprint: 'test',
        configSnapshot: {},
      },
    })
    runIds.push(run.id)
    fake.ahrefs = {
      contentGapKeywords: async () => {
        // Recovery fails the run while discovery is asking for topics.
        await payload.update({
          collection: 'pipeline-runs',
          id: run.id,
          data: { status: 'failed', errorSummary: 'recovered under the worker' },
          overrideAccess: true,
        })
        return [{ keyword, volume: 10, difficulty: 1, bestCompetitorPosition: 1 }]
      },
    }

    await expect(
      quietly(() => executeContentRun(payload, run, { heartbeatIntervalMs: 60 * 60_000 })),
    ).rejects.toThrow('no longer running')

    const { totalDocs } = await payload.count({
      collection: 'articles',
      where: { keyword: { equals: keyword } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
    expect((await readRun(run.id)).errorSummary).toBe('recovered under the worker')
  })
})
