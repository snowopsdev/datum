'use client'

import React from 'react'

import type { RunStatusDTO } from './boardTypes'
import './ops.css'

type Props = { initial: RunStatusDTO | null }

const STATUS_COPY: Record<RunStatusDTO['status'], string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Finished',
  failed: 'Failed',
}

/**
 * The board's answer to "what happened to my run".
 *
 * The board's durable record of the last run: what moved, and what did not.
 * Live progress is the `GlobalRunBar`'s job — it is the single poller, and it
 * refreshes this route when a run settles, so this stays a plain render of
 * server props rather than a second timer racing the first.
 */
export function RunStatusPanel({ initial }: Props) {
  const run = initial
  const active = run?.status === 'queued' || run?.status === 'running'

  if (!run) return null

  const moved = Object.entries(run.finalStatuses)
  const total = moved.reduce((sum, [, n]) => sum + n, 0)

  return (
    <section
      className={`datum-ops__runstatus datum-ops__runstatus--${run.status}`}
      aria-live="polite"
    >
      <div className="datum-ops__runstatus-head">
        <span className={`datum-ops__pill datum-ops__pill--${run.status}`}>
          {STATUS_COPY[run.status]}
        </span>
        <strong>Last run</strong>
        <span className="datum-ops__hint">
          {run.mode === 'live' ? 'live providers' : 'mock mode'} · started {run.startedLabel}
          {run.articleCount > 0
            ? ` · ${run.articleCount} article${run.articleCount === 1 ? '' : 's'}`
            : ''}
        </span>
      </div>

      {active ? (
        <p className="datum-ops__hint">
          Working through research, writing, QA and scoring. A live run takes a few minutes per
          article. This updates itself — you do not need to refresh.
        </p>
      ) : total > 0 ? (
        <p className="datum-ops__hint">
          Moved {total} article{total === 1 ? '' : 's'} to{' '}
          {moved.map(([status, n]) => `${n} ${status.replace(/_/g, ' ')}`).join(', ')}.
        </p>
      ) : (
        <p className="datum-ops__hint">Nothing moved.</p>
      )}

      {run.failures.length > 0 ? (
        <div className="datum-ops__runstatus-fails">
          <p className="datum-ops__eyebrow">
            {run.failures.length} article{run.failures.length === 1 ? '' : 's'} could not be advanced
          </p>
          <ul>
            {run.failures.map((f, i) => (
              <li key={`${f.articleId}-${i}`}>
                <strong>{f.keyword}</strong> — failed at {f.stage}. {f.message}
              </li>
            ))}
          </ul>
          <p className="datum-ops__hint">
            These kept their place on the board, so starting another run retries them. A research
            failure usually means the keyword has no search results to compare against — try a
            broader one.
          </p>
        </div>
      ) : run.errorSummary ? (
        <p className="datum-ops__error">{run.errorSummary}</p>
      ) : null}
    </section>
  )
}
