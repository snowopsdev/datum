import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Article } from '../../cms/src/payload-types'
import {
  describeFailures,
  type RunPipelineResult,
  runPipeline,
  type Stage,
  type StageContext,
  stages,
} from '../src/stages'

const articleAt = (id: number, status: Article['status']): Article =>
  ({ id, status, keyword: `keyword ${id}` }) as unknown as Article

/**
 * A Payload stand-in: `find` answers from a fixed pool by the queried status,
 * `update` records the write. No database, no Payload boot.
 */
const fakeCtx = (
  pool: Article[],
): {
  ctx: StageContext
  updates: { id: number | string; status: unknown }[]
  contexts: Record<string, unknown>[]
} => {
  const updates: { id: number | string; status: unknown }[] = []
  const contexts: Record<string, unknown>[] = []
  const payload = {
    find: async ({ where }: { where: { and: { status?: { equals: string } }[] } }) => {
      const wanted = where.and.find((clause) => clause.status)?.status?.equals
      return { docs: pool.filter((article) => article.status === wanted) }
    },
    update: async ({
      id,
      data,
      context,
    }: {
      id: number | string
      data: { status: unknown }
      context?: Record<string, unknown>
    }) => {
      updates.push({ id, status: data.status })
      if (context) contexts.push(context)
      return { id }
    },
  }
  return {
    ctx: { payload, runId: 'test-run', mode: 'mock' } as unknown as StageContext,
    updates,
    contexts,
  }
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
  it('reports only persisted progress when an article write fails', async () => {
    const { ctx } = fakeCtx([articleAt(1, 'topic_selected')])
    ctx.payload.update = async () => {
      throw new Error('database write failed')
    }
    const summary = await quietly(() => runPipeline(ctx, {
      stages: [stubStage('research', 'topic_selected', 'researched')],
    }))
    assert.equal(summary.failed, 1)
    assert.deepEqual(summary.articleIds, [])
    assert.deepEqual(summary.finalStatuses, {})
    assert.equal(summary.failures[0]?.message, 'database write failed')
  })

  it('keeps the last persisted status when a later stage write fails', async () => {
    const article = articleAt(1, 'topic_selected')
    const { ctx } = fakeCtx([article])
    ctx.payload.update = (async ({ data }: { data: { status: Article['status'] } }) => {
      if (data.status === 'drafted') throw new Error('database write failed')
      article.status = data.status
      return article
    }) as unknown as typeof ctx.payload.update
    const summary = await quietly(() => runPipeline(ctx, {
      stages: [
        stubStage('research', 'topic_selected', 'researched'),
        stubStage('generate', 'researched', 'drafted'),
      ],
    }))
    assert.equal(summary.failed, 1)
    assert.deepEqual(summary.articleIds, [1])
    assert.deepEqual(summary.finalStatuses, { researched: 1 })
  })

  it('reports no failures for a clean run and advances every article', async () => {
    const { ctx, updates } = fakeCtx([
      articleAt(1, 'topic_selected'),
      articleAt(2, 'topic_selected'),
    ])
    const summary = await quietly(() =>
      runPipeline(ctx, { stages: [stubStage('research', 'topic_selected', 'researched')] }),
    )
    assert.equal(summary.failed, 0)
    assert.deepEqual(summary.stages, [{ stage: 'research', total: 2, failed: 0, warned: 0 }])
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
      runPipeline(ctx, { stages: [stubStage('research', 'topic_selected', 'researched', [2])] }),
    )
    assert.equal(summary.failed, 1)
    assert.deepEqual(summary.stages, [{ stage: 'research', total: 3, failed: 1, warned: 0 }])
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
      runPipeline(ctx, {
        stages: [
          stubStage('research', 'topic_selected', 'researched', [1, 2]),
          stubStage('qa', 'drafted', 'qa_passed', [3]),
        ],
      }),
    )
    assert.equal(summary.failed, 3)
    assert.deepEqual(summary.stages, [
      { stage: 'research', total: 2, failed: 2, warned: 0 },
      { stage: 'qa', total: 1, failed: 1, warned: 0 },
    ])
  })

  // A warning is bookkeeping that failed while the article still advanced, so it
  // must not read as a failure — the run's exit code and retry behaviour depend
  // on that distinction — but it has to stay visible on the audit row.
  it('counts a warning separately from a failure and records it on the audit', async () => {
    const { ctx, updates, contexts } = fakeCtx([articleAt(1, 'qa_passed')])
    const warningStage: Stage = {
      name: 'informationGain',
      entryStatus: 'qa_passed',
      exitStatus: 'verified',
      run: async () => ({ data: {}, status: 'verified', warnings: ['candidates not recorded'] }),
    }
    const summary = await quietly(() => runPipeline(ctx, { stages: [warningStage] }))

    assert.equal(summary.failed, 0)
    assert.deepEqual(summary.stages, [
      { stage: 'informationGain', total: 1, failed: 0, warned: 1 },
    ])
    assert.deepEqual(updates, [{ id: 1, status: 'verified' }])
    const details = (contexts[0]?.articleAudit as { details?: { warnings?: string[] } })?.details
    assert.deepEqual(details?.warnings, ['candidates not recorded'])
  })

  it('leaves the audit details free of a warnings key on a clean run', async () => {
    const { ctx, contexts } = fakeCtx([articleAt(1, 'topic_selected')])
    await quietly(() =>
      runPipeline(ctx, { stages: [stubStage('research', 'topic_selected', 'researched')] }),
    )
    const details = (contexts[0]?.articleAudit as { details?: Record<string, unknown> })?.details
    assert.equal(Object.hasOwn(details ?? {}, 'warnings'), false)
  })

  it('reports a stage with nothing to do as an empty batch', async () => {
    const { ctx } = fakeCtx([])
    const summary = await quietly(() =>
      runPipeline(ctx, { stages: [stubStage('generate', 'researched', 'drafted')] }),
    )
    assert.equal(summary.failed, 0)
    assert.deepEqual(summary.stages, [{ stage: 'generate', total: 0, failed: 0, warned: 0 }])
  })
})

