'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { CONTENT_STAGES, stageOf } from './articleStatus'
import { latestRunAction } from './boardActions'
import { startRunPolling } from './runPolling'
import { isStaleRun, RUN_QUEUED_EVENT, type RunQueuedDetail } from './runQueued'
import { callLabel, runProgress, STAGE_PROGRESS, type RunStatusDTO } from './boardTypes'
import './ops.css'

/**
 * How long a finished run stays on screen, measured from when it actually
 * completed — not from when this client first saw it. Timing it from page load
 * would resurrect an hour-old result on every navigation.
 */
const SETTLED_LINGER_MS = 30000

/**
 * A failure stays until somebody dismisses it, but a dismissal is remembered by
 * run id, so a failure from last week would otherwise come back on every
 * reload. Past this age it is history, not news.
 */
const FAILED_VISIBLE_MS = 24 * 60 * 60 * 1000

/** How long a "Queued" placeholder may stand in for a run the poll cannot see yet. */
const AWAITING_RUN_MS = 20000

const DISMISSED_KEY = 'datum.runbar.dismissed'

/** Also run on the server, where `window` throws: nothing is dismissed there. */
const readDismissed = (): string | null => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}
const writeDismissed = (runId: string) => {
  try {
    window.localStorage.setItem(DISMISSED_KEY, runId)
  } catch {
    /* Private mode: the dismissal lasts until reload. */
  }
}

const elapsed = (fromIso: string | null, now: number): string => {
  if (!fromIso) return ''
  const ms = now - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  return mins > 0 ? `${mins}m ${total % 60}s` : `${total}s`
}

/**
 * Publishes the bar's rendered height as `--datum-runbar-h`, so the bottom
 * toaster in `ops.css` sits above it — including when the detail panel is open
 * and the bar is several rows tall. A callback ref, so it follows whichever of
 * the bar's two forms is mounted.
 */
