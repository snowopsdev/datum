import { randomUUID } from 'node:crypto'

import { createAhrefsClient } from './ahrefs'
import { loadActiveBrandVoice } from './brandVoice'
import { config } from './config'
import { type FetchContext, fetchTopics } from './fetchTopics'
import { loadEvidenceSources, loadInformationGainPolicy } from './informationGain/policy'
import { loadStageModels } from './models'
import { initPayload } from './payloadClient'
import { printReport, type ReportPeriod } from './report'
import { describeFailures, runPipeline, type StageContext } from './stages'
import { loadStyleGuide } from './styleGuide'

interface CliArgs {
  command: 'fetch' | 'run' | 'report'
  count: number
  period: ReportPeriod
  template?: string
}

function usage(): never {
  console.error(
    'Usage: pipeline <fetch|run|report> [--count N] [--template NAME_OR_ID] [--period week|month]\n' +
      '  fetch --template NAME_OR_ID --count N  create up to N templated topics (default 5)\n' +
      '  run                       advance all articles with a template through research -> generate -> qa -> informationGain\n' +
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
      if (Number.isNaN(value) || value < 1) usage()
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

/** `0` unless something failed; `main` sets it and the single exit at the end reads it. */
async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const payload = await initPayload()
  const runId = randomUUID()
  console.log(
    `[pipeline] ${args.command} — run ${runId} (${config.mockMode ? 'MOCK' : 'live'} mode)`,
  )

  const mode = config.mockMode ? 'mock' : 'live'
  const fetchCtx: FetchContext = {
    payload,
    runId,
    mode,
    ahrefs: createAhrefsClient(mode),
  }

  if (args.command === 'fetch') {
    // Ahrefs-only, no LLM call — skip loading models/style guide/brand voice
    // so a report/fetch run never fails on a provider key it doesn't need.
    const templateId = await resolveTemplateId(payload, args.template as string)
    await fetchTopics(fetchCtx, { count: args.count, templateId })
  } else if (args.command === 'run') {
    const brandVoice = await loadActiveBrandVoice(payload)
    console.log(`[pipeline] brand voice: ${brandVoice ? `"${brandVoice.name}"` : 'none'}`)
    const ctx: StageContext = {
      ...fetchCtx,
      styleGuide: loadStyleGuide(),
      models: await loadStageModels(payload),
      brandVoice,
      policy: await loadInformationGainPolicy(payload),
      evidenceSources: await loadEvidenceSources(payload),
    }
    const summary = await runPipeline(ctx)
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
  } else {
    await printReport(payload, args.period)
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
