import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import type { AuditSummary } from '@/components/ops/auditTypes'
import type { InformationGainRunView } from '@/components/ops/articleStatus'
import { ARTICLE_STATUSES } from '@/lib/articleStatusMeta'

/**
 * The panel registry and the audit grouper, without a database.
 *
 * `review/index.ts` pulls every panel in, and the panels reach the server
 * actions, which reach `@payload-config`. Mocking that boundary keeps this a
 * unit test of the split itself: that every status has a panel, and that the
 * timeline collapses a run's model calls into one row.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}))
vi.mock('@/components/ops/actions', () => ({
  approveArticleAction: vi.fn(),
  archiveArticleAction: vi.fn(),
  assignTemplateAction: vi.fn(),
  overrideReviewAction: vi.fn(),
  publishArticleAction: vi.fn(),
  regenerateArticleAction: vi.fn(),
  resetToDraftedAction: vi.fn(),
  scheduleArticleAction: vi.fn(),
  sendBackAction: vi.fn(),
  unscheduleArticleAction: vi.fn(),
}))
vi.mock('@/components/ops/briefActions', () => ({
  revisitBriefAction: vi.fn(),
  saveBriefAction: vi.fn(),
  approveBriefAction: vi.fn(),
}))
vi.mock('@/components/ops/boardActions', () => ({ runSelectedArticlesAction: vi.fn() }))
vi.mock('@/components/ops/auditActions', () => ({ auditDetailsAction: vi.fn() }))

const { PANEL_FOR_STATUS } = await import('@/components/ops/review')
const { RunNextStagePanel } = await import('@/components/ops/review/panels/RunNextStagePanel')
const { groupAuditEvents } = await import('@/components/ops/review/AuditTrail')
const { Scorecard } = await import('@/components/ops/review/Scorecard')

const entry = (overrides: Partial<AuditSummary>): AuditSummary => ({
  id: `entry-${Math.random()}`,
  actor: 'pipeline',
  actorType: 'pipeline',
  createdAt: '2026-09-01T10:00:00.000Z',
  createdAtLabel: '2026-09-01 10:00',
  costUsd: null,
  source: { kind: 'audit', recordId: 1 },
  event: 'status_changed',
  fromStatus: null,
  pipelineRunId: null,
  stage: null,
  summary: 'something happened',
  toStatus: null,
  ...overrides,
})

const call = (runId: string): AuditSummary =>
  entry({
    event: 'model_call_completed',
    pipelineRunId: runId,
    costUsd: 0.25,
    source: { kind: 'cost', recordId: 2 },
    summary: 'generate call completed',
  })

const statusChange = (): AuditSummary =>
  entry({ event: 'status_changed', actorType: 'user', actor: 'editor@test.local' })

it('maps every article status to exactly one panel', () => {
  for (const status of ARTICLE_STATUSES) expect(PANEL_FOR_STATUS[status]).toBeTypeOf('function')
})

/**
 * A piece at `researched`, `drafted` or `qa_passed` that no run is carrying is
 * stalled, and the only panel those statuses get used to offer nothing but
 * "Run next stage" — so the way out of a piece nobody wants finished was to
 * run it first. Archive belongs there whenever no run is carrying it.
 */
const runPanelProps = (over: Record<string, unknown> = {}) =>
  ({
    action: {
      error: null,
      notice: null,
      pending: false,
      runAction: () => {},
      setNotice: () => {},
    },
    article: {
      id: 1,
      status: 'researched',
      archived: false,
      templateId: 3,
      researchHint: null,
    },
    activeRunIncludesArticle: false,
    editHref: '/admin/collections/articles/1',
    mode: 'mock',
    run: null,
    runIsCurrent: false,
    scheduleExpired: false,
    scoreInvalidatedBy: null,
    templates: [{ id: 3, name: 'Listicle' }],
    ...over,
  }) as never

it('offers Archive on a stalled runnable piece', () => {
  const { unmount } = render(React.createElement(RunNextStagePanel, runPanelProps()))
  expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
  unmount()
})

it('hides Archive while a run is carrying the piece', () => {
  const { unmount } = render(
    React.createElement(RunNextStagePanel, runPanelProps({ activeRunIncludesArticle: true })),
  )
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Run next stage' })).toBeTruthy()
  unmount()
})

it('groups model calls per run in the audit trail', () => {
  const rows = groupAuditEvents([call('r1'), call('r1'), statusChange(), call('r2')])
  expect(rows.map((r) => r.kind)).toEqual(['run', 'status', 'run'])
  expect(rows[0]).toMatchObject({ runId: 'r1', calls: 2 })
})

/** A run whose single policy reason cites its single claim. */
const scoredRun = (): InformationGainRunView => ({
  id: 42,
  createdAt: '2026-09-01T10:00:00.000Z',
  createdAtLabel: '2026-09-01 10:00',
  decision: 'REVISE',
  policyVersion: 'ig-v1:test',
  calibrated: false,
  baselineAvailable: true,
  scores: {
    consensusCoverage: 0.5,
    potentialGainUnits: 1,
    verifiedGainUnits: 0.5,
    verificationRatio: 0.5,
    verifiedGainDensity: 0.1,
    facetGainCoverage: 0.4,
    internalDuplicationRate: 0.1,
  },
  claimSummary: {
    totalClaims: 1,
    materiallyNovelClaims: 1,
    verifiedNovelClaims: 0,
    unsupportedNovelClaims: 1,
    contradictoryClaims: 0,
    firstPartyClaims: 0,
  },
  reasons: [
    {
      policy: 'NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT',
      claimId: 'c1',
      message: 'No usable evidence.',
      severity: 'REVISE',
    },
  ],
  claims: [
    {
      id: 'c1',
      text: 'a claim',
      excerpt: 'a claim',
      section: null,
      kind: 'unknown',
      novelty: 0.5,
      relevance: 0.5,
      utility: 0.5,
      intraDocumentNovelty: 0.5,
      potentialGain: 1,
      verifiedGain: 0.5,
      evidenceIntegrity: 0.5,
      verificationMode: 'unknown',
      blocked: false,
      requiresHumanReview: false,
      materiallyNovel: true,
      verifiedNovel: false,
      evidence: [],
      reasons: [],
    },
  ],
  claimCount: 1,
  claimsTruncated: false,
  tokenCount: 100,
  costUsd: 0.1,
})

/**
 * A fragment link to a row inside a closed `<details>` scrolls nowhere, so the
 * reason's claim link has to open the disclosure before the jump.
 */
it('opens the scorecard disclosure when a policy reason links to a claim', () => {
  render(React.createElement(Scorecard, { run: scoredRun(), isCurrent: true, summaryRunId: 42 }))
  const disclosure = document.querySelector('details') as HTMLDetailsElement
  expect(disclosure.open).toBe(false)
  screen.getByRole('link', { name: 'c1' }).click()
  expect(disclosure.open).toBe(true)
})
