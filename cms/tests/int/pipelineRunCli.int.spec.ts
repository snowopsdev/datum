import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  ActivePipelineRunError,
  ArticleInActiveRunError,
  createCliRun,
  createPipelineRun,
} from '@/lib/createPipelineRun'
import type { WorkspaceReadiness } from '@/lib/workspaceReadiness'

const execute = promisify(execFile)
const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href

let payload: Payload
let user: TypedUser
let templateId: number
let articleId: number
const runIds: number[] = []

// `createPipelineRun` and `createCliRun` only copy these onto the row.
const readiness = {
  mode: 'mock',
  configFingerprint: 'cli-test',
  runtime: { missing: [] },
  governance: { activeVoiceId: null },
  tenant: {
    profile: { targetDomain: 'example.com', competitorCount: 0 },
    icps: { primaryId: null, count: 0 },
    positioning: { status: 'missing' },
    evidenceBank: {},
  },
  content: { models: [] },
} as unknown as WorkspaceReadiness

async function settleActiveRuns() {
  await payload.update({
    collection: 'pipeline-runs',
    where: { status: { in: ['queued', 'running'] } },
    data: { status: 'failed', errorSummary: 'settled by pipelineRunCli test' },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  user =
    (users.docs[0] as TypedUser | undefined) ??
    ((await payload.create({
      collection: 'users',
      data: { email: `cli-${randomUUID()}@example.com`, password: 'cli-test-password' },
      overrideAccess: true,
    })) as TypedUser)
  const template = await payload.create({
    collection: 'templates',
    data: { name: `CLI ${randomUUID()}` },
  })
  templateId = template.id
  const article = await payload.create({
    collection: 'articles',
    data: { keyword: `cli ${randomUUID()}`, status: 'topic_selected', template: templateId },
  })
  articleId = article.id
  // Leftovers from another suite would make every launch here refuse.
  await settleActiveRuns()
})

afterAll(async () => {
  for (const id of runIds) {
    await payload.delete({ collection: 'pipeline-runs', id, overrideAccess: true })
  }
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: { archived: true },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'templates', id: templateId, overrideAccess: true })
})

describe('createCliRun', () => {
  it('registers a running cli run that lists its articles, with no template', async () => {
    const run = await createCliRun(payload, {
      runId: randomUUID(),
      mode: 'mock',
      readiness,
      articleIds: [articleId],
      requestedBy: 'cli',
    })
    runIds.push(run.id)
    expect(run.source).toBe('cli')
    expect(run.status).toBe('running')
    expect(run.template ?? null).toBeNull()
    expect(run.heartbeatAt).toBeTruthy()
    expect(run.startedAt).toBeTruthy()
    expect(run.articles).toEqual([articleId])

    // While it holds them: an admin run is refused outright, and a selected run
    // over one of its articles is refused for the overlap.
    await expect(
      createPipelineRun(payload, user, {
        runId: randomUUID(),
        source: 'admin',
        templateId,
        count: 1,
        requestedBy: 'test',
        readiness,
      }),
    ).rejects.toBeInstanceOf(ActivePipelineRunError)
    await expect(
      createPipelineRun(payload, user, {
        runId: randomUUID(),
        source: 'selected',
        templateId,
        count: 1,
        requestedBy: 'test',
        readiness,
        articleIds: [articleId],
      }),
    ).rejects.toBeInstanceOf(ArticleInActiveRunError)

    // And a second CLI run is refused while the first is active.
    await expect(
      createCliRun(payload, {
        runId: randomUUID(),
        mode: 'mock',
        readiness,
        articleIds: [],
        requestedBy: 'cli',
      }),
    ).rejects.toThrow(`Run ${run.runId} is already in progress.`)

    await settleActiveRuns()
  })

  it('refuses while a worker run is queued', async () => {
    const queued = await payload.create({
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
    runIds.push(queued.id)
    await expect(
      createCliRun(payload, {
        runId: randomUUID(),
        mode: 'mock',
        readiness,
        articleIds: [articleId],
        requestedBy: 'cli',
      }),
    ).rejects.toBeInstanceOf(ActivePipelineRunError)
    const cliRows = await payload.count({
      collection: 'pipeline-runs',
      where: { and: [{ source: { equals: 'cli' } }, { status: { equals: 'running' } }] },
      overrideAccess: true,
    })
    expect(cliRows.totalDocs).toBe(0)
    await settleActiveRuns()
  })
})

describe('pipeline run command', () => {
  it('refuses to run until setup is finished', async () => {
    const { docs: active } = await payload.find({
      collection: 'brand-voices',
      where: { status: { equals: 'active' } },
      depth: 0,
      overrideAccess: true,
    })
    for (const voice of active) {
      await payload.update({
        collection: 'brand-voices',
        id: voice.id,
        data: { status: 'archived' },
        overrideAccess: true,
      })
    }
    const before = await payload.count({ collection: 'pipeline-runs', overrideAccess: true })
    try {
      const outcome = await execute(
        process.execPath,
        ['--import', tsxLoader, 'pipeline/src/index.ts', 'run'],
        {
          cwd: path.resolve(process.cwd(), '..'),
          timeout: 30_000,
          env: { ...process.env, MOCK_MODE: 'true' },
        },
      ).then(
        () => ({ code: 0, stderr: '' }),
        (error: { code?: number; stderr?: string }) => ({
          code: error.code,
          stderr: error.stderr ?? '',
        }),
      )
      expect(outcome.code).toBe(1)
      expect(outcome.stderr).toContain('Finish setup before running the pipeline')
      expect(outcome.stderr).toContain('Activate a brand voice')
      // Refused before it registered a run or touched an article.
      const after = await payload.count({ collection: 'pipeline-runs', overrideAccess: true })
      expect(after.totalDocs).toBe(before.totalDocs)
      const article = await payload.findByID({ collection: 'articles', id: articleId, depth: 0 })
      expect(article.status).toBe('topic_selected')
    } finally {
      for (const voice of active) {
        await payload.update({
          collection: 'brand-voices',
          id: voice.id,
          data: { status: 'active' },
          overrideAccess: true,
        })
      }
    }
  }, 40_000)
})
