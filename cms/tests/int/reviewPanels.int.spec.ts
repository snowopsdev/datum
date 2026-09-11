import React from 'react'
import { expect, it, vi } from 'vitest'

import type { AuditSummary } from '@/components/ops/auditTypes'
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
const { groupAuditEvents } = await import('@/components/ops/review/AuditTrail')

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

it('groups model calls per run in the audit trail', () => {
  const rows = groupAuditEvents([call('r1'), call('r1'), statusChange(), call('r2')])
  expect(rows.map((r) => r.kind)).toEqual(['run', 'status', 'run'])
  expect(rows[0]).toMatchObject({ runId: 'r1', calls: 2 })
})
