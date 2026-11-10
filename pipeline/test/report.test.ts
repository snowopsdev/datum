import assert from 'node:assert/strict'
import test from 'node:test'

import type { Payload } from 'payload'

import { printReport } from '../src/report'

interface FakeArticle {
  id: number
  keyword: string
  status: string
  title?: string
  archived?: boolean
  informationGain?: { run?: number | null; decision?: string | null } | null
  qaResults?: Record<string, unknown>
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
        const ids = (where as { id?: { in?: number[] } } | undefined)?.id?.in ?? []
        return { docs: runs.filter((run) => ids.includes(run.id)) }
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
      {
        id: 11,
        reasons: [
          {
            policy: 'coverage',
            message: 'thin coverage',
            severity: 'HUMAN_REVIEW',
          },
        ],
      },
      {
        id: 12,
        reasons: [
          {
            policy: 'evidence',
            message: 'contradicted number',
            severity: 'BLOCK',
          },
        ],
      },
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
    {
      id: 11,
      reasons: [
        {
          policy: 'coverage',
          message: 'thin coverage',
          severity: 'HUMAN_REVIEW',
        },
      ],
    },
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
    {
      id: 1,
      keyword: 'burr grinders',
      status: 'needs_review',
      informationGain: null,
    },
  ])
  assert.match(report, /Information gain \(0 article\(s\) scored\)/)
})

const qa = (overrides: Record<string, unknown> = {}) => ({
  structural: { passed: true, violations: [] },
  factCheck: { passed: true, notes: 'ok' },
  qualitativeReview: { passed: true, notes: 'ok', notTraitViolations: [] },
  evidenceCheck: { passed: true, notes: 'ok' },
  ...overrides,
})

/** The QA pass-rate block, up to the next blank line. */
function qaRates(report: string): string {
  const start = report.indexOf('== QA pass rates')
  assert.notEqual(start, -1, 'report has no QA pass-rate section')
  const rest = report.slice(start)
  const end = rest.indexOf('\n\n')
  return end === -1 ? rest : rest.slice(0, end)
}

test('QA pass rates count the evidence check beside the other three', async () => {
  const report = await reportOf([
    { id: 1, keyword: 'a', status: 'qa_passed', qaResults: qa() },
    {
      id: 2,
      keyword: 'b',
      status: 'needs_revision',
      qaResults: qa({ evidenceCheck: { passed: false, notes: 'unbacked claim' } }),
    },
    // Predates the evidence check: no verdict, so it is not counted for it.
    { id: 3, keyword: 'c', status: 'qa_passed', qaResults: qa({ evidenceCheck: undefined }) },
  ])
  const rates = qaRates(report)
  assert.match(rates, /^evidenceCheck: 1\/2 \(50%\)$/m)
  assert.match(rates, /^factCheck: 3\/3 \(100%\)$/m)
  assert.match(rates, /evidenceCheck 1\/2 \(50%\)/, 'the per-template line carries it too')
})

test('the failure digest names an evidence-only failure', async () => {
  const report = await reportOf([
    {
      id: 2,
      keyword: 'b',
      title: 'Burr grinders',
      status: 'needs_revision',
      qaResults: qa({ evidenceCheck: { passed: false, notes: 'Claim 1 has no backing in the bank.' } }),
    },
  ])
  assert.match(report, /article 2 "Burr grinders"/)
  assert.match(report, /evidenceCheck \(failed\): Claim 1 has no backing in the bank\./)
})

test('archived articles stay out of the review queue and the failure digest', async () => {
  const report = await reportOf(
    [
      {
        id: 3,
        keyword: 'c',
        title: 'Kettles',
        status: 'needs_review',
        archived: true,
        informationGain: { run: 13, decision: 'HUMAN_REVIEW' },
      },
      {
        id: 4,
        keyword: 'd',
        title: 'Scales',
        status: 'needs_revision',
        archived: true,
        qaResults: qa({ evidenceCheck: { passed: false, notes: 'Archived failure.' } }),
      },
    ],
    [{ id: 13, reasons: [] }],
  )
  assert.match(reviewQueue(report), /Review queue \(0 article\(s\)/)
  assert.match(report, /Failure digest \(0 article\(s\) at needs_revision\)/)
  assert.doesNotMatch(report, /Kettles/)
  assert.doesNotMatch(report, /Archived failure\./)
})

// QA fails a draft on a quoted "what we are NOT" breach even when the model
// marked the review itself as passed (`decideQualitative`). The report has to
// apply the same rule or it reports a pass rate QA never gave.
test('a review marked passed that quoted a not-trait breach counts as failed', async () => {
  const breach = [{ trait: 'hype', excerpt: 'the best grinder ever', explanation: 'superlative' }]
  const report = await reportOf([
    {
      id: 1,
      keyword: 'a',
      title: 'Burr grinders',
      status: 'needs_revision',
      qaResults: qa({
        qualitativeReview: { passed: true, notes: 'Reads well.', notTraitViolations: breach },
      }),
    },
    { id: 2, keyword: 'b', status: 'qa_passed', qaResults: qa() },
  ])
  assert.match(qaRates(report), /^qualitativeReview: 1\/2 \(50%\)$/m)
  assert.match(report, /qualitativeReview \(failed\): Reads well\./)
})
