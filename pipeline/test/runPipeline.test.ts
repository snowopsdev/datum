import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Article } from '../../cms/src/payload-types'
import {
  describeFailures,
  type PipelineRunSummary,
  runPipeline,
  type Stage,
  type StageContext,
} from '../src/stages'

const articleAt = (id: number, status: Article['status']): Article =>
  ({ id, status, keyword: `keyword ${id}` }) as unknown as Article

/**
 * A Payload stand-in: `find` answers from a fixed pool by the queried status,
 * `update` records the write. No database, no Payload boot.
 */
const fakeCtx = (
  pool: Article[],
): { ctx: StageContext; updates: { id: number | string; status: unknown }[] } => {
  const updates: { id: number | string; status: unknown }[] = []
  const payload = {
    find: async ({ where }: { where: { and: { status?: { equals: string } }[] } }) => {
      const wanted = where.and.find((clause) => clause.status)?.status?.equals
      return { docs: pool.filter((article) => article.status === wanted) }
    },
    update: async ({ id, data }: { id: number | string; data: { status: unknown } }) => {
      updates.push({ id, status: data.status })
      return { id }
    },
  }
  return { ctx: { payload, runId: 'test-run', mode: 'mock' } as unknown as StageContext, updates }
}

/** A stage that advances every article, except the ids it is told to throw on. */
const stubStage = (
  name: Stage['name'],
  entryStatus: Article['status'],
  exitStatus: Article['status'],
  throwOn: number[] = [],
): Stage => ({
  name,
  entryStatus,
  exitStatus,
  run: async (article) => {
    if (throwOn.includes(article.id as number)) throw new Error(`${name} blew up`)
    return { data: {}, status: exitStatus }
  },
})

/** Runs `body` with console output swallowed, so the suite stays readable. */
const quietly = async <T>(body: () => Promise<T>): Promise<T> => {
  const { log, warn, error } = console
  console.log = () => {}
  console.warn = () => {}
  console.error = () => {}
  try {
    return await body()
  } finally {
    console.log = log
    console.warn = warn
    console.error = error
  }
}

describe('runPipeline', () => {
  it('reports no failures for a clean run and advances every article', async () => {
    const { ctx, updates } = fakeCtx([
      articleAt(1, 'topic_selected'),
      articleAt(2, 'topic_selected'),
    ])
    const summary = await quietly(() =>
      runPipeline(ctx, [stubStage('research', 'topic_selected', 'researched')]),
    )
    assert.equal(summary.failed, 0)
    assert.deepEqual(summary.stages, [{ stage: 'research', total: 2, failed: 0 }])
    assert.deepEqual(updates, [
      { id: 1, status: 'researched' },
      { id: 2, status: 'researched' },
    ])
  })

  it('keeps processing the batch after one article throws, and counts it', async () => {
    const { ctx, updates } = fakeCtx([
      articleAt(1, 'topic_selected'),
      articleAt(2, 'topic_selected'),
      articleAt(3, 'topic_selected'),
    ])
    const summary = await quietly(() =>
      runPipeline(ctx, [stubStage('research', 'topic_selected', 'researched', [2])]),
    )
    assert.equal(summary.failed, 1)
    assert.deepEqual(summary.stages, [{ stage: 'research', total: 3, failed: 1 }])
    // The failed article kept its status; the ones behind it still advanced.
    assert.deepEqual(updates, [
      { id: 1, status: 'researched' },
      { id: 3, status: 'researched' },
    ])
  })

  it('runs every later stage and totals failures across all of them', async () => {
    const { ctx } = fakeCtx([
      articleAt(1, 'topic_selected'),
      articleAt(2, 'topic_selected'),
      articleAt(3, 'drafted'),
    ])
    const summary = await quietly(() =>
      runPipeline(ctx, [
        stubStage('research', 'topic_selected', 'researched', [1, 2]),
        stubStage('qa', 'drafted', 'qa_passed', [3]),
      ]),
    )
    assert.equal(summary.failed, 3)
    assert.deepEqual(summary.stages, [
      { stage: 'research', total: 2, failed: 2 },
      { stage: 'qa', total: 1, failed: 1 },
    ])
  })

  it('reports a stage with nothing to do as an empty batch', async () => {
    const { ctx } = fakeCtx([])
    const summary = await quietly(() =>
      runPipeline(ctx, [stubStage('generate', 'researched', 'drafted')]),
    )
    assert.equal(summary.failed, 0)
    assert.deepEqual(summary.stages, [{ stage: 'generate', total: 0, failed: 0 }])
  })
})

describe('describeFailures', () => {
  const summary = (stages: PipelineRunSummary['stages']): PipelineRunSummary => ({
    stages,
    failed: stages.reduce((sum, entry) => sum + entry.failed, 0),
  })

  it('names only the stages that failed, with their counts', () => {
    assert.equal(
      describeFailures(
        summary([
          { stage: 'research', total: 5, failed: 2 },
          { stage: 'generate', total: 3, failed: 0 },
          { stage: 'qa', total: 3, failed: 1 },
        ]),
      ),
      'research 2/5, qa 1/3',
    )
  })

  it('is empty for a clean run', () => {
    assert.equal(describeFailures(summary([{ stage: 'research', total: 4, failed: 0 }])), '')
  })
})