function trackBarHeight(node: HTMLDivElement | null) {
  if (!node) return
  const root = document.documentElement
  const publish = () => root.style.setProperty('--datum-runbar-h', `${node.offsetHeight}px`)
  publish()
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
  observer?.observe(node)
  return () => {
    observer?.disconnect()
    root.style.removeProperty('--datum-runbar-h')
  }
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
  const [polledRun, setRun] = useState<RunStatusDTO | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)
  const [expanded, setExpanded] = useState(false)
  // The action the operator just took, until the run it queued shows up.
  const [announced, setAnnounced] = useState<RunQueuedDetail | null>(null)
  const announcedRef = useRef<RunQueuedDetail | null>(null)
  const seen = useRef<{ runId: string; status: string } | null>(null)

  // Whatever the poll last returned, minus a run that finished before the
  // action: showing its "Run finished" as the result of the new one is a lie.
  const shown = polledRun && announced && isStaleRun(polledRun, announced) ? null : polledRun
  const awaiting = announced !== null && !shown
  const active = shown?.status === 'queued' || shown?.status === 'running'

  useEffect(() => {
    const onQueued = (event: Event) => {
      const detail = (event as CustomEvent<RunQueuedDetail>).detail
      announcedRef.current = detail
      setAnnounced(detail)
    }
    window.addEventListener(RUN_QUEUED_EVENT, onQueued)
    return () => window.removeEventListener(RUN_QUEUED_EVENT, onQueued)
  }, [])

  useEffect(() => {
    if (!announced) return
    const timer = setTimeout(() => {
      if (announcedRef.current === announced) announcedRef.current = null
      setAnnounced((current) => (current === announced ? null : current))
    }, AWAITING_RUN_MS)
    return () => clearTimeout(timer)
  }, [announced])

  useEffect(() => {
    let mounted = true
    const stop = startRunPolling({
      visibility: document,
      wake: window,
      poll: async () => {
        const polled = await latestRunAction()
        if (!mounted) return false
        const waitingFor = announcedRef.current
        const stale = polled && waitingFor && isStaleRun(polled, waitingFor)
        if (polled && waitingFor && !stale) {
          announcedRef.current = null
          setAnnounced(null)
        }
        const next = stale ? null : polled
        const prev = seen.current
        seen.current = next ? { runId: next.runId, status: next.status } : null
        const wasActive = prev?.status === 'queued' || prev?.status === 'running'
        const nextActive = next?.status === 'queued' || next?.status === 'running'
        // A short run can finish between idle polls (or before the first poll).
        // Refresh each newly observed completion even if we never saw it active.
        if (next && !nextActive && (wasActive || prev?.runId !== next.runId)) router.refresh()
        setRun(next)
        setNow(Date.now())
        // Keep polling briskly until the announced run appears.
        return nextActive || announcedRef.current !== null
      },
    })
    return () => {
      mounted = false
      stop()
    }
  }, [router])

  const failed = shown?.status === 'failed'
  const finishedAt = shown?.completedAtIso ? new Date(shown.completedAtIso).getTime() : NaN
  const settledVisible = failed
    ? !Number.isFinite(finishedAt) || now - finishedAt <= FAILED_VISIBLE_MS
    : Number.isFinite(finishedAt) && now - finishedAt <= SETTLED_LINGER_MS
  const visible = awaiting || (!!shown && dismissed !== shown.runId && (active || settledVisible))
  // A failure has nothing left to tick or expire.
  const ticking = visible && !failed
  useEffect(() => {
    if (!ticking) return
    let timer: ReturnType<typeof setInterval> | undefined
    const updateClock = () => {
      clearInterval(timer)
      if (!document.hidden) timer = setInterval(() => setNow(Date.now()), 1000)
    }
    updateClock()
    document.addEventListener('visibilitychange', updateClock)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [ticking])

  const dismiss = (runId: string) => {
    writeDismissed(runId)
    setDismissed(runId)
  }

  const failureText = (r: RunStatusDTO) =>
    r.failures.length > 0
      ? `${r.failures[0].keyword} failed at ${r.failures[0].stage}${r.failures.length > 1 ? ` (+${r.failures.length - 1} more)` : ''}`
      : (r.errorSummary ?? 'The run did not complete')

  // The live regions stay mounted whether or not the bar is: a region that
  // appears together with its text is often not announced at all. They carry
  // state changes only — never the elapsed clock, which would be re-read every
  // second.
  const announcement = { status: '', alert: '' }
  if (visible) {
    if (!shown) announcement.status = 'Run queued'
    else if (shown.status === 'failed') announcement.alert = `Run failed. ${failureText(shown)}`
    else if (shown.status === 'succeeded') announcement.status = 'Run finished successfully'
    else if (shown.status === 'queued') announcement.status = 'Run queued'
    else {
      const lagging = [...shown.articles].sort(
        (a, b) => (STAGE_PROGRESS[a.status]?.step ?? 99) - (STAGE_PROGRESS[b.status]?.step ?? 99),
      )[0]
      const label = lagging ? (STAGE_PROGRESS[lagging.status]?.label ?? 'Finishing up') : 'Starting'
      announcement.status = `Run in progress: ${label}`
    }
  }
  const live = (
    <>
      <div aria-live="polite" className="datum-runbar__sr" role="status">
        {announcement.status}
      </div>
      <div className="datum-runbar__sr" role="alert">
        {announcement.alert}
      </div>
    </>
  )

  if (!visible) return live
  // The action succeeded but the poll cannot see its run yet.
  if (!shown) {
    return (
      <>
        {live}
        <div className="datum-runbar datum-runbar--queued" ref={trackBarHeight}>
          <div className="datum-runbar__inner">
            <span className="datum-runbar__dot datum-runbar__dot--queued" aria-hidden="true" />
            <div className="datum-runbar__text">
              <strong>Queued — waiting to start</strong>
            </div>
          </div>
        </div>
      </>
    )
  }
  const run = shown

  const progress = active ? runProgress(run.articles) : 1
  const onBoard = pathname === '/admin/ops/content'
  const moved = Object.entries(run.finalStatuses)
  const total = moved.reduce((sum, [, n]) => sum + n, 0)

  const activity = run.activity
  // The article whose status is furthest back is the one the pipeline is on:
  // stages run in order, so the laggard is the current work.
  const current = [...run.articles].sort(
    (a, b) => (STAGE_PROGRESS[a.status]?.step ?? 99) - (STAGE_PROGRESS[b.status]?.step ?? 99),
  )[0]
  const stageLabel = current
    ? (STAGE_PROGRESS[current.status]?.label ?? 'Finishing up')
    : 'Starting'
  // The stepper's numbering (`CONTENT_STAGES`), not the four pipeline stages
  // `STAGE_PROGRESS` counts — the bar's step has to match the piece's stepper.
  const stageStep = current ? stageOf(current.status).step : 1

  // What the model is doing *right now*, which article status cannot say: a
  // draft sits at one status for the whole ninety seconds a `generate` takes.
  const doing = activity?.lastCallStage
    ? callLabel(activity.lastCallStage, current?.status ?? null)
    : null
  const sinceCall = activity?.lastCallAtIso
    ? Math.floor((now - new Date(activity.lastCallAtIso).getTime()) / 1000)
    : null
  // No new call for a while is normal — it means one is in flight — but saying
  // so beats a frozen-looking line.
  const waiting = sinceCall !== null && sinceCall > 12

  const verbose = active
    ? [
        doing ?? stageLabel,
        waiting ? `waiting on the model (${sinceCall}s)` : null,
        activity && activity.totalCalls > 0
          ? `${activity.totalCalls} model call${activity.totalCalls === 1 ? '' : 's'} · $${activity.totalCostUsd.toFixed(2)}`
          : null,
        `${elapsed(run.startedAtIso, now)} elapsed`,
        run.mode === 'live' ? 'live providers' : 'mock mode',
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <>
      {live}
      <div className={`datum-runbar datum-runbar--${run.status}`} ref={trackBarHeight}>
        {/*
        Rendered before the status row: the bar is anchored to the bottom edge,
        so a panel after the row would push the row up off its anchor. This way
        the row stays put and the detail expands upward.
      */}
        {expanded && active && activity ? (
          <div className="datum-runbar__detail-panel">
            <ul>
              {activity.byStage.map((entry) => (
                <li key={entry.stage}>
                  <span>{callLabel(entry.stage, current?.status ?? null)}</span>
                  <span className="datum-runbar__detail-num">
                    {entry.calls} call{entry.calls === 1 ? '' : 's'} · ${entry.costUsd.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              {run.articles.length > 1 ? `${run.articles.length} articles in this run. ` : ''}
              Each article goes through research, writing, QA and information-gain scoring. Counts
              are model calls billed to this run so far.
            </p>
          </div>
        ) : null}
        <div className="datum-runbar__inner">
          <span
            className={`datum-runbar__dot datum-runbar__dot--${run.status}`}
            aria-hidden="true"
          />

          <div className="datum-runbar__text">
            <strong>
              {active
                ? run.status === 'queued'
                  ? 'Queued — waiting to start'
                  : `Step ${stageStep} of ${CONTENT_STAGES.length} · ${stageLabel}${current ? ` · ${current.keyword}` : ''}`
                : run.status === 'failed'
                  ? 'Run failed'
                  : 'Run finished'}
            </strong>
            <span className="datum-runbar__detail">
              {active
                ? verbose
                : run.status === 'failed'
                  ? failureText(run)
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
              <span
                className="datum-runbar__fill"
                style={{ transform: `scaleX(${Math.round(progress * 100) / 100})` }}
              />
            </div>
          ) : null}

          <div className="datum-runbar__actions">
            {active && activity && activity.byStage.length > 0 ? (
              <button
                aria-expanded={expanded}
                className="datum-runbar__link"
                onClick={() => setExpanded((v) => !v)}
                type="button"
              >
                {expanded ? 'Hide detail' : 'Detail'}
              </button>
            ) : null}
            {failed && run.failures[0] ? (
              <Link
                className="datum-runbar__link"
                href={`/admin/ops/articles/${run.failures[0].articleId}`}
              >
                Open piece
              </Link>
            ) : null}
            {!onBoard ? (
              <Link className="datum-runbar__link" href="/admin/ops/content">
                Open content
              </Link>
            ) : null}
            {failed ? (
              <button
                className="datum-runbar__link"
                onClick={() => dismiss(run.runId)}
                type="button"
              >
                Dismiss
              </button>
            ) : !active ? (
              <button
                aria-label="Dismiss"
                className="datum-runbar__close"
                onClick={() => dismiss(run.runId)}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
