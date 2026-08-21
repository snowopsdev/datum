'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'

import type { BoardArticle } from './articleStatus'
import { STATUS_COLUMNS } from './articleStatus'
import './ops.css'

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
  articles: BoardArticle[]
  costs: CostReport
}

function failureDetails(a: BoardArticle): { fails: string[]; details: string[] } {
  const fails: string[] = []
  const details: string[] = []
  const qa = a.qaResults
  if (qa?.structural?.passed === false) {
    fails.push('structural')
    const raw = qa.structural.violations
    if (Array.isArray(raw)) {
      for (const v of raw) {
        if (typeof v === 'string') details.push(v)
        else if (v && typeof v === 'object' && 'code' in v) {
          details.push(String((v as { code: unknown }).code))
        }
      }
    }
  }
  if (qa?.factCheck?.passed === false) {
    fails.push('factCheck')
    if (qa.factCheck.notes) details.push(qa.factCheck.notes)
  }
  if (qa?.qualitativeReview?.passed === false) {
    fails.push('qualitative')
    if (qa.qualitativeReview.notes) details.push(qa.qualitativeReview.notes)
  }
  return { fails, details }
}

function BarList({ rows }: { rows: SpendRow[] }) {
  const max = Math.max(...rows.map((r) => r.usd), 0.01)
  if (rows.length === 0) {
    return <p className="datum-ops__sub" style={{ margin: 0 }}>(none in period)</p>
  }
  return (
    <div>
      {rows.map((r) => (
        <div className="datum-ops__bar-row" key={r.label}>
          <span>{r.label}</span>
          <div className="datum-ops__bar-track">
            <div className="datum-ops__bar-fill" style={{ width: `${(r.usd / max) * 100}%` }} />
          </div>
          <span className="datum-ops__bar-amt">${r.usd.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

export function ReportsPanel({ articles, costs }: Props) {
  const router = useRouter()
  const byStatus = Object.fromEntries(STATUS_COLUMNS.map((c) => [c.id, 0])) as Record<
    string,
    number
  >
  for (const a of articles) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1

  const withQa = articles.filter((a) => a.qaResults?.structural?.passed != null)
  const rate = (key: 'structural' | 'factCheck' | 'qualitativeReview') => {
    const rows = articles.filter((a) => {
      const block = a.qaResults?.[key]
      return block && typeof block === 'object' && 'passed' in block && block.passed != null
    })
    const passed = rows.filter((a) => a.qaResults?.[key]?.passed === true).length
    return { t: rows.length, p: passed }
  }
  const st = rate('structural')
  const fc = rate('factCheck')
  const qu = rate('qualitativeReview')
  const failures = articles.filter((a) => a.status === 'needs_revision')
  const published = articles.filter((a) => a.status === 'published')
  const publishedSpend = published.reduce((s, a) => s + (a.totalCostUsd ?? 0), 0)
  const allSpend = articles.reduce((s, a) => s + (a.totalCostUsd ?? 0), 0)
  const waste = Math.max(0, allSpend - publishedSpend)

  const setPeriod = (period: CostReport['period']) => {
    router.push(`/admin/ops/reports?period=${period}`)
  }

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Reports</h1>
        <Link className="datum-ops__btn" href="/admin/ops/articles" prefetch={false}>
          Article board
        </Link>
      </div>
      <p className="datum-ops__lede">
        Ops loop first — failure digest jumps into review. Spend panels read <code>cost-log</code>{' '}
        (same source as <code>pipeline:report</code>).
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
          <div className="datum-ops__metric-value">{articles.length}</div>
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
          <div className="datum-ops__metric-label">Cost / published</div>
          <div className="datum-ops__metric-value">
            {published.length ? `$${(publishedSpend / published.length).toFixed(2)}` : 'n/a'}
          </div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">Waste</div>
          <div className="datum-ops__metric-value">${waste.toFixed(2)}</div>
        </div>
        <div className="datum-ops__metric">
          <div className="datum-ops__metric-label">With QA</div>
          <div className="datum-ops__metric-value">{withQa.length}</div>
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Failure digest · ops loop</h2>
        <div className="datum-ops__panel-body">
          {failures.length === 0 ? (
            <p className="datum-ops__sub" style={{ margin: 0 }}>
              (none at needs_revision)
            </p>
          ) : (
            failures.map((a) => {
              const { fails, details } = failureDetails(a)
              return (
                <div className="datum-ops__fail-card" key={a.id}>
                  <h3>{a.title || a.keyword}</h3>
                  <p className="datum-ops__fail-meta">
                    {a.templateName ?? '—'} · {fails.join(' · ') || 'unspecified'}
                    {a.totalCostUsd != null ? ` · $${a.totalCostUsd.toFixed(2)}` : ''}
                  </p>
                  {details.length > 0 ? (
                    <ul>
                      {details.map((d) => (
                        <li key={d}>{d}</li>
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
                    <Link className="datum-ops__btn" href="/admin/ops/articles" prefetch={false}>
                      Show on board
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="datum-ops__panel">
        <h2>Spend by stage</h2>
        <div className="datum-ops__panel-body">
          <BarList rows={costs.byStage} />
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
            {STATUS_COLUMNS.map((c) => (
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
              structural: {st.p}/{st.t}
            </li>
            <li>
              factCheck: {fc.p}/{fc.t}
            </li>
            <li>
              qualitative: {qu.p}/{qu.t}
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
