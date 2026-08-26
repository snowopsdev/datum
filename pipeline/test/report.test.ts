import assert from 'node:assert/strict'
import test from 'node:test'

import type { Payload } from 'payload'

import { printReport } from '../src/report'

interface FakeArticle {
  id: number
  keyword: string
  status: string
  title?: string
  informationGain?: { run?: number | null; decision?: string | null } | null
}

/**
 * A Payload stand-in for `printReport`: it only ever calls `find` on three
 * collections, so the report can be exercised without a database.
 */
function fakePayload(articles: FakeArticle[], runs: { id: number; reasons: unknown }[]): Payload {
  return {
    async find({ collection, where }: { collection: string; where?: unknown }) {
      if (collection === 'articles') return { docs: articles }
      if (collection === 'cost-log') return { docs: [] }
      if (collection === 'information-gain-runs') {
        const id = (where as { id?: { equals?: number } } | undefined)?.id?.equals
        return { docs: runs.filter((run) => run.id === id) }
      }
      throw new Error(`unexpected collection ${collection}`)
    },
  } as unknown as Payload
}

async function reportOf(articles: FakeArticle[], runs: { id: number; reasons: unknown }[] = []) {
  const original = console.log
  const captured: string[] = []
  console.log = (line: unknown) => {
    captured.push(String(line))
  }
  try {
    await printReport(fakePayload(articles, runs), 'week')
  } finally {
    console.log = original
  }
  return captured.join('\n')
}

/** The section between the review-queue heading and the next blank-line block. */
function reviewQueue(report: string): string {
  const start = report.indexOf('-- Review queue')
  assert.notEqual(start, -1, 'report has no review queue section')
  const rest = report.slice(start)
  const end = rest.indexOf('\n\n')
  return end === -1 ? rest : rest.slice(0, end)
}

test('the review queue lists articles a human still owes a decision', async () => {
  const report = await reportOf(
    [
      {
        id: 1,
        keyword: 'burr grinders',
        status: 'needs_review',
        informationGain: { run: 11, decision: 'HUMAN_REVIEW' },
      },
      {
        id: 2,
        keyword: 'milk frothers',
        status: 'blocked',
        informationGain: { run: 12, decision: 'BLOCK' },
      },
    ],
    [
      { id: 11, reasons: [{ policy: 'coverage', message: 'thin coverage', severity: 'HUMAN_REVIEW' }] },
      { id: 12, reasons: [{ policy: 'evidence', message: 'contradicted number', severity: 'BLOCK' }] },
    ],
  )
  const queue = reviewQueue(report)
  assert.match(queue, /Review queue \(2 article\(s\)/)
  assert.match(queue, /article 1 /)
  assert.match(queue, /article 2 /)
  assert.match(queue, /thin coverage/)
})

// The override is deliberately non-destructive: it moves the article to
// `verified` and leaves the decision that was overridden on it as the record of
// what the reviewer waived. Filtering the queue on that decision alone would
// therefore keep every resolved article queued for good.
test('an overridden article leaves the review queue even though its decision stands', async () => {
  const articles: FakeArticle[] = [
    {
      id: 1,
      keyword: 'burr grinders',
      status: 'verified',
      informationGain: { run: 11, decision: 'HUMAN_REVIEW' },
    },
    {
      id: 2,
      keyword: 'milk frothers',
      status: 'approved',
      informationGain: { run: 12, decision: 'BLOCK' },
    },
  ]
  const report = await reportOf(articles, [
    { id: 11, reasons: [{ policy: 'coverage', message: 'thin coverage', severity: 'HUMAN_REVIEW' }] },
    { id: 12, reasons: [] },
  ])
  const queue = reviewQueue(report)
  assert.match(queue, /Review queue \(0 article\(s\)/)
  assert.match(queue, /\(none\)/)
  // The decision mix above the queue still counts them: the override does not
  // erase what scoring found, it only resolves who has to act on it.
  assert.match(report, /Information gain \(2 article\(s\) scored\)/)
  assert.match(report, /BLOCK: 1/)
  assert.match(report, /HUMAN_REVIEW: 1/)
})

test('a needs_review article whose decision was cleared is not queued', async () => {
  // `invalidateStaleInformationGain` and the send-back actions null the summary;
  // with no decision left there is nothing for the queue to report on.
  const report = await reportOf([
    { id: 1, keyword: 'burr grinders', status: 'needs_review', informationGain: null },
  ])
  assert.match(report, /Information gain \(0 article\(s\) scored\)/)
})
