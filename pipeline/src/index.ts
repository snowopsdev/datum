import { buildStageContext, loadStageInputs } from './runContext'
import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'

import type { PipelineRun } from '../../cms/src/payload-types'

import { ActivePipelineRunError, createCliRun } from '../../cms/src/lib/createPipelineRun'
import { loadWorkspaceSetup } from '../../cms/src/lib/loadWorkspaceReadiness'
import {
  RunLeaseLostError,
  safeRunError,
  settledRunData,
  startRunHeartbeat,
  updateRunIfStatus,
} from '../../cms/src/lib/pipelineRunLease'
import { runReadinessRefusal } from '../../cms/src/lib/workspaceReadiness'
import { createAhrefsClient } from './ahrefs'
import { config } from './config'
import { type FetchContext, fetchTopics } from './fetchTopics'
import { initPayload } from './payloadClient'
import { printReport, type ReportPeriod } from './report'
import { describeFailures, type RunPipelineResult, runPipeline, stages } from './stages'
import { loadTenantContext } from './tenant'

interface CliArgs {
  command: 'fetch' | 'run' | 'report'
  count: number
  period: ReportPeriod
  template?: string
}

function usage(): never {
  console.error(
    'Usage: pipeline <fetch|run|report> [--count N] [--template NAME_OR_ID] [--period week|month]\n' +
      '  fetch --template NAME_OR_ID --count N  create up to N templated topics (1-5, default 5)\n' +
      '  run                       advance all articles with a template through research -> generate -> qa -> informationGain\n' +
      '                            (refused until setup is finished, or while another run is active)\n' +
      '  report --period week|month  print pass rates, spend, and failure digest (default week)',
  )
  process.exit(1)
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv
  if (command !== 'fetch' && command !== 'run' && command !== 'report') usage()
  let count = 5
  let period: ReportPeriod = 'week'
  let template: string | undefined
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]
    if (arg === '--count') {
      const value = Number.parseInt(rest[i + 1] ?? '', 10)
      // `fetchTopics` caps a batch at 5; refuse a larger ask instead of quietly shrinking it.
      if (Number.isNaN(value) || value < 1 || value > 5) usage()
      count = value
      i += 1
    } else if (arg === '--period') {
      const value = rest[i + 1]
      if (value !== 'week' && value !== 'month') usage()
      period = value
      i += 1
    } else if (arg === '--template') {
      template = rest[i + 1]?.trim()
      if (!template) usage()
      i += 1
    } else {
      usage()
    }
  }
  if (command === 'fetch' && !template) usage()
  return { command, count, period, template }
}

async function resolveTemplateId(
  payload: Awaited<ReturnType<typeof initPayload>>,
  value: string,
): Promise<number> {
  const numericId = Number(value)
  if (Number.isInteger(numericId) && numericId > 0) {
    const template = await payload.findByID({
      collection: 'templates',
      id: numericId,
      depth: 0,
    })
    return template.id
  }
  const result = await payload.find({
    collection: 'templates',
    where: { name: { equals: value } },
    limit: 1,
    depth: 0,
  })
  if (!result.docs[0]) throw new Error(`Template "${value}" was not found.`)
  return result.docs[0].id
}

/** Every article some stage would pick up now: the CLI run's whole batch. */
async function waitingArticleIds(payload: Payload): Promise<number[]> {
  const { docs } = await payload.find({
    collection: 'articles',
    where: {
      and: [
        { status: { in: [...new Set(stages.map((stage) => stage.entryStatus))] } },
        { template: { exists: true } },
        { archived: { not_equals: true } },
      ],
    },
    select: { status: true },
    pagination: false,
    limit: 0,
    depth: 0,
  })
  return docs.map((doc) => doc.id)
}

/**
 * `pipeline run`: the same setup gate as a run started in the CMS, then a
 * `cli` row on `pipeline-runs` under the same lock, with a heartbeat, so the
 * CLI cannot overlap the content worker or another CLI on the same articles.
 */
