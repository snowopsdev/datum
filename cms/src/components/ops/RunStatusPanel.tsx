'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { latestRunAction } from './boardActions'
import type { RunStatusDTO } from './boardTypes'
import './ops.css'

type Props = { initial: RunStatusDTO | null }

/** How often an in-flight run is re-checked. */
const POLL_MS = 3000

const STATUS_COPY: Record<RunStatusDTO['status'], string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Finished',
  failed: 'Failed',
}

/**
 * The board's answer to "what happened to my run".
 *
 * Without this, starting a run gave one toast and then silence: the cards do not
 * move on their own, a stage failure is caught and logged server-side, and the
 * run row is the only record — none of which is visible from the board. It polls
 * only while a run is actually in flight, then stops.
 */
export function RunStatusPanel({ initial }: Props) {
  const router = useRouter()
  const [polled, setPolled] = useState<RunStatusDTO | null>(null)

  // Derived, not synced: the poll only ever refines the run the server already
  // handed us, so the moment `initial` names a *different* run — a new one was
  // started — whatever we polled is about the previous one and is dropped.
  const run = polled && polled.runId === initial?.runId ? polled : initial

  const active = run?.status === 'queued' || run?.status === 'running'

  useEffect(() => {
    if (!active) return
    let live = true
    const id = setInterval(async () => {
      const next = await latestRunAction()
      if (!live) return
      setPolled(next)
      // The board is a server component, so the cards only move when the route
      // re-renders. Ask for that exactly once, when the run stops.
      if (next && next.status !== 'queued' && next.status !== 'running') router.refresh()
    }, POLL_MS)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [active, router])

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
