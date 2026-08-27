'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState, useTransition } from 'react'

import { SOURCE_QUALITY_CLASSES, type SourceQualityClass } from '../../lib/informationGain'
import {
  approveCandidateAction,
  dismissCandidateAction,
  reopenCandidateAction,
} from './sourceReviewActions'
import { queueBucket, type CandidateDTO } from './sourceReviewTypes'
import './ops.css'

/**
 * Plain-language labels for the six classes.
 *
 * The three marked strong are the only ones that clear a novel-claim integrity
 * floor; everything else sits at or below the cap an unrated domain already
 * gets, so choosing them records a judgement without changing any outcome.
 */
const CLASS_LABELS: Record<SourceQualityClass, string> = {
  primary: 'Primary — the original study, dataset, standard or filing',
  official_docs: "Official docs — the maker's or authority's own documentation",
  first_party_dataset: 'Our own data — a dataset or test we ran ourselves',
  secondary: "Secondary — reporting or analysis of someone else's work",
  unverified: "Unverified — can't vouch for it",
  blocked: 'Blocked — never count this domain as evidence',
}

type Tab = 'review' | 'rated' | 'dismissed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'review', label: 'To review' },
  { key: 'rated', label: 'Rated' },
  { key: 'dismissed', label: 'Dismissed' },
]

function Badges({ candidate }: { candidate: CandidateDTO }) {
  const facts: string[] = []
  if (candidate.citationCount > 0) {
    const articles = candidate.citedBy.length
    facts.push(
      `Cited ${candidate.citationCount} time${candidate.citationCount === 1 ? '' : 's'}` +
        (articles > 0 ? ` in ${articles} article${articles === 1 ? '' : 's'}` : ''),
    )
  }
  for (const badge of candidate.serpBadges) {
    facts.push(`Ranks #${badge.position} for "${badge.keyword}"`)
  }
  if (candidate.hiddenSerpBadges > 0) facts.push(`+${candidate.hiddenSerpBadges} more keywords`)
  if (facts.length === 0) facts.push('Seen once, with no detail recorded')
  return (
    <div className="datum-ops__pills">
      {facts.map((fact) => (
        <span className="datum-ops__pill datum-ops__pill--muted" key={fact}>
          {fact}
        </span>
      ))}
    </div>
  )
}

