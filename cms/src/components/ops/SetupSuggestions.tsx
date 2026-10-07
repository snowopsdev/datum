'use client'
import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  acceptSuggestionAction,
  dismissSuggestionAction,
  scanSuggestionsAction,
} from './suggestionActions'
import type { SetupSuggestionDTO } from './suggestionTypes'
export function suggestionLabel(row: SetupSuggestionDTO): string {
  const p = row.proposal
  if (row.kind === 'banned_word') return `Ban “${p.phrase}”?`
  if (row.kind === 'not_trait') return `Sharpen the “${p.trait}” boundary`
  if (row.kind === 'rejected_ref') return `${p.ref} keeps coming back: give it a replacement line`
  return 'Writers keep claiming this; back it or reject it'
}
function SuggestionRow({ row }: { row: SetupSuggestionDTO }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const act = (dismiss = false, evidenceAs: 'verified' | 'rejected' = 'verified') =>
    startTransition(async () => {
      const result = dismiss
        ? await dismissSuggestionAction(row.id, reason)
        : await acceptSuggestionAction(row.id, { evidenceAs, reason })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.editorHref) router.push(result.editorHref)
      else router.refresh()
    })
  return (
    <li>
      <strong>{suggestionLabel(row)}</strong>{' '}
      <span className="datum-ops__pill">{row.count} articles</span>
      {row.kind === 'unbacked_claim' ? <p>{String(row.proposal.claim ?? '')}</p> : null}
      <ul>
        {row.occurrences.slice(0, 3).map((o) => (
          <li key={o.articleId}>
            <Link href={`/admin/ops/articles/${o.articleId}`}>Article {o.articleId}</Link>:{' '}
            {o.excerpt}
          </li>
        ))}
      </ul>
      <label className="datum-ops__field">
        <span>Decision note (required to reject a claim)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} />
      </label>
      <div className="datum-ops__actions">
        <button type="button" className="datum-ops__btn" disabled={pending} onClick={() => act()}>
          {row.kind === 'unbacked_claim'
            ? 'Add as unverified claim'
            : row.kind === 'not_trait' || row.kind === 'rejected_ref'
              ? 'Open editor'
              : 'Accept'}
        </button>
        {row.kind === 'unbacked_claim' ? (
          <button
            type="button"
            className="datum-ops__btn"
            disabled={pending}
            onClick={() => act(false, 'rejected')}
          >
            Reject claim
          </button>
        ) : null}
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending}
          onClick={() => act(true)}
        >
          Dismiss
        </button>
      </div>
      {error ? (
        <p className="datum-ops__error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  )
}
export function SetupSuggestions({
  suggestions = [],
  recommendations = [],
}: {
  suggestions?: SetupSuggestionDTO[]
  recommendations?: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <section className="datum-ops__block">
      <h3>
        Suggestions{' '}
        {suggestions.length ? <span className="datum-ops__pill">{suggestions.length}</span> : null}
      </h3>
      {recommendations.length ? (
        <ul>
          {recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      {suggestions.length ? (
        <ul>
          {suggestions.map((row) => (
            <SuggestionRow key={row.id} row={row} />
          ))}
        </ul>
      ) : (
        <p className="datum-ops__hint">No recurring corrections need a setup change.</p>
      )}
      <button
        type="button"
        className="datum-ops__btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await scanSuggestionsAction()
            if (!result.ok) setError(result.error)
            else router.refresh()
          })
        }
      >
        {pending ? 'Scanning…' : 'Scan now'}
      </button>
      {error ? (
        <p className="datum-ops__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
export function SuggestionEditorContext({
  suggestion,
}: {
  suggestion?: SetupSuggestionDTO | null
}) {
  if (!suggestion) return null
  return (
    <aside className="datum-ops__block">
      <h3>{suggestionLabel(suggestion)}</h3>
      <p>
        Write the boundary or replacement in the editor below. Saving a change that satisfies this
        suggestion records your acceptance.
      </p>
      <ul>
        {suggestion.occurrences.slice(0, 3).map((o) => (
          <li key={o.articleId}>
            <Link href={`/admin/ops/articles/${o.articleId}`}>Article {o.articleId}</Link>:{' '}
            {o.excerpt}
          </li>
        ))}
      </ul>
    </aside>
  )
}
