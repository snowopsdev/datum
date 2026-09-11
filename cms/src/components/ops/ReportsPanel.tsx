'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import type { RunHealth, StageKpiRow } from '../../lib/opsKpis'
import type { ArticleReportSummary } from '../../lib/articleReportSummary'
import { PIPELINE_STAGE_LABEL, type PipelineStageName } from '../../lib/articleStatusMeta'
import { ARTICLE_STATUSES, CHECK_LABEL, STATUS_META } from './articleStatus'
import { IG_DECISIONS, IG_DECISION_LABEL } from '../../lib/articleReportSummary'
import './ops.css'

function isPipelineStageName(stage: string): stage is PipelineStageName {
  return Object.hasOwn(PIPELINE_STAGE_LABEL, stage)
}

/** The pipeline-stage id a cost-log row carries, said the way a person reads it. */
function stageLabel(stage: string): string {
  return isPipelineStageName(stage) ? PIPELINE_STAGE_LABEL[stage] : stage
}

/** A status id, said the way `STATUS_META` describes it; falls back for anything unrecognised. */
function statusLabel(status: string): string {
  return (STATUS_META as Record<string, { label: string } | undefined>)[status]?.label ??
    status.replace(/_/g, ' ')
}

export type SpendRow = { label: string; usd: number }

export type CostReport = {
  period: 'week' | 'month' | 'all'
  periodStart: string | null
  rowCount: number
  totalUsd: number
  byStage: SpendRow[]
  byModel: SpendRow[]
}

type Props = {
  summary: ArticleReportSummary
  costs: CostReport
  stages: StageKpiRow[]
  runs: RunHealth
}

/** Cents matter under a dollar; above it they are noise. */
const money = (usd: number) => `$${usd.toFixed(usd < 1 ? 4 : 2)}`

const DIGEST_PREVIEW = 8

function BarList({ rows }: { rows: SpendRow[] }) {
  const max = Math.max(...rows.map((r) => r.usd), 0.01)
  if (rows.length === 0) {
    return (
      <p className="datum-ops__sub" style={{ margin: 0 }}>
        (none in period)
      </p>
    )
  }
  return (
    <div>
      {rows.map((r) => (
        <div className="datum-ops__bar-row" key={r.label}>
          <span>{r.label}</span>
          <div className="datum-ops__bar-track">
            <div className="datum-ops__bar-fill" style={{ width: `${(r.usd / max) * 100}%` }} />
          </div>
          <span className="datum-ops__bar-amt">{money(r.usd)}</span>
        </div>
      ))}
    </div>
  )
}