function CandidateCard({ candidate }: { candidate: CandidateDTO }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [qualityClass, setQualityClass] = useState<string>(candidate.suggestedClass)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const classFieldId = `class-${candidate.id}`
  const noteFieldId = `note-${candidate.id}`

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) router.refresh()
      else setError(result.error)
    })
  }

  const bucket = queueBucket(candidate)

  return (
    <article className="datum-ops__entry-card">
      <div className="datum-ops__entry-card-head">
        <h3>
          {candidate.domain}
          {candidate.domainRating !== null ? (
            <>
              {' '}
              <span
                className="datum-ops__pill datum-ops__pill--muted datum-ops__pill--tight"
                title="Ahrefs domain rating: how many sites link to this one. Popularity, not accuracy."
              >
                DR {candidate.domainRating}
              </span>
            </>
          ) : null}
        </h3>
        <p>Last seen {candidate.lastSeenLabel}</p>
      </div>

      <Badges candidate={candidate} />

      {candidate.citedBy.length > 0 ? (
        <ul className="datum-ops__list">
          {candidate.citedBy.map((citation) => (
            <li key={citation.articleId}>
              <Link href={citation.href} prefetch={false}>
                {citation.label}
              </Link>
              {citation.status ? ` — ${citation.status.replace(/_/g, ' ')}` : null}
            </li>
          ))}
        </ul>
      ) : null}

      {candidate.coveredBy ? (
        <p className="datum-ops__hint">
          Rated {candidate.coveredBy.qualityClass.replace(/_/g, ' ')}
          {candidate.coveredBy.domain !== candidate.domain
            ? ` by the rule for ${candidate.coveredBy.domain}`
            : null}
          {candidate.resolvedBy ? ` · ${candidate.resolvedBy}` : ' · added directly'}
          {candidate.coveredBy.href ? (
            <>
              {' · '}
              <Link href={candidate.coveredBy.href} prefetch={false}>
                Open the rule
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {bucket === 'review' ? (
        <>
          <div className="datum-ops__field">
            <label htmlFor={classFieldId}>How much should we trust it?</label>
            <select
              disabled={pending}
              id={classFieldId}
              onChange={(e) => setQualityClass(e.target.value)}
              value={qualityClass}
            >
              {SOURCE_QUALITY_CLASSES.map((value) => (
                <option key={value} value={value}>
                  {CLASS_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="datum-ops__hint">
              Only Primary, Official docs and Our own data are strong enough to back a claim
              nobody else is making. The rest record what you think without changing any result.
            </p>
          </div>
          <div className="datum-ops__field">
            <label htmlFor={noteFieldId}>Why (optional)</label>
            <textarea
              disabled={pending}
              id={noteFieldId}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What makes this domain worth this rating?"
              rows={2}
              value={note}
            />
          </div>
          <div className="datum-ops__actions">
            <button
              className="datum-ops__btn datum-ops__btn--primary"
              disabled={pending}
              onClick={() =>
                run(() =>
                  approveCandidateAction({ candidateId: candidate.id, qualityClass, note }),
                )
              }
              type="button"
            >
              {pending ? 'Saving…' : 'Rate this domain'}
            </button>
            <button
              className="datum-ops__link-btn"
              disabled={pending}
              onClick={() => run(() => dismissCandidateAction(candidate.id))}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </>
      ) : null}

      {bucket === 'dismissed' ? (
        <div className="datum-ops__actions">
          <button
            className="datum-ops__link-btn"
            disabled={pending}
            onClick={() => run(() => reopenCandidateAction(candidate.id))}
            type="button"
          >
            Put back in the queue
          </button>
        </div>
      ) : null}

      {error ? <p className="datum-ops__error">{error}</p> : null}
    </article>
  )
}

export function SourceReviewQueue({ candidates }: { candidates: CandidateDTO[] }) {
  const [tab, setTab] = useState<Tab>('review')

  const buckets = useMemo(() => {
    const grouped: Record<Tab, CandidateDTO[]> = { review: [], rated: [], dismissed: [] }
    for (const candidate of candidates) grouped[queueBucket(candidate)].push(candidate)
    return grouped
  }, [candidates])

  const shown = buckets[tab]

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Source review</h1>
        <span className="datum-ops__pill">governance</span>
      </div>
      <p className="datum-ops__lede">
        Domains the pipeline ran into that nobody has rated yet. Until a domain is rated, evidence
        from it can&rsquo;t back a claim nobody else is making, so an article resting on one gets
        blocked. Rate the ones you trust and dismiss the rest.
      </p>

      <div className="datum-ops__period">
        <span className="datum-ops__sub" style={{ margin: 0 }}>
          Status
        </span>
        <div className="datum-ops__switcher">
          {TABS.map((entry) => (
            <button
              className={tab === entry.key ? 'is-active' : undefined}
              key={entry.key}
              onClick={() => setTab(entry.key)}
              type="button"
            >
              {entry.label} ({buckets[entry.key].length})
            </button>
          ))}
        </div>
      </div>

      <p className="datum-ops__hint">
        Ratings apply to articles scored from now on. One that is already blocked or waiting for
        review keeps its result until it is scored again — open it from the{' '}
        <Link href="/admin/ops/content" prefetch={false}>
          content list
        </Link>{' '}
        and use Reset to drafted to re-check the same draft, or Send back and then Regenerate to
        rewrite it first.
      </p>

      {shown.length === 0 ? (
        <p className="datum-ops__empty" style={{ marginTop: 20 }}>
          {tab === 'review'
            ? 'Nothing waiting. Every domain the pipeline has cited or seen ranking is either rated or dismissed.'
            : tab === 'rated'
              ? 'No domains rated yet.'
              : 'Nothing dismissed.'}
        </p>
      ) : (
        <div className="datum-ops__entry-cards" style={{ marginTop: 20 }}>
          {shown.map((candidate) => (
            <CandidateCard candidate={candidate} key={candidate.id} />
          ))}
        </div>
      )}
    </div>
  )
}