describe('describeFailures', () => {
  const summary = (stages: RunPipelineResult['stages']): RunPipelineResult => ({
    articleIds: [],
    finalStatuses: {},
    stages,
    failed: stages.reduce((sum, entry) => sum + entry.failed, 0),
    failures: [],
  })

  it('names only the stages that failed, with their counts', () => {
    assert.equal(
      describeFailures(
        summary([
          { stage: 'research', total: 5, failed: 2, warned: 0 },
          { stage: 'generate', total: 3, failed: 0, warned: 0 },
          { stage: 'qa', total: 3, failed: 1, warned: 0 },
        ]),
      ),
      'research 2/5, qa 1/3',
    )
  })

  it('is empty for a clean run', () => {
    assert.equal(describeFailures(summary([{ stage: 'research', total: 4, failed: 0, warned: 0 }])), '')
  })
})

describe('the brief checkpoint', () => {
  it('research exits at brief_review, and no stage picks brief_review up', () => {
    const research = stages.find((stage) => stage.name === 'research')
    assert.ok(research)
    assert.equal(research.exitStatus, 'brief_review')
    // A dead end for `runPipeline`, like needs_revision: only a person moves it.
    assert.ok(stages.every((stage) => stage.entryStatus !== 'brief_review'))
  })

  it('generate still enters at researched, which is where an approved brief lands', () => {
    const generate = stages.find((stage) => stage.name === 'generate')
    assert.equal(generate?.entryStatus, 'researched')
  })

  it('a run finds nothing to do for an article waiting at its brief', async () => {
    const { ctx, updates } = fakeCtx([articleAt(1, 'brief_review')])
    const summary = await runPipeline(ctx, { stages: [stubStage('generate', 'researched', 'drafted')] })
    assert.deepEqual(updates, [])
    assert.deepEqual(summary.finalStatuses, {})
  })
})

