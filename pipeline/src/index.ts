import { randomUUID } from 'node:crypto'

import { createAhrefsClient } from './ahrefs'
import { loadActiveBrandVoice } from './brandVoice'
import { config } from './config'
import { type FetchContext, fetchTopics } from './fetchTopics'
import { loadStageModels } from './models'
import { initPayload } from './payloadClient'
import { printReport, type ReportPeriod } from './report'
import { runPipeline, type StageContext } from './stages'
import { loadStyleGuide } from './styleGuide'

interface CliArgs {
  command: 'fetch' | 'run' | 'report'
  count: number
  period: ReportPeriod
}

function usage(): never {
  console.error(
    'Usage: pipeline <fetch|run|report> [--count N] [--period week|month]\n' +
      '  fetch  --count N          create up to N topic_selected articles from the content gap (default 5)\n' +
      '  run                       advance all articles with a template through research -> generate -> qa\n' +
      '  report --period week|month  print pass rates, spend, and failure digest (default week)',
  )
  process.exit(1)
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv
  if (command !== 'fetch' && command !== 'run' && command !== 'report') usage()
  let count = 5
  let period: ReportPeriod = 'week'
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
    } else {
      usage()
    }
  }
  return { command, count, period }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const payload = await initPayload()
  const runId = randomUUID()
  console.log(`[pipeline] ${args.command} — run ${runId} (${config.mockMode ? 'MOCK' : 'live'} mode)`)

  const fetchCtx: FetchContext = {
    payload,
    runId,
    mode: config.mockMode ? 'mock' : 'live',
    ahrefs: createAhrefsClient(),
  }

  if (args.command === 'fetch') {
    // Ahrefs-only, no LLM call — skip loading models/style guide/brand voice
    // so a report/fetch run never fails on a provider key it doesn't need.
    await fetchTopics(fetchCtx, args.count)
  } else if (args.command === 'run') {
    const brandVoice = await loadActiveBrandVoice(payload)
    console.log(`[pipeline] brand voice: ${brandVoice ? `"${brandVoice.name}"` : 'none'}`)
    const ctx: StageContext = {
      ...fetchCtx,
      styleGuide: loadStyleGuide(),
      models: await loadStageModels(payload),
      brandVoice,
    }
    await runPipeline(ctx)
  } else {
    await printReport(payload, args.period)
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
