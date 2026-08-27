'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState, useTransition } from 'react'

import type { BoardArticle, ColumnOwner } from './articleStatus'
import { isRunnableStatus, NEXT_STAGE_FOR_STATUS, STATUS_COLUMNS } from './articleStatus'
import { removeTopicsAction, runSelectedArticlesAction } from './boardActions'
import type { RunStatusDTO } from './boardTypes'
import { RunStatusPanel } from './RunStatusPanel'
import './ops.css'

type Props = {
  articles: BoardArticle[]
  templates: Array<{ id: number; name: string }>
  mode: 'mock' | 'live'
  pipelineReady: boolean
  runActive: boolean
  latestRun: RunStatusDTO | null
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.max(0, Math.floor(ms / 3_600_000))
  if (hours < 1) return '<1h'
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const OWNER_LABEL: Record<ColumnOwner, string> = {
  run: 'Start a run',
  you: 'Needs you',
  done: 'Finished',
}

export function ArticleBoard({
  articles,
  templates,
  mode,
  pipelineReady,
  runActive,
  latestRun,
}: Props) {
  const router = useRouter()
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [confirmLiveCost, setConfirmLiveCost] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles])
  // A card can vanish under a stale selection (removed elsewhere, or advanced by
  // a run), so every count and guard reads through the live article list.
  const selected = useMemo(
    () => [...picked].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    [picked, byId],
  )

  const readyToRun = articles.filter((a) => isRunnableStatus(a.status) && a.templateId != null)
  const needsTemplate = articles.filter((a) => a.status === 'topic_selected' && a.templateId == null)
  const needsYou = articles.filter((a) =>
    ['needs_revision', 'needs_review', 'blocked', 'verified', 'approved'].includes(a.status),
  )

  const removable = selected.length > 0 && selected.every((a) => a.status === 'topic_selected')
  const runnable = selected.length > 0 && selected.every((a) => a.templateId != null)
  const liveBlocked = mode === 'live' && !confirmLiveCost
  const runDisabled = pending || !pipelineReady || runActive || !runnable || liveBlocked

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectColumn = (ids: number[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const run = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await runSelectedArticlesAction({
        articleIds: selected.map((a) => a.id),
        confirmLiveCost,
      })
      setMessage({ ok: result.ok, text: result.ok ? result.message : result.error })
      if (result.ok) {
        setPicked(new Set())
        router.refresh()
      }
    })
  }

  const remove = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await removeTopicsAction(selected.map((a) => a.id))
      setMessage({ ok: result.ok, text: result.ok ? result.message : result.error })
      if (result.ok) {
        setPicked(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Article board</h1>
        <div className="datum-ops__pills">
          <span className="datum-ops__pill">{readyToRun.length} ready to run</span>
          <span className="datum-ops__pill">{needsYou.length} need you</span>
          {needsTemplate.length > 0 ? (
            <span className="datum-ops__pill">{needsTemplate.length} need a template</span>
          ) : null}
        </div>
      </div>
      <p className="datum-ops__lede">
        Every article sits in the column for whatever has to happen to it next. Columns marked{' '}
        <strong>Start a run</strong> move when you run the pipeline; columns marked{' '}
        <strong>Needs you</strong> are waiting on a decision and a run will not touch them. Tick the
        cards you want and use the bar below. Need more topics?{' '}
        <Link href="/admin/ops/topics">Find topics</Link>.
      </p>

      <RunStatusPanel initial={latestRun} />

      <section className="datum-ops__runbar">
        <div className="datum-ops__runbar-main">
          <p className="datum-ops__eyebrow">Selected</p>
          <p className="datum-ops__runbar-count">
            {selected.length === 0
              ? 'Nothing selected'
              : `${selected.length} article${selected.length === 1 ? '' : 's'}`}
          </p>
          <p className="datum-ops__hint">
            {selected.length === 0
              ? 'Tick a card in any column marked “Start a run”. One run takes a topic all the way through research, writing, QA and scoring.'
              : runnable
                ? `A run will pick each one up at ${[...new Set(selected.map((a) => NEXT_STAGE_FOR_STATUS[a.status as keyof typeof NEXT_STAGE_FOR_STATUS] ?? 'its next stage'))].join(', ').toLowerCase()}.`
                : 'Some of these have no template. Open them and assign one before running.'}
          </p>
        </div>
        <div className="datum-ops__runbar-actions">
          {mode === 'live' ? (
            <label className="datum-ops__cost-confirm">
              <input
                checked={confirmLiveCost}
                disabled={pending}
                onChange={(e) => setConfirmLiveCost(e.target.checked)}
                type="checkbox"
              />
              <span>This run uses paid live providers.</span>
            </label>
          ) : null}
          <button
            className="datum-ops__btn datum-ops__btn--primary"
            disabled={runDisabled}
            onClick={run}
            type="button"
          >
            {pending ? 'Starting…' : `Start run${selected.length > 0 ? ` (${selected.length})` : ''}`}
          </button>
          <button
            className="datum-ops__btn datum-ops__btn--danger"
            disabled={pending || !removable}
            onClick={remove}
            title={
              selected.length > 0 && !removable
                ? 'Only topics that have not started yet can be removed here.'
                : 'Archives the topic: it leaves the board and no run will touch it.'
            }
            type="button"
          >
            Remove from board
          </button>
        </div>
        {!pipelineReady ? (
          <p className="datum-ops__hint">
            <Link href="/admin">Finish workspace setup</Link> before starting a run.
          </p>
        ) : runActive ? (
          <p className="datum-ops__hint">A run is already going. Wait for it to finish.</p>
        ) : null}
        {message ? (
          <p className={message.ok ? 'datum-ops__ok' : 'datum-ops__error'} role="status">
            {message.text}
          </p>
        ) : null}
      </section>

      <div className="datum-ops__board">
        {STATUS_COLUMNS.map((col) => {
          const items = articles.filter((a) => a.status === col.id)
          const pickable = items.filter((a) => isRunnableStatus(a.status)).map((a) => a.id)
          const allPicked = pickable.length > 0 && pickable.every((id) => picked.has(id))
          return (
            <div
              className={`datum-ops__column datum-ops__column--${col.owner}${col.actionable ? ' datum-ops__column--actionable' : ''}`}
              key={col.id}
            >
              <div className="datum-ops__column-head">
                <h2>{col.label}</h2>
                <span>{items.length}</span>
              </div>
              <div className={`datum-ops__owner datum-ops__owner--${col.owner}`}>
                {OWNER_LABEL[col.owner]}
              </div>
              <div className="datum-ops__column-sub">{col.blurb}</div>
              {pickable.length > 1 ? (
                <button
                  className="datum-ops__link-btn datum-ops__column-select"
                  onClick={() => selectColumn(pickable, !allPicked)}
                  type="button"
                >
                  {allPicked ? 'Clear column' : `Select all ${pickable.length}`}
                </button>
              ) : null}
              <div className="datum-ops__column-body">
                {items.length === 0 ? (
                  <div className="datum-ops__empty">Nothing here</div>
                ) : (
                  items.map((a) => {
                    const canPick = isRunnableStatus(a.status)
                    return (
                      <div
                        className={`datum-ops__card${picked.has(a.id) ? ' is-picked' : ''}`}
                        key={a.id}
                      >
                        {canPick ? (
                          <label className="datum-ops__card-pick">
                            <input
                              aria-label={`Select ${a.title || a.keyword}`}
                              checked={picked.has(a.id)}
                              disabled={pending}
                              onChange={() => toggle(a.id)}
                              type="checkbox"
                            />
                            <span>Select</span>
                          </label>
                        ) : null}
                        <Link
                          className="datum-ops__card-link"
                          href={`/admin/ops/articles/${a.id}`}
                          prefetch={false}
                        >
                          <p className="datum-ops__card-title">{a.title || a.keyword}</p>
                          <p className="datum-ops__card-meta">
                            {a.templateName ?? 'No template'} · {ageLabel(a.updatedAt)}
                          </p>
                          {a.templateId == null ? (
                            <p className="datum-ops__card-warn">
                              Assign a template before this can run
                            </p>
                          ) : null}
                          <div className="datum-ops__row">
                            <span className={`datum-ops__status datum-ops__status--${a.status}`}>
                              {a.status.replace(/_/g, ' ')}
                            </span>
                            {a.totalCostUsd != null ? (
                              <span className="datum-ops__cost">${a.totalCostUsd.toFixed(2)}</span>
                            ) : null}
                          </div>
                        </Link>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
      {templates.length === 0 ? (
        <p className="datum-ops__hint">
          No content templates exist yet. <Link href="/admin/ops/templates">Create one</Link> before
          adding topics.
        </p>
      ) : null}
    </div>
  )
}
