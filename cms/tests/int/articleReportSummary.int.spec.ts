// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { CALL_LABELS, costStageLabel } from '@/components/ops/boardTypes'
import { CostLog } from '@/collections/CostLog'
import { summarizeReportArticles, type ReportArticle } from '@/lib/articleReportSummary'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}))
const { ReportsPanel } = await import('@/components/ops/ReportsPanel')

afterEach(cleanup)

const article = (overrides: Partial<ReportArticle> & { id: number }): ReportArticle => ({
  title: null,
  keyword: `topic ${overrides.id}`,
  status: 'needs_revision',
  templateName: null,
  totalCostUsd: null,
  qaResults: undefined,
  informationGain: undefined,
  ...overrides,
})

const passing = { passed: true }

it('counts the evidence check as a fourth pass rate and names it when it alone failed', () => {
  const summary = summarizeReportArticles([
    article({
      id: 1,
      status: 'qa_passed',
      qaResults: {
        structural: passing,
        factCheck: passing,
        qualitativeReview: passing,
        evidenceCheck: passing,
      },
    }),
    article({
      id: 2,
      qaResults: {
        structural: passing,
        factCheck: passing,
        qualitativeReview: passing,
        evidenceCheck: { passed: false, notes: 'Remove or replace: "the fastest grinder".' },
      },
    }),
    // Predates the evidence check: not in its denominator.
    article({ id: 3, status: 'qa_passed', qaResults: { structural: passing } }),
  ])
  expect(summary.ev).toEqual({ t: 2, p: 1 })
  expect(summary.failures).toHaveLength(1)
  expect(summary.failures[0].fails).toEqual(['Evidence'])
  expect(summary.failures[0].details).toEqual(['Remove or replace: "the fastest grinder".'])
})

// QA fails a draft on a quoted "what we are NOT" breach even when the model's
// own verdict was `passed: true`; the report must count it the same way.
it('counts a not-trait breach as a qualitative failure, as QA does', () => {
  const summary = summarizeReportArticles([
    article({
      id: 1,
      qaResults: {
        structural: passing,
        factCheck: passing,
        qualitativeReview: {
          passed: true,
          notTraitViolations: [{ trait: 'Not salesy', excerpt: 'Buy now!', explanation: 'Hard sell' }],
        },
        evidenceCheck: passing,
      },
    }),
    article({
      id: 2,
      status: 'qa_passed',
      qaResults: { structural: passing, factCheck: passing, qualitativeReview: passing, evidenceCheck: passing },
    }),
  ])
  expect(summary.qu).toEqual({ t: 2, p: 1 })
  expect(summary.failures[0].fails).toContain('Qualitative review')
})

it('describes violations and names checks in review-page words, not codes', () => {
  const summary = summarizeReportArticles([
    article({
      id: 1,
      qaResults: {
        structural: {
          passed: false,
          violations: [
            { code: 'TITLE_TAG_TOO_LONG', limit: 60, actual: 74 },
            { code: 'HEADING_STRUCTURE', problem: 'missing_section', heading: 'Pricing' },
          ],
        },
        factCheck: { passed: false, notes: 'The launch date is wrong.' },
      },
    }),
  ])
  const [failure] = summary.failures
  expect(failure.fails).toEqual(['Structure', 'Fact check'])
  expect(failure.details).toEqual([
    'The SEO title tag is 74 characters; the limit is 60.',
    'Heading problem at "Pricing".',
    'The launch date is wrong.',
  ])
  expect(failure.details.join(' ')).not.toMatch(/TITLE_TAG_TOO_LONG|HEADING_STRUCTURE/)
})

it('still names a check that failed without leaving a note', () => {
  const [failure] = summarizeReportArticles([
    article({ id: 1, qaResults: { qualitativeReview: { passed: false, notes: null } } }),
  ]).failures
  expect(failure.fails).toEqual(['Qualitative review'])
  expect(failure.details).toEqual([])
})

it('leaves archived pieces out of the waiting lists but keeps their spend', () => {
  const summary = summarizeReportArticles([
    article({ id: 1, status: 'needs_revision', archived: true, totalCostUsd: 3 }),
    article({ id: 2, status: 'needs_revision', archived: false, totalCostUsd: 1 }),
    article({ id: 3, status: 'blocked', archived: true }),
    article({ id: 4, status: 'needs_review', archived: null }),
    article({ id: 5, status: 'qa_passed', archived: true }),
    article({ id: 6, status: 'qa_passed' }),
  ])
  expect(summary.failures.map((f) => f.id)).toEqual([2])
  expect(summary.igReviewQueue.map((a) => a.id)).toEqual([4])
  expect(summary.igAwaitingScoreCount).toBe(1)
  // Spend and the status mix describe everything that was ever made.
  expect(summary.articleCount).toBe(6)
  expect(summary.byStatus.needs_revision).toBe(2)
  expect(summary.waste).toBe(4)
})

it('has a label for every stage a cost-log row can carry', () => {
  const stage = CostLog.fields.find((f) => 'name' in f && f.name === 'stage')
  const options = (stage as { options: string[] }).options
  for (const id of options) {
    const label = costStageLabel(id)
    expect(label, id).not.toBe(id)
  }
  // The run bar and the report read one table.
  expect(costStageLabel('generate')).toBe(CALL_LABELS.generate)
})

it('renders the evidence pass rate, readable failures and labelled stages', () => {
  const summary = summarizeReportArticles([
    article({
      id: 2,
      title: 'Burr grinders',
      qaResults: {
        structural: passing,
        evidenceCheck: { passed: false, notes: 'Remove or replace: "the fastest grinder".' },
      },
    }),
  ])
  render(
    React.createElement(ReportsPanel, {
      summary,
      costs: {
        period: 'all',
        periodStart: null,
        totalUsd: 1,
        rowCount: 2,
        byModel: [],
        byStage: [
          { label: 'factCheck', usd: 0.4 },
          { label: 'evidenceCheck', usd: 0.6 },
        ],
      },
      stages: [
        { stage: 'factCheck', calls: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.4 },
        { stage: 'evidenceCheck', calls: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.6 },
      ],
      runs: { total: 0, succeeded: 0, failed: 0, active: 0, recentFailures: [] },
    }),
  )
  const card = screen.getByText('Burr grinders').closest('.datum-ops__fail-card') as HTMLElement
  expect(within(card).getByText(/Evidence/)).toBeTruthy()
  expect(card.textContent).not.toContain('no check named')
  expect(screen.getByText('Evidence: 0/1')).toBeTruthy()
  // Cost-log stage ids come out as the run bar's words, in the table and the bars.
  expect(screen.getAllByText(CALL_LABELS.factCheck).length).toBe(2)
  expect(screen.getAllByText(CALL_LABELS.evidenceCheck).length).toBe(2)
})
