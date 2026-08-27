'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState, useTransition } from 'react'

import {
  createTopicsAction,
  discoverTopicsAction,
  recentSearchesAction,
} from './topicDiscoveryActions'
import type { RecentSearch, TopicCandidate } from './topicDiscoveryTypes'
import './ops.css'

type Props = {
  templates: Array<{ id: number; name: string }>
  /** Live mode spends real money per article, so the copy has to say so. */
  mode: 'mock' | 'live'
  /** Chosen on the New content screen; when set, the picker below is hidden. */
  templateId?: number
}

/** Rough guide next to a keyword difficulty score, so a number means something. */
function difficultyLabel(kd: number): string {
  if (kd < 15) return 'easy'
  if (kd < 35) return 'moderate'
  if (kd < 60) return 'hard'
  return 'very hard'
}

const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n)

export function TopicDiscovery({ templates, mode, templateId: fixedTemplateId }: Props) {
  const router = useRouter()
  const [seed, setSeed] = useState('')
  const [pickedTemplateId, setTemplateId] = useState(templates[0]?.id ?? 0)
  const templateId = fixedTemplateId ?? pickedTemplateId
  const [candidates, setCandidates] = useState<TopicCandidate[] | null>(null)
  const [searchedFor, setSearchedFor] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentSearch[]>([])
  const [pending, startTransition] = useTransition()

  // Previous subjects survive leaving the screen, so coming back does not mean
  // retyping — and re-opening one is served from cache, costing no API units.
  useEffect(() => {
    let live = true
    void recentSearchesAction().then((rows) => {
      if (live) setRecent(rows)
    })
    return () => {
      live = false
    }
  }, [candidates])

  const toggle = (keyword: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  const runSearch = (term: string, refresh = false) => {
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await discoverTopicsAction(term, { refresh })
      if (!result.ok) {
        setError(result.error)
        setCandidates(null)
        return
      }
      setCandidates(result.candidates)
      setSearchedFor(result.seed)
      setSeed(result.seed)
      setCached(result.cached)
      setFetchedAt(result.fetchedAt)
      setPicked(new Set())
    })
  }

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    runSearch(seed)
  }

  const create = () => {
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await createTopicsAction({ keywords: [...picked], templateId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(
        result.researchQueued
          ? `Created "${result.primary}". Researching it now — opening the piece.`
          : `Created "${result.primary}". Research will start once the workspace is ready.`,
      )
      setPicked(new Set())
      // The piece is where everything happens next; go there rather than
      // leaving the editor to find it in a list.
      router.push(`/admin/ops/articles/${result.articleId}`)
    })
  }

  const selectable = candidates?.filter((c) => !c.alreadyTaken) ?? []

  return (
    <section className="datum-ops__panel">
      <h2>Find topics to write about</h2>
      <div className="datum-ops__panel-body">
        <p className="datum-ops__sub">
          Type a subject you want to cover. We ask Ahrefs what people actually search for around
          it, then you pick the ones worth writing. Tick several related searches and they become a
          single article covering all of them. Nothing is written or paid for here — picking a topic
          just puts it on the board.
        </p>

        <form className="datum-ops__period" onSubmit={search}>
          <label className="datum-ops__field" style={{ flex: '1 1 320px', marginBottom: 0 }}>
            <label htmlFor="topic-seed">Subject</label>
            <input
              disabled={pending}
              id="topic-seed"
              onChange={(e) => setSeed(e.target.value)}
              placeholder="e.g. project management software"
              type="text"
              value={seed}
            />
          </label>
          <button className="datum-ops__btn datum-ops__btn--primary" disabled={pending} type="submit">
            {pending && !candidates ? 'Searching…' : 'Find topics'}
          </button>
        </form>

        {recent.length > 0 && !candidates ? (
          <p className="datum-ops__hint">
            Recent searches:{' '}
            {recent.map((r, i) => (
              <React.Fragment key={r.seed}>
                {i > 0 ? ' · ' : ''}
                <button
                  className="datum-ops__link-btn"
                  disabled={pending}
                  onClick={() => runSearch(r.seed)}
                  type="button"
                >
                  {r.seed}
                </button>
              </React.Fragment>
            ))}
          </p>
        ) : null}

        {error ? <p className="datum-ops__error">{error}</p> : null}
        {done ? <p className="datum-ops__ok">{done}</p> : null}

        {candidates ? (
          <>
            <p className="datum-ops__sub" style={{ marginTop: 16 }}>
              {candidates.length} result{candidates.length === 1 ? '' : 's'} for &ldquo;
              {searchedFor}&rdquo;. <strong>Searches</strong> is how many people look for it each
              month; <strong>difficulty</strong> is how hard it is to rank, so low numbers with
              decent volume are the best place to start.
            </p>

            <p className="datum-ops__hint">
              {cached ? 'Saved from ' : 'Fetched '}
              {fetchedAt ? new Date(fetchedAt).toLocaleString() : 'just now'}
              {cached ? ' — reused so it costs no Ahrefs credits.' : '.'}{' '}
              <button
                className="datum-ops__link-btn"
                disabled={pending}
                onClick={() => runSearch(searchedFor, true)}
                type="button"
              >
                Refresh from Ahrefs
              </button>
            </p>

            <div className="datum-ops__ig-table-wrap">
              <table className="datum-ops__ig-table">
                <thead>
                  <tr>
                    <th scope="col">Pick</th>
                    <th scope="col">Topic</th>
                    <th scope="col">Searches / mo</th>
                    <th scope="col">Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.keyword}>
                      <td>
                        <input
                          aria-label={`Select ${c.keyword}`}
                          checked={picked.has(c.keyword)}
                          disabled={pending || c.alreadyTaken}
                          onChange={() => toggle(c.keyword)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        {c.keyword}
                        {c.alreadyTaken ? (
                          <span className="datum-ops__pill datum-ops__pill--muted datum-ops__pill--tight">
                            {' '}
                            {c.archived ? 'removed from the board' : 'already on the board'}
                          </span>
                        ) : null}
                      </td>
                      <td>{compact(c.volume)}</td>
                      <td>
                        {c.difficulty} <span className="datum-ops__hint">{difficultyLabel(c.difficulty)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectable.length === 0 ? (
              <p className="datum-ops__hint">
                Every topic here already has an article. Try a different subject.
              </p>
            ) : (
              <>
                <div className="datum-ops__period" style={{ marginTop: 16 }}>
                  <label className="datum-ops__field" style={{ marginBottom: 0 }} hidden={fixedTemplateId != null}>
                    <label htmlFor="topic-template">Write these as</label>
                    <select
                      disabled={pending}
                      id="topic-template"
                      onChange={(e) => setTemplateId(Number(e.target.value))}
                      value={templateId}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="datum-ops__btn datum-ops__btn--primary"
                    disabled={pending || picked.size === 0}
                    onClick={create}
                    type="button"
                  >
                    {pending
                      ? 'Creating…'
                      : picked.size > 1
                        ? `Create 1 piece covering ${picked.size} searches`
                        : 'Create piece'}
                  </button>
                </div>
                {picked.size > 1 ? (
                  <p className="datum-ops__hint">
                    These {picked.size} searches become <strong>one article</strong>, not{' '}
                    {picked.size} — it targets{' '}
                    <strong>
                      {candidates?.find((c) => picked.has(c.keyword) && !c.alreadyTaken)?.keyword}
                    </strong>{' '}
                    and is written and scored to cover the rest as well. Splitting them would
                    produce thin pages competing with each other for the same intent.
                  </p>
                ) : null}
                <p className="datum-ops__hint">
                  The template decides the shape of the article — a how-to, a comparison, or a
                  ranked list — and QA checks the draft against it, so pick the one that matches
                  how you would answer the topic. You can change it per article on the board later.
                </p>
              </>
            )}
          </>
        ) : null}

        <details className="datum-ops__prose" style={{ marginTop: 20 }}>
          <summary>What happens after I add a topic?</summary>
          <ol>
            <li>
              <strong>You add topics here.</strong> Everything you tick in one search becomes a
              single article covering that group, sitting in <em>Topic selected</em> on the board.
              Nothing has been written or spent yet.
            </li>
            <li>
              <strong>Datum researches it</strong> and writes you a brief. Under Content, tick the topics you want and
              press Start. Datum researches what already ranks, writes a draft in your brand voice,
              and checks it. You choose which topics run and when.
            </li>
            <li>
              <strong>Three checks must pass</strong> — structure, facts (verified against live web
              search), and style. Anything that fails lands in <em>Needs revision</em> with the
              reason, and you can send it back to be rewritten against that feedback.
            </li>
            <li>
              <strong>Then it is scored for information gain</strong>: does it say anything the
              pages already ranking do not? A draft resting on sources nobody has rated gets
              blocked, and those sources show up in <em>Source review</em> for you to rate.
            </li>
          </ol>
          <p>
            {mode === 'live'
              ? 'This workspace is in live mode: every run calls paid APIs, so add topics deliberately.'
              : 'This workspace is in mock mode: runs use canned fixtures and cost nothing.'}
          </p>
        </details>
      </div>
    </section>
  )
}
