'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

import { latestRunAction } from './boardActions'
import { runProgress, STAGE_PROGRESS, type RunStatusDTO } from './boardTypes'
import './ops.css'

/** Tight enough to feel live while a run is going. */
const ACTIVE_POLL_MS = 3000
/** Slow enough to be free, but still notices a run started in another tab. */
const IDLE_POLL_MS = 15000
/**
 * How long a finished run stays on screen, measured from when it actually
 * completed — not from when this client first saw it. Timing it from page load
 * would resurrect an hour-old result on every navigation.
 */
const SETTLED_LINGER_MS = 30000

const elapsed = (fromIso: string | null, now: number): string => {
  if (!fromIso) return ''
  const ms = now - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  return mins > 0 ? `${mins}m ${total % 60}s` : `${total}s`
}

/**
 * A run's status, on every admin page.
 *
 * Mounted from `admin.components.providers`, so it survives navigation: a live
 * run takes minutes per article, and pinning the operator to the board for the
 * duration — which is what the board-only panel did — is the actual complaint
 * this answers. It reports what each article is *doing*, not just that
 * something is happening, because "Running" for four minutes is unfalsifiable.
 */
export function GlobalRunBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [run, setRun] = useState<RunStatusDTO | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState<string | null>(null)

  const active = run?.status === 'queued' || run?.status === 'running'

  const poll = useCallback(async () => {
    const next = await latestRunAction()
    setRun((prev) => {
      // A run that just settled is worth one route refresh, so the page behind
      // the bar catches up — but exactly one, or the poll would refresh forever.
      const wasActive = prev?.status === 'queued' || prev?.status === 'running'
      const nowSettled = next && next.status !== 'queued' && next.status !== 'running'
      if (wasActive && nowSettled && prev?.runId === next?.runId) router.refresh()
      return next
    })
  }, [router])

  useEffect(() => {
    // Deferred rather than called in the effect body: polling is a subscription
    // to an external system, and a synchronous first call would land its
    // setState inside the same commit that started it.
    const first = setTimeout(() => void poll(), 0)
    const id = setInterval(() => void poll(), active ? ACTIVE_POLL_MS : IDLE_POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [poll, active])

  // Drives the elapsed counter and the linger timeout without a second poller.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!run) return null
  if (dismissed === run.runId) return null
  // A finished run says its piece and then gets out of the way. The board keeps
  // the full record, so nothing is lost by hiding it here.
  if (!active) {
    const finishedAt = run.completedAtIso ? new Date(run.completedAtIso).getTime() : NaN
    if (!Number.isFinite(finishedAt) || now - finishedAt > SETTLED_LINGER_MS) return null
  }

  const progress = active ? runProgress(run.articles) : 1
  const stages = [...new Set(run.articles.map((a) => STAGE_PROGRESS[a.status]?.label ?? 'Finishing up'))]
  const onBoard = pathname === '/admin/ops/articles'

  const moved = Object.entries(run.finalStatuses)
  const total = moved.reduce((sum, [, n]) => sum + n, 0)

  return (
    <div className={`datum-runbar datum-runbar--${run.status}`} role="status" aria-live="polite">
      <div className="datum-runbar__inner">
        <span className={`datum-runbar__dot datum-runbar__dot--${run.status}`} aria-hidden="true" />

        <div className="datum-runbar__text">
          <strong>
            {active
              ? `Running ${run.articleCount} article${run.articleCount === 1 ? '' : 's'}`
              : run.status === 'failed'
                ? 'Run failed'
                : 'Run finished'}
          </strong>
          <span className="datum-runbar__detail">
            {active
              ? `${stages.join(' · ') || 'Starting'} — ${elapsed(run.startedAtIso, now)} elapsed${run.mode === 'live' ? ' · live providers' : ''}`
              : run.failures.length > 0
                ? `${run.failures[0].keyword} failed at ${run.failures[0].stage}${run.failures.length > 1 ? ` (+${run.failures.length - 1} more)` : ''}`
                : total > 0
                  ? `Moved ${total} article${total === 1 ? '' : 's'} to ${moved.map(([s, n]) => `${n} ${s.replace(/_/g, ' ')}`).join(', ')}`
                  : 'Nothing moved'}
          </span>
        </div>

        {active ? (
          <div
            aria-label="Run progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress * 100)}
            className="datum-runbar__track"
            role="progressbar"
          >
            <span className="datum-runbar__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}

        <div className="datum-runbar__actions">
          {!onBoard ? (
            <Link className="datum-runbar__link" href="/admin/ops/articles">
              Open board
            </Link>
          ) : null}
          {!active ? (
            <button
              aria-label="Dismiss"
              className="datum-runbar__close"
              onClick={() => setDismissed(run.runId)}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