async function runCommand(
  payload: Payload,
  runId: string,
  mode: 'mock' | 'live',
): Promise<number> {
  const { readiness } = await loadWorkspaceSetup(payload)
  const refusal = runReadinessRefusal(readiness)
  if (refusal) {
    console.error(`[pipeline] ${refusal}`)
    return 1
  }

  const inputs = await loadStageInputs(payload, mode)
  const { brandVoice } = inputs
  console.log(`[pipeline] brand voice: ${brandVoice ? `"${brandVoice.name}"` : 'none'}`)
  const ctx = buildStageContext(payload, runId, mode, inputs)

  // Listed on the row so admin and selected runs refuse these articles while
  // this run holds them. Only these are advanced: a piece created mid-run
  // waits for the next run rather than being touched unlisted.
  const articleIds = await waitingArticleIds(payload)
  let runRow: PipelineRun
  try {
    runRow = await createCliRun(payload, {
      runId,
      mode,
      readiness,
      articleIds,
      requestedBy: 'cli',
    })
  } catch (error) {
    if (error instanceof ActivePipelineRunError) {
      console.error(`[pipeline] ${error.message} Wait for it to finish, then run again.`)
      return 1
    }
    throw error
  }
  const heartbeat = startRunHeartbeat(payload, runRow)

  // Ctrl-C ends the run on its row now, rather than leaving it to block every
  // other run until recovery notices the missing heartbeat.
  const interrupt = (signal: NodeJS.Signals) => {
    heartbeat.stop()
    console.error(`[pipeline] ${signal}: marking run ${runId} failed`)
    void updateRunIfStatus(payload, runRow.id, 'running', {
      status: 'failed',
      errorSummary: `Interrupted by ${signal} before it finished.`,
      completedAt: new Date().toISOString(),
    })
      .catch(() => false)
      .then(() => exitAfterFlush(130))
  }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)

  try {
    // `runPipeline` treats an empty id list as "no restriction", so a run with
    // nothing waiting must not reach it.
    const summary: RunPipelineResult =
      articleIds.length === 0
        ? { articleIds: [], finalStatuses: {}, stages: [], failed: 0, failures: [] }
        : await runPipeline(ctx, { articleIds, signal: heartbeat.signal })
    if (!(await updateRunIfStatus(payload, runRow.id, 'running', settledRunData(summary)))) {
      throw new RunLeaseLostError(runId)
    }
    const warned = summary.stages.reduce((sum, entry) => sum + entry.warned, 0)
    if (warned > 0) {
      // Not a failure: these articles advanced. Printed so a scheduled run's log
      // shows bookkeeping that silently did not happen.
      const detail = summary.stages
        .filter((entry) => entry.warned > 0)
        .map((entry) => `${entry.stage} ${entry.warned}/${entry.total}`)
        .join(', ')
      console.warn(`[pipeline] ${warned} article(s) advanced with warnings (${detail})`)
    }
    if (summary.failed > 0) {
      // Exit non-zero so a scheduled run's alerting and retry policy see the
      // stuck articles; the batch itself already ran to completion.
      console.error(
        `[pipeline] ${summary.failed} article(s) failed (${describeFailures(summary)}); ` +
          'they kept their status and the next run retries them',
      )
      return 1
    }
    return 0
  } catch (error) {
    if (!(error instanceof RunLeaseLostError)) {
      await updateRunIfStatus(payload, runRow.id, 'running', {
        status: 'failed',
        errorSummary: safeRunError(error, 'Pipeline run failed'),
        completedAt: new Date().toISOString(),
      })
    }
    throw error
  } finally {
    heartbeat.stop()
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
  }
}

/** `0` unless something failed; `main` sets it and the single exit at the end reads it. */
async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const payload = await initPayload()
  const runId = randomUUID()
  console.log(
    `[pipeline] ${args.command} — run ${runId} (${config.mockMode ? 'MOCK' : 'live'} mode)`,
  )

  // Reporting reads saved results and does not need a research workspace or
  // an Ahrefs client. Keep it available while deployment settings are edited.
  if (args.command === 'report') {
    await printReport(payload, args.period)
    return 0
  }

  const mode = config.mockMode ? 'mock' : 'live'
  if (args.command === 'fetch') {
    const tenant = await loadTenantContext(payload, { mode })
    const fetchCtx: FetchContext = {
      tenant,
      payload,
      runId,
      mode,
      ahrefs: createAhrefsClient(mode, tenant.profile),
    }
    // Ahrefs-only, no LLM call — skip loading models/style guide/brand voice
    // so a report/fetch run never fails on a provider key it doesn't need.
    const templateId = await resolveTemplateId(payload, args.template as string)
    await fetchTopics(fetchCtx, {
      count: args.count,
      templateId,
      icpId: (tenant.icps.find((icp) => icp.primary)?.id as number | undefined) ?? null,
    })
  } else if (args.command === 'run') {
    return runCommand(payload, runId, mode)
  }
  return 0
}

/**
 * Exit once stdout has actually gone out.
 *
 * Node writes to a pipe asynchronously, so `process.exit()` on its own discards
 * whatever is still buffered — which silently truncated `pipeline:report` any
 * time its output was piped (into `grep`, `tee`, a `$(…)` capture, a CI log
 * collector) while the same command redirected to a file printed in full.
 * Dropping the explicit exit is not an option either: Payload keeps its Postgres
 * pool open, so the process would simply hang. Flush, then exit.
 */
async function exitAfterFlush(code: number): Promise<never> {
  // The write callback fires once *this* chunk has been handed to the OS, and
  // the queue is ordered, so everything logged before it is out too. Checking
  // `write()`'s return value instead would not work: an empty chunk leaves the
  // buffer under its high-water mark, so it answers `true` with data still
  // pending and 'drain' never fires.
  await new Promise<void>((resolve) => {
    process.stdout.write('', () => resolve())
  })
  process.exit(code)
}

main()
  .then(exitAfterFlush)
  .catch((error) => {
    console.error(error)
    return exitAfterFlush(1)
  })
