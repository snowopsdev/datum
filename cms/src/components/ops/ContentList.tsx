'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState, useTransition } from 'react'

import type { BoardArticle } from './articleStatus'
import { OWNER_LABEL, STAGE_LABEL, stageOf } from './articleStatus'
import { removeTopicsAction } from './boardActions'
import type { RunStatusDTO } from './boardTypes'
import { RunStatusPanel } from './RunStatusPanel'
import { Stepper } from './Stepper'
import './ops.css'

type Filter = 'you' | 'working' | 'done' | 'all'

type Props = {
  articles: BoardArticle[]
  latestRun: RunStatusDTO | null
  mode: 'mock' | 'live'
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.max(0, Math.floor(ms / 3_600_000))
  if (hours < 1) return 'just now'
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const FILTER_LABEL: Record<Filter, string> = {
  you: 'Needs you',
  working: 'In progress',
  done: 'Done',
  all: 'All',
}

const matches = (filter: Filter, a: BoardArticle): boolean => {
  const owner = stageOf(a.status).owner
  if (filter === 'you') return owner === 'you'
  if (filter === 'working') return owner === 'run'
  if (filter === 'done') return owner === 'done'
  return true
}

/**
 * The primary content screen: every piece, where it is, and who it is waiting
 * on. One row per piece, a stepper instead of ten status columns, and the
 * first tab is the work that needs a person — because that is what someone
 * opening this page is here to find.
 */
export function ContentList({ articles, latestRun, mode }: Props) {
  const router = useRouter()
  const counts = useMemo(
    () => ({
      you: articles.filter((a) => matches('you', a)).length,
      working: articles.filter((a) => matches('working', a)).length,
      done: articles.filter((a) => matches('done', a)).length,
      all: articles.length,
    }),
    [articles],
  )
  const [filter, setFilter] = useState<Filter>(counts.you > 0 ? 'you' : 'all')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const visible = articles.filter((a) => {
    if (!matches(filter, a)) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (a.title ?? '').toLowerCase().includes(q) || a.keyword.toLowerCase().includes(q)
  })

  const removable = articles.filter((a) => a.status === 'topic_selected' && picked.has(a.id))

  const remove = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await removeTopicsAction(removable.map((a) => a.id))
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
        <h1>Content</h1>
        <Link className="datum-ops__btn datum-ops__btn--primary" href="/admin/ops/new">
          New content
        </Link>
      </div>
      <p className="datum-ops__lede">
        Every piece, where it is, and who it is waiting on. <strong>Needs you</strong> is the work
        only a person can move; <strong>In progress</strong> is Datum working and updates on its
        own.
      </p>

      <RunStatusPanel initial={latestRun} />

      <div className="datum-content__toolbar">
        <div className="datum-ops__tabs datum-ops__tabs--pills" role="tablist">
          {(['you', 'working', 'done', 'all'] as Filter[]).map((f) => (
            <button
              aria-selected={filter === f}
              className={filter === f ? 'is-active' : undefined}
              key={f}
              onClick={() => setFilter(f)}
              role="tab"
              type="button"
            >
              {FILTER_LABEL[f]} <span className="datum-content__count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <input
          aria-label="Search content"
          className="datum-content__search"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or keyword"
          type="search"
          value={query}
        />
      </div>

      {removable.length > 0 ? (
        <div className="datum-content__bulk">
          <span>
            {removable.length} topic{removable.length === 1 ? '' : 's'} selected
          </span>
          <button className="datum-ops__btn datum-ops__btn--danger" disabled={pending} onClick={remove} type="button">
            Remove from content
          </button>
          <span className="datum-ops__hint">Only topics research has not started can be removed.</span>
        </div>
      ) : null}
      {message ? (
        <p className={message.ok ? 'datum-ops__ok' : 'datum-ops__error'} role="status">
          {message.text}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="datum-content__empty">
          {articles.length === 0 ? (
            <>
              <h2>Nothing here yet</h2>
              <p>
                Start with <Link href="/admin/ops/new">New content</Link>: pick the kind of piece, pick
                a topic, and Datum researches it while you wait.
              </p>
            </>
          ) : filter === 'you' ? (
            <>
              <h2>Nothing needs you right now</h2>
              <p>
                {counts.working > 0
                  ? `Datum is working on ${counts.working} piece${counts.working === 1 ? '' : 's'}. You will see them here when a brief is ready or a draft needs a decision.`
                  : 'Everything is either done or waiting to be started.'}
              </p>
            </>
          ) : (
            <p>No pieces match.</p>
          )}
        </div>
      ) : (
        <ul className="datum-content__list">
          {visible.map((a) => {
            const info = stageOf(a.status)
            const href = `/admin/ops/articles/${a.id}`
            return (
              <li className={`datum-content__row datum-content__row--${info.owner}`} key={a.id}>
                {a.status === 'topic_selected' ? (
                  <input
                    aria-label={`Select ${a.title || a.keyword}`}
                    checked={picked.has(a.id)}
                    className="datum-content__pick"
                    disabled={pending}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (next.has(a.id)) next.delete(a.id)
                        else next.add(a.id)
                        return next
                      })
                    }
                    type="checkbox"
                  />
                ) : (
                  <span className="datum-content__pick" aria-hidden="true" />
                )}
                <div className="datum-content__main">
                  <Link className="datum-content__title" href={href} prefetch={false}>
                    {a.title || a.keyword}
                  </Link>
                  <p className="datum-content__meta">
                    {a.templateName ?? 'No template'}
                    {a.templateName ? '' : ' · assign one to continue'} · {ageLabel(a.updatedAt)}
                    {a.totalCostUsd != null ? ` · $${a.totalCostUsd.toFixed(2)}` : ''}
                  </p>
                </div>
                <div className="datum-content__stage">
                  <Stepper current={info} />
                  <span className="datum-content__stage-label">
                    {STAGE_LABEL[info.stage]} · {info.label}
                  </span>
                </div>
                <span className={`datum-content__owner datum-content__owner--${info.owner}`}>
                  {OWNER_LABEL[info.owner]}
                </span>
                <div className="datum-content__action">
                  {info.action ? (
                    <Link
                      className={`datum-ops__btn${info.owner === 'you' ? ' datum-ops__btn--primary' : ''}`}
                      href={href}
                      prefetch={false}
                    >
                      {info.action}
                    </Link>
                  ) : (
                    <Link className="datum-ops__link-btn" href={href} prefetch={false}>
                      Open
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {mode === 'live' ? (
        <p className="datum-ops__hint" style={{ marginTop: 16 }}>
          Live mode: writing, checks and scoring call paid providers. Approving a brief is what
          starts that.
        </p>
      ) : null}
    </div>
  )
}