describe('runPipeline with a lost lease', () => {
  it('stops before the next write once its signal aborts, and rethrows the reason', async () => {
    const { ctx, updates } = fakeCtx([
      articleAt(1, 'topic_selected'),
      articleAt(2, 'topic_selected'),
    ])
    const controller = new AbortController()
    const lost = new Error('lease lost')
    let ran = 0
    const stage: Stage = {
      name: 'research',
      entryStatus: 'topic_selected',
      exitStatus: 'brief_review',
      run: async () => {
        ran += 1
        // The heartbeat finds the run recovered while this article's paid work
        // is in flight.
        controller.abort(lost)
        return { data: {}, status: 'brief_review' }
      },
    }
    await quietly(async () => {
      await assert.rejects(
        runPipeline(ctx, {
          stages: [stage, stubStage('generate', 'researched', 'drafted')],
          signal: controller.signal,
        }),
        (error) => error === lost,
      )
    })
    assert.equal(ran, 1, 'the second article must not be started')
    assert.deepEqual(updates, [], 'nothing may be written after the lease is lost')
  })

  it('does not start at all with an already-aborted signal', async () => {
    const { ctx, updates } = fakeCtx([articleAt(1, 'topic_selected')])
    const controller = new AbortController()
    controller.abort(new Error('lease lost'))
    await quietly(async () => {
      await assert.rejects(
        runPipeline(ctx, {
          stages: [stubStage('research', 'topic_selected', 'brief_review')],
          signal: controller.signal,
        }),
        /lease lost/,
      )
    })
    assert.deepEqual(updates, [])
  })
})

describe('runPipeline with a fenced commit', () => {
  it('writes through commitArticle with the request it is given', async () => {
    const { ctx } = fakeCtx([articleAt(1, 'topic_selected')])
    const reqs: unknown[] = []
    ctx.payload.update = (async ({ req }: { req?: unknown }) => {
      reqs.push(req)
      return { id: 1 }
    }) as unknown as StageContext['payload']['update']
    const lockedReq = { transactionID: 'tx' }
    await quietly(() =>
      runPipeline(ctx, {
        stages: [stubStage('research', 'topic_selected', 'brief_review')],
        commitArticle: async (write) => {
          await write(lockedReq as never)
          return true
        },
      }),
    )
    assert.deepEqual(reqs, [lockedReq], 'the write must run inside the fence transaction')
  })

  it('writes nothing and stops the whole run once the run no longer owns its row', async () => {
    const { ctx, updates } = fakeCtx([
      articleAt(1, 'topic_selected'),
      articleAt(2, 'topic_selected'),
    ])
    let ran = 0
    const stage: Stage = {
      ...stubStage('research', 'topic_selected', 'brief_review'),
      run: async () => {
        ran += 1
        return { data: {}, status: 'brief_review' }
      },
    }
    await quietly(async () => {
      await assert.rejects(
        // No signal: the heartbeat has not noticed yet, only the fence has.
        runPipeline(ctx, { stages: [stage], commitArticle: async () => false }),
        /no longer owns its row/,
      )
    })
    assert.equal(ran, 1, 'a refused write ends the run, not just that article')
    assert.deepEqual(updates, [])
  })

  it('hands the run signal to every stage', async () => {
    const { ctx } = fakeCtx([articleAt(1, 'topic_selected')])
    const controller = new AbortController()
    let seen: AbortSignal | undefined
    const stage: Stage = {
      ...stubStage('research', 'topic_selected', 'brief_review'),
      run: async (_article, stageCtx) => {
        seen = stageCtx.signal
        return { data: {}, status: 'brief_review' }
      },
    }
    await quietly(() => runPipeline(ctx, { stages: [stage], signal: controller.signal }))
    assert.equal(seen, controller.signal)
  })
})