export function ReportsPanel({ summary, costs, stages, runs }: Props) {
  const router = useRouter()
  const {
    byStatus,
    articleCount,
    withQaCount,
    st,
    fc,
    qu,
    failures,
    ig,
    igReviewQueue,
    igAwaitingScoreCount,
    publishedCount,
    publishedSpend,
    waste,
  } = summary

  const [showAllFailures, setShowAllFailures] = useState(false)
  const visibleFailures = showAllFailures ? failures : failures.slice(0, DIGEST_PREVIEW)

  const setPeriod = (period: CostReport['period']) => {
    router.push(`/admin/ops/reports?period=${period}`)
  }

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Reports</h1>
        <Link className="datum-ops__btn" href="/admin/ops/content" prefetch={false}>
          Content
        </Link>
      </div>
      <p className="datum-ops__lede">
        Where pieces are stuck, and what the runs cost. Drafts that failed a check come first; each
        card opens its review. Spend figures come from the cost log.
      </p>

      <div className="datum-ops__period">
        <span className="datum-ops__sub" style={{ margin: 0 }}>
          Cost period
        </span>
        <div className="datum-ops__switcher">
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={costs.period === p ? 'is-active' : undefined}
              onClick={() => setPeriod(p)}
            >
              {p === 'all' ? 'All time' : p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {costs.periodStart ? (
          <span className="datum-ops__sub" style={{ margin: 0 }}>
            since {costs.periodStart}
          </span>
        ) : null}
      </div>

      <div className="datum-ops__metrics">
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Articles</div>
          <div className="datum-ops__metric-value">{articleCount}</div>
          <div className="datum-ops__sub" style={{ margin: 0 }}>
            {withQaCount} with QA
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Period spend</div>
          <div className="datum-ops__metric-value">${costs.totalUsd.toFixed(2)}</div>
          <div className="datum-ops__sub" style={{ margin: 0 }}>
            {costs.rowCount} cost-log rows
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Needs revision</div>
          <div className="datum-ops__metric-value">{failures.length}</div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">QA structural</div>
          <div className="datum-ops__metric-value">
            {st.t ? `${Math.round((st.p / st.t) * 100)}%` : 'n/a'}
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Info-gain pass rate</div>
          <div className="datum-ops__metric-value">
            {ig.scored ? `${Math.round((ig.counts.PASS / ig.scored) * 100)}%` : 'n/a'}
          </div>
          <div className="datum-ops__sub" style={{ margin: 0 }}>
            {ig.counts.PASS}/{ig.scored} scored articles
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Review queue</div>
          <div className="datum-ops__metric-value">{igReviewQueue.length}</div>
          <div className="datum-ops__sub" style={{ margin: 0 }}>
            needs_review + blocked
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Cost / published</div>
          <div className="datum-ops__metric-value">
            {publishedCount ? `$${(publishedSpend / publishedCount).toFixed(2)}` : 'n/a'}
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Waste</div>
          <div className="datum-ops__metric-value">${waste.toFixed(2)}</div>
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Drafts that failed a check ({failures.length})</h2>
        <div className="datum-ops__panel-body">
          {failures.length === 0 ? (
            <p className="datum-ops__sub" style={{ margin: 0 }}>
              Nothing is waiting for a fix.
            </p>
          ) : (
            visibleFailures.map((a) => {
              const { fails, details } = a
              return (
                <div className="datum-ops__fail-card" key={a.id}>
                  <h3>{a.title || a.keyword}</h3>
                  <p className="datum-ops__fail-meta">
                    {a.templateName ?? 'No template'} · {fails.join(' · ') || 'no check named'}
                    {a.totalCostUsd != null ? ` · $${a.totalCostUsd.toFixed(2)}` : ''}
                  </p>
                  {details.length > 0 ? (
                    <ul>
                      {/*
                        Indexed because these are not unique: an article that
                        breaks the same rule four times yields four identical
                        lines (four `HEADING_STRUCTURE`s), and keying on the
                        text alone makes React drop all but the first.
                      */}
                      {details.map((d, i) => (
                        <li key={`${d}-${i}`}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="datum-ops__actions">
                    <Link
                      className="datum-ops__btn datum-ops__btn--primary"
                      href={`/admin/ops/articles/${a.id}`}
                      prefetch={false}
                    >
                      Open review
                    </Link>
                    <Link className="datum-ops__btn" href="/admin/ops/content" prefetch={false}>
                      Show in content
                    </Link>
                  </div>
                </div>
              )
            })
          )}
          {failures.length > DIGEST_PREVIEW ? (
            <button
              className="datum-ops__link-btn"
              onClick={() => setShowAllFailures((v) => !v)}
              type="button"
            >
              {showAllFailures ? `Show first ${DIGEST_PREVIEW}` : `Show all ${failures.length}`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Information-gain decisions</h2>
        <div className="datum-ops__panel-body">
          {ig.scored === 0 ? (
            <p className="datum-ops__sub" style={{ margin: 0 }}>
              (nothing scored yet)
            </p>
          ) : (
            <ul className="datum-ops__list">
              {IG_DECISIONS.map((d) => (
                <li key={d}>
                  {IG_DECISION_LABEL[d]}: {ig.counts[d]}
                </li>
              ))}
            </ul>
          )}
          <p className="datum-ops__sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {igAwaitingScoreCount} at <code>qa_passed</code> awaiting scoring. Decisions are counted
            from each article&apos;s current information-gain summary; an article reset or sent back
            since it was scored carries none and is not counted. The scores behind them are
            uncalibrated model estimates.
          </p>
          {igReviewQueue.length > 0 ? (
            <ul className="datum-ops__list" style={{ marginTop: 10 }}>
              {igReviewQueue.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/ops/articles/${a.id}`} prefetch={false}>
                    {a.title || a.keyword}
                  </Link>{' '}
                  — {statusLabel(a.status)}
                  {a.informationGain?.decision
                    ? ` · ${IG_DECISION_LABEL[a.informationGain.decision]}`
                    : ' · no current decision'}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Spend by stage</h2>
        <div className="datum-ops__panel-body">
          <BarList rows={costs.byStage.map((r) => ({ ...r, label: stageLabel(r.label) }))} />
          {stages.length > 0 ? (
            <table className="datum-ops__table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Calls</th>
                  <th>Tokens in</th>
                  <th>Tokens out</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.stage}>
                    <td>{stageLabel(s.stage)}</td>
                    <td>{s.calls}</td>
                    <td>{s.inputTokens.toLocaleString()}</td>
                    <td>{s.outputTokens.toLocaleString()}</td>
                    <td>{money(s.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Pipeline runs</h2>
        <div className="datum-ops__panel-body">
          <ul className="datum-ops__list">
            <li>succeeded: {runs.succeeded}</li>
            <li>failed: {runs.failed}</li>
            <li>queued / running: {runs.active}</li>
          </ul>
          {runs.recentFailures.length > 0 ? (
            <ul className="datum-ops__list" style={{ marginTop: 10 }}>
              {runs.recentFailures.map((f) => (
                <li key={f.runId}>
                  <code>{f.runId.slice(0, 8)}</code>
                  {f.completedAt ? ` · ${f.completedAt.slice(0, 16).replace('T', ' ')}` : ''} —{' '}
                  {f.errorSummary ?? 'no summary recorded'}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Spend by model</h2>
        <div className="datum-ops__panel-body">
          <BarList rows={costs.byModel} />
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Status mix</h2>
        <div className="datum-ops__panel-body">
          <ul className="datum-ops__list">
            {ARTICLE_STATUSES.map((id) => ({ id, label: statusLabel(id) })).map((c) => (
              <li key={c.id}>
                {c.label}: {byStatus[c.id] ?? 0}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>QA pass rates</h2>
        <div className="datum-ops__panel-body">
          <ul className="datum-ops__list">
            <li>
              {CHECK_LABEL.structural}: {st.p}/{st.t}
            </li>
            <li>
              {CHECK_LABEL.factCheck}: {fc.p}/{fc.t}
            </li>
            <li>
              {CHECK_LABEL.qualitative}: {qu.p}/{qu.t}
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
