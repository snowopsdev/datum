import { randomUUID } from 'node:crypto'

import { createAhrefsClient } from './ahrefs'
import { config } from './config'
import { fetchTopics } from './fetchTopics'
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

  const ctx: StageContext = {
    payload,
    runId,
    ahrefs: createAhrefsClient(),
    styleGuide: loadStyleGuide(),
  }

  if (args.command === 'fetch') {
    await fetchTopics(ctx, args.count)
  } else if (args.command === 'run') {
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
