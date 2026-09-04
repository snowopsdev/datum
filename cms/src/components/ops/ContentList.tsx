'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState, useTransition } from 'react'

import type { ContentFilter, ContentPage } from './contentListData'
import { OWNER_LABEL, STAGE_LABEL, stageOf } from './articleStatus'
import { removeTopicsAction } from './boardActions'
import type { RunStatusDTO } from './boardTypes'
import { RunStatusPanel } from './RunStatusPanel'
import { Stepper } from './Stepper'
import './ops.css'

type Filter = ContentFilter

type Props = {
  content: ContentPage
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

/**
 * The primary content screen: every piece, where it is, and who it is waiting
 * on. One row per piece, a stepper instead of ten status columns, and the
 * first tab is the work that needs a person — because that is what someone
 * opening this page is here to find.
 */
export function ContentList({ content, latestRun, mode }: Props) {
  const router = useRouter()
  const { articles, counts, filter, q, page, totalDocs, totalPages } = content
  const [query, setQuery] = useState(q)
  const [requestedFilter, setRequestedFilter] = useState(filter)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [navigating, startNavigation] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateKey = `${filter}:${q}:${page}`
  // Responses commit separately from typing. A response to our own search must
  // not replace a draft the editor has continued typing in the meantime.
  const [requestedQueries, setRequestedQueries] = useState<string[]>([])
  const [committed, setCommitted] = useState({ key: stateKey, external: false })
  if (committed.key !== stateKey) {
    const requestIndex = requestedQueries.indexOf(q)
    const external = requestIndex < 0
    setCommitted({ key: stateKey, external })
    if (external) {
      setQuery(q)
      setRequestedFilter(filter)
    }
    setRequestedQueries(external ? [] : requestedQueries.slice(requestIndex + 1))
    setPicked(new Set())
  }
  useEffect(() => {
    if (committed.external && timer.current) clearTimeout(timer.current)
  }, [committed])
  useEffect(() => {
    const onHistory = () => {
      if (timer.current) clearTimeout(timer.current)
      const restored = new URLSearchParams(window.location.search)
      const restoredQuery = restored.get('q') ?? ''
      const restoredFilter = restored.get('filter')
      setRequestedFilter(
        restoredFilter === 'you' ||
          restoredFilter === 'working' ||
          restoredFilter === 'done' ||
          restoredFilter === 'all'
          ? restoredFilter
          : counts.you > 0
            ? 'you'
            : 'all',
      )
      setQuery(restoredQuery)
      setRequestedQueries([restoredQuery.trim()])
      setPicked(new Set())
    }
    window.addEventListener('popstate', onHistory)
    return () => window.removeEventListener('popstate', onHistory)
  }, [counts.you])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const navigate = (nextFilter: Filter, nextQuery: string, nextPage: number) => {
    if (timer.current) clearTimeout(timer.current)
    setPicked(new Set())
    setRequestedFilter(nextFilter)
    setRequestedQueries((queries) => [...queries, nextQuery.trim()])
    const params = new URLSearchParams({
      filter: nextFilter,
      q: nextQuery.trim(),
      page: String(nextPage),
    })
    startNavigation(() => router.push(`/admin/ops/content?${params}`, { scroll: false }))
  }
  const search = (value: string) => {
    setQuery(value)
    setPicked(new Set())
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => navigate(requestedFilter, value, 1), 300)
  }
  const visible = articles

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
    <div className="datum-ops" aria-busy={navigating}>
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
              aria-selected={requestedFilter === f}
              className={requestedFilter === f ? 'is-active' : undefined}
              key={f}
              onClick={() => navigate(f, query, 1)}
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
          onChange={(e) => search(e.target.value)}
          placeholder="Search by title or keyword"
          type="search"
          value={query}
        />
      </div>

      <p role="status" aria-live="polite">
        {navigating
          ? 'Loading content…'
          : `${totalDocs} matching pieces · Page ${page} of ${totalPages}`}
      </p>
      {removable.length > 0 ? (
        <div className="datum-content__bulk">
          <span>
            {removable.length} topic{removable.length === 1 ? '' : 's'} selected
          </span>
          <button
            className="datum-ops__btn datum-ops__btn--danger"
            disabled={pending || navigating}
            onClick={remove}
            type="button"
          >
            Remove from content
          </button>
          <span className="datum-ops__hint">
            Only topics research has not started can be removed.
          </span>
        </div>
      ) : null}
      {message ? (
        <p className={message.ok ? 'datum-ops__ok' : 'datum-ops__error'} role="status">
          {message.text}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="datum-content__empty">
          {counts.all === 0 ? (
            <>
              <h2>Nothing here yet</h2>
              <p>
                Start with <Link href="/admin/ops/new">New content</Link>: pick the kind of piece,
                pick a topic, and Datum researches it while you wait.
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
                    disabled={pending || navigating}
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
      <nav aria-label="Content pages" className="datum-ops__actions">
        <button
          className="datum-ops__btn"
          type="button"
          disabled={navigating || page <= 1}
          onClick={() => navigate(filter, query, page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          className="datum-ops__btn"
          type="button"
          disabled={navigating || page >= totalPages}
          onClick={() => navigate(filter, query, page + 1)}
        >
          Next
        </button>
      </nav>
      {mode === 'live' ? (
        <p className="datum-ops__hint" style={{ marginTop: 16 }}>
          Live mode: writing, checks and scoring call paid providers. Approving a brief is what
          starts that.
        </p>
      ) : null}
    </div>
  )
}
