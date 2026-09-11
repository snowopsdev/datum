'use client'

import React from 'react'

import { AuditEvidence } from '../AuditEvidence'
import { auditEventLabel, type AuditSummary } from '../auditTypes'

/** The cost-log rows `ArticleReviewView` synthesises into timeline entries. */
const MODEL_CALL_EVENT = 'model_call_completed'

/**
 * One line of the timeline: either a single event, or every model call one
 * pipeline run made, collapsed into one row.
 */
export type AuditRow =
  | { kind: 'status'; key: string; entry: AuditSummary }
  | {
      kind: 'run'
      key: string
      runId: string
      calls: number
      costUsd: number
      entries: AuditSummary[]
    }

/**
 * Collapse a run's model calls into one row, leaving everything else alone.
 *
 * A generate stage writes a cost row per call, so a single run could push
 * twenty near-identical "call completed" lines between two things a person
 * did — the events a reviewer opens the trail to find. Grouping is by
 * `pipelineRunId` across the whole list rather than by adjacency, so a status
 * event recorded mid-run does not split its calls into two rows; the group
 * keeps the position of the run's first (newest) call.
 *
 * Pure and exported for the test: the grouping is the behaviour, the
 * disclosure around it is presentation.
 */
export function groupAuditEvents(entries: readonly AuditSummary[]): AuditRow[] {
  const rows: AuditRow[] = []
  const byRun = new Map<string, Extract<AuditRow, { kind: 'run' }>>()
  for (const entry of entries) {
    // A model call with no run id cannot be grouped with anything; it stands
    // on its own rather than being dropped or lumped under a fake id.
    if (entry.event !== MODEL_CALL_EVENT || !entry.pipelineRunId) {
      rows.push({ kind: 'status', key: entry.id, entry })
      continue
    }
    const existing = byRun.get(entry.pipelineRunId)
    if (existing) {
      existing.calls += 1
      existing.costUsd += entry.costUsd ?? 0
      existing.entries.push(entry)
      continue
    }
    const group: Extract<AuditRow, { kind: 'run' }> = {
      kind: 'run',
      key: `run-${entry.pipelineRunId}`,
      runId: entry.pipelineRunId,
      calls: 1,
      costUsd: entry.costUsd ?? 0,
      entries: [entry],
    }
    byRun.set(entry.pipelineRunId, group)
    rows.push(group)
  }
  return rows
}

/** Cents matter under a dollar; above it they are noise. Mirrors the reports page. */
const money = (usd: number) => `$${usd.toFixed(usd < 1 ? 4 : 2)}`

function TimelineEntry({ articleId, entry }: { articleId: number; entry: AuditSummary }) {
  return (
    <li className="datum-ops__timeline-item">
      <div className="datum-ops__timeline-marker" aria-hidden="true" />
      <div className="datum-ops__timeline-content">
        <div className="datum-ops__timeline-title">
          <strong>{entry.summary}</strong>
          <time dateTime={entry.createdAt}>{entry.createdAtLabel}</time>
        </div>
        <div className="datum-ops__timeline-meta">
          <span>{auditEventLabel(entry.event)}</span>
          <span>{entry.actorType}</span>
          <span>{entry.actor}</span>
          {entry.stage ? <span>{entry.stage}</span> : null}
          {entry.fromStatus || entry.toStatus ? (
            <span>
              {entry.fromStatus ?? 'new'} → {entry.toStatus ?? 'unchanged'}
            </span>
          ) : null}
          {entry.pipelineRunId ? <span>run {entry.pipelineRunId.slice(0, 8)}</span> : null}
        </div>
        <AuditEvidence articleId={articleId} source={entry.source} />
      </div>
    </li>
  )
}

/**
 * A run's model calls, behind one disclosure.
 *
 * A run that made exactly one call renders as that call, flat: a disclosure
 * that hides a single row costs a click and tells the reader nothing the row
 * did not already say.
 */
function RunGroup({
  articleId,
  row,
}: {
  articleId: number
  row: Extract<AuditRow, { kind: 'run' }>
}) {
  if (row.entries.length === 1) {
    return <TimelineEntry articleId={articleId} entry={row.entries[0]} />
  }
  return (
    <li className="datum-ops__timeline-item">
      <div className="datum-ops__timeline-marker" aria-hidden="true" />
      <div className="datum-ops__timeline-content">
        <details className="datum-ops__audit-details">
          <summary>
            run {row.runId.slice(0, 8)} · {row.calls} calls · {money(row.costUsd)}
          </summary>
          <ol className="datum-ops__timeline">
            {row.entries.map((entry) => (
              <TimelineEntry articleId={articleId} entry={entry} key={entry.id} />
            ))}
          </ol>
        </details>
      </div>
    </li>
  )
}

/** Every change, run, model call, and decision on this piece. */
export function AuditTrail({
  articleId,
  entries,
}: {
  articleId: number
  entries: AuditSummary[]
}) {
  const rows = groupAuditEvents(entries)
  return (
    <section className="datum-ops__audit" aria-labelledby="audit-trail-heading">
      <div className="datum-ops__audit-head">
        <div>
          <h2 id="audit-trail-heading">Audit trail</h2>
          <p>Every change, run, model call, and decision on this piece.</p>
        </div>
        <span>{entries.length} events</span>
      </div>
      {entries.length === 0 ? (
        <p className="datum-ops__empty">Nothing recorded yet. Tracking starts with the next change.</p>
      ) : (
        <ol className="datum-ops__timeline">
          {rows.map((row) =>
            row.kind === 'run' ? (
              <RunGroup articleId={articleId} key={row.key} row={row} />
            ) : (
              <TimelineEntry articleId={articleId} entry={row.entry} key={row.key} />
            ),
          )}
        </ol>
      )}
    </section>
  )
}
