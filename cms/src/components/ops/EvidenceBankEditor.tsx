'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  CLEARED_SURFACES,
  type ClearedSurface,
  type VerificationDepth,
  VERIFICATION_DEPTHS,
} from '../../lib/tenant/evidenceBank'
import { assistAction } from './setupActions'
import { Field, RowsEditor } from './setupFields'
import { type EvidenceBankDraft, emptyEvidenceBankDraft } from './setupTypes'
import { saveEvidenceBankAction } from './tenantActions'
import './ops.css'

type Tab = 'verifiedClaims' | 'facts' | 'rejectedClaims'

const TABS: [Tab, string][] = [
  ['verifiedClaims', 'Verified claims'],
  ['facts', 'Facts'],
  ['rejectedClaims', 'Rejected & expired'],
]

const DEPTH_LABEL: Record<VerificationDepth, string> = {
  primary_document: 'Primary document',
  reproduced: 'Reproduced',
  third_party_audit: 'Third-party audit',
  self_reported: 'Self-reported',
}

const SURFACE_LABEL: Record<ClearedSurface, string> = {
  web: 'Web',
  blog: 'Blog',
  ads: 'Ads',
  sales: 'Sales',
  social: 'Social',
  pr: 'PR',
}

/**
 * The evidence bank: the only first-party facts a draft may state.
 *
 * Tabs rather than a stepper, because these three lists are not stages of one
 * answer — an operator comes here to add a claim, or to re-check the expired
 * ones, and either is a whole visit. The assistant is offered on two of the
 * three: it can read the site back to you as facts, and it can turn your notes
 * into candidate claims, but nobody may ask a model to decide that a claim was
 * rejected.
 *
 * Refs are not shown as editable. The global's hook mints them and never
 * reuses one, because a published article citing `[E4]` must keep meaning the
 * same claim.
 */
export function EvidenceBankEditor({
  initial,
  today,
}: {
  initial: EvidenceBankDraft
  today: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(initial)
  const [tab, setTab] = useState<Tab>('verifiedClaims')
  const [needsRecheckOnly, setNeedsRecheckOnly] = useState(false)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [mock, setMock] = useState(false)
  const [pending, startTransition] = useTransition()

  const expiredCount = draft.verifiedClaims.filter(
    (row) => row.recheckAt && row.recheckAt.slice(0, 10) < today,
  ).length
  const unsaved =
    draft.verifiedClaims.filter((row) => !row.ref).length +
    draft.facts.filter((row) => !row.ref).length +
    draft.rejectedClaims.filter((row) => !row.ref).length

  const save = () =>
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const result = await saveEvidenceBankAction(draft)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Adopt the saved document rather than keeping the typed copy: the rows
      // now have refs, and a row the action dropped for having no text should
      // disappear here too.
      setDraft(emptyEvidenceBankDraft(result.saved))
      setMessage('Saved. New rows have been given refs a draft can cite.')
      router.refresh()
    })

  const assist = (section: 'facts' | 'verifiedClaims') =>
    startTransition(async () => {
      setError(null)
      setMessage(null)
      setWarnings([])
      const result = await assistAction({
        asset: 'evidence',
        section,
        mode: 'draft',
        notes,
        current: null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const value = (result.value ?? {}) as Record<string, unknown>
      const proposed = Array.isArray(value[section]) ? (value[section] as unknown[]) : []
      if (proposed.length === 0) {
        setError('The assistant proposed nothing for this tab.')
        return
      }
      setMock(result.mock)
      setWarnings(result.warnings)
      if (section === 'facts') {
        setDraft((prev) => ({
          ...prev,
          facts: [
            ...prev.facts,
            ...proposed.map((row) => {
              const r = (row ?? {}) as Record<string, unknown>
              return {
                fact: typeof r.fact === 'string' ? r.fact : '',
                source: typeof r.source === 'string' ? r.source : '',
                owner: typeof r.owner === 'string' ? r.owner : '',
                lastConfirmedAt: '',
              }
            }),
          ],
        }))
      } else {
        setDraft((prev) => ({
          ...prev,
          verifiedClaims: [
            ...prev.verifiedClaims,
            ...proposed.map((row) => {
              const r = (row ?? {}) as Record<string, unknown>
              return {
                claim: typeof r.claim === 'string' ? r.claim : '',
                primarySource: typeof r.primarySource === 'string' ? r.primarySource : '',
                sourceUrl: typeof r.sourceUrl === 'string' ? r.sourceUrl : '',
                sourceDate: '',
                sampleOrMethod: typeof r.sampleOrMethod === 'string' ? r.sampleOrMethod : '',
                // Never anything stronger: a model reading your own site back
                // to you has checked nothing. A person raises this after they
                // put a source next to it.
                verificationDepth: 'self_reported' as const,
                limits: typeof r.limits === 'string' ? r.limits : '',
                clearedSurfaces: [] as ClearedSurface[],
                recheckAt: '',
              }
            }),
          ],
        }))
      }
      setMessage(
        'Proposed rows added below, unsaved. Put a source next to each one before you save it.',
      )
    })

  const visibleClaims = needsRecheckOnly
    ? draft.verifiedClaims.filter((row) => row.recheckAt && row.recheckAt.slice(0, 10) < today)
    : draft.verifiedClaims

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Evidence bank</h1>
        <span className="datum-ops__pill">setup</span>
        <Link className="datum-ops__link-btn" href="/admin/ops/setup" prefetch={false}>
          ← Setup
        </Link>
      </div>
      <p className="datum-ops__lede">
        Everything this company may say about itself. A draft may state a first-party fact only if
        it is in here, and must cite the row’s ref. Proof travels with the claim: a row with no
        source and no limits is an assertion.
      </p>

      <div className="datum-ops__tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'is-active' : undefined}
            onClick={() => setTab(id)}
          >
            {label} ({draft[id].length})
          </button>
        ))}
      </div>

      <div className="datum-ops__tab-panel datum-ops__tab-panel--wide">
        {error ? <p className="datum-ops__error">{error}</p> : null}
        {message ? <p className="datum-ops__ok">{message}</p> : null}
        {warnings.length > 0 ? (
          <ul className="datum-ops__list">
            {warnings.map((warning) => (
              <li className="datum-ops__warn" key={warning}>
                {warning}
              </li>
            ))}
          </ul>
        ) : null}

        {tab === 'verifiedClaims' ? (
          <>
            <div className="datum-ops__actions">
              <label className="datum-ops__hint" htmlFor="eb-recheck">
                <input
                  id="eb-recheck"
                  type="checkbox"
                  checked={needsRecheckOnly}
                  onChange={(e) => setNeedsRecheckOnly(e.target.checked)}
                  disabled={pending}
                />{' '}
                Needs re-check only
              </label>
              <span className="datum-ops__hint">
                {expiredCount > 0
                  ? `${expiredCount} claim${expiredCount === 1 ? '' : 's'} past its re-check date — the writer is told never to state ${expiredCount === 1 ? 'it' : 'them'}.`
                  : 'Nothing has expired.'}
              </span>
            </div>
            <RowsEditor<EvidenceBankDraft['verifiedClaims'][number]>
              id="eb-claims"
              rows={visibleClaims}
              onChange={(rows) =>
                setDraft((prev) => ({
                  ...prev,
                  // When the filter is on, the hidden rows are untouched: the
                  // filtered list is spliced back over the ones it came from.
                  verifiedClaims: needsRecheckOnly
                    ? [
                        ...prev.verifiedClaims.filter(
                          (row) => !(row.recheckAt && row.recheckAt.slice(0, 10) < today),
                        ),
                        ...rows,
                      ]
                    : rows,
                }))
              }
              empty={() => ({
                claim: '',
                primarySource: '',
                sourceUrl: '',
                sourceDate: '',
                sampleOrMethod: '',
                verificationDepth: '' as const,
                limits: '',
                clearedSurfaces: [],
                recheckAt: '',
              })}
              addLabel="Add a claim"
              disabled={pending}
              emptyText="No claims here. A draft may state no first-party fact until there is one."
              renderRow={({ row, rowId, patch }) => (
                <>
                  <p className="datum-ops__hint">
                    {row.ref ? `Cited as [${row.ref}]` : 'New — a ref is assigned when you save'}
                    {row.recheckAt && row.recheckAt.slice(0, 10) < today ? ' · expired' : ''}
                  </p>
                  <Field
                    id={`${rowId}-claim`}
                    label="Claim"
                    value={row.claim}
                    onChange={(claim) => patch({ claim })}
                    disabled={pending}
                    multiline
                  />
                  <Field
                    id={`${rowId}-primarySource`}
                    label="Primary source"
                    value={row.primarySource}
                    onChange={(primarySource) => patch({ primarySource })}
                    disabled={pending}
                    placeholder="Our 2026 customer survey (n=412)"
                  />
                  <Field
                    id={`${rowId}-sourceUrl`}
                    label="Source URL"
                    value={row.sourceUrl}
                    onChange={(sourceUrl) => patch({ sourceUrl })}
                    disabled={pending}
                  />
                  <Field
                    id={`${rowId}-sourceDate`}
                    label="Source date"
                    value={row.sourceDate ? row.sourceDate.slice(0, 10) : ''}
                    onChange={(sourceDate) => patch({ sourceDate })}
                    disabled={pending}
                    type="date"
                  />
                  <Field
                    id={`${rowId}-sampleOrMethod`}
                    label="Sample or method"
                    value={row.sampleOrMethod}
                    onChange={(sampleOrMethod) => patch({ sampleOrMethod })}
                    disabled={pending}
                    multiline
                    placeholder="How it was measured, and over what."
                  />
                  <div className="datum-ops__field">
                    <label htmlFor={`${rowId}-depth`}>Verification depth</label>
                    <select
                      id={`${rowId}-depth`}
                      value={row.verificationDepth}
                      onChange={(e) =>
                        patch({ verificationDepth: e.target.value as VerificationDepth | '' })
                      }
                      disabled={pending}
                    >
                      <option value="">Not set</option>
                      {VERIFICATION_DEPTHS.map((depth) => (
                        <option key={depth} value={depth}>
                          {DEPTH_LABEL[depth]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    id={`${rowId}-limits`}
                    label="Limits — what this claim does NOT say"
                    value={row.limits}
                    onChange={(limits) => patch({ limits })}
                    disabled={pending}
                    multiline
                    hint="QA fails a draft that stretches the claim past this."
                  />
                  <div className="datum-ops__field">
                    <label htmlFor={`${rowId}-surfaces`}>Cleared surfaces</label>
                    <div className="datum-ops__checks" id={`${rowId}-surfaces`}>
                      {CLEARED_SURFACES.map((surface) => (
                        <label className="datum-ops__hint" key={surface}>
                          <input
                            type="checkbox"
                            checked={row.clearedSurfaces.includes(surface)}
                            onChange={(e) =>
                              patch({
                                clearedSurfaces: e.target.checked
                                  ? CLEARED_SURFACES.filter(
                                      (s) => s === surface || row.clearedSurfaces.includes(s),
                                    )
                                  : row.clearedSurfaces.filter((s) => s !== surface),
                              })
                            }
                            disabled={pending}
                          />{' '}
                          {SURFACE_LABEL[surface]}
                        </label>
                      ))}
                    </div>
                    <p className="datum-ops__hint">Leave all unchecked when it is cleared everywhere.</p>
                  </div>
                  <Field
                    id={`${rowId}-recheckAt`}
                    label="Re-check by"
                    value={row.recheckAt ? row.recheckAt.slice(0, 10) : ''}
                    onChange={(recheckAt) => patch({ recheckAt })}
                    disabled={pending}
                    type="date"
                    hint="After this date the claim is expired and moves into the writer’s never-state list."
                  />
                </>
              )}
            />
            <AssistPanel
              title="Propose claims from notes"
              blurb="Turns what you paste into candidate claims. They arrive self-reported with no source, which is exactly what the completeness check flags — a person puts the proof beside them."
              notes={notes}
              onNotes={setNotes}
              onRun={() => assist('verifiedClaims')}
              disabled={pending}
              mock={mock}
            />
          </>
        ) : null}

        {tab === 'facts' ? (
          <>
            <RowsEditor<EvidenceBankDraft['facts'][number]>
              id="eb-facts"
              rows={draft.facts}
              onChange={(facts) => setDraft((prev) => ({ ...prev, facts }))}
              empty={() => ({ fact: '', source: '', owner: '', lastConfirmedAt: '' })}
              addLabel="Add a fact"
              disabled={pending}
              emptyText="No facts yet. Dates, names, places — the things that need no hedging."
              renderRow={({ row, rowId, patch }) => (
                <>
                  <p className="datum-ops__hint">
                    {row.ref ? `Cited as [${row.ref}]` : 'New — a ref is assigned when you save'}
                  </p>
                  <Field
                    id={`${rowId}-fact`}
                    label="Fact"
                    value={row.fact}
                    onChange={(fact) => patch({ fact })}
                    disabled={pending}
                    multiline
                  />
                  <Field
                    id={`${rowId}-source`}
                    label="Source"
                    value={row.source}
                    onChange={(source) => patch({ source })}
                    disabled={pending}
                  />
                  <Field
                    id={`${rowId}-owner`}
                    label="Who owns it"
                    value={row.owner}
                    onChange={(owner) => patch({ owner })}
                    disabled={pending}
                    placeholder="Whoever answers when it turns out to be wrong."
                  />
                  <Field
                    id={`${rowId}-lastConfirmedAt`}
                    label="Last confirmed"
                    value={row.lastConfirmedAt ? row.lastConfirmedAt.slice(0, 10) : ''}
                    onChange={(lastConfirmedAt) => patch({ lastConfirmedAt })}
                    disabled={pending}
                    type="date"
                  />
                </>
              )}
            />
            <AssistPanel
              title="Draft facts from the site"
              blurb="Reads the pages fetched on the Workspace page and lists what they state as fact. Nothing is saved; check each one against something you trust."
              notes={notes}
              onNotes={setNotes}
              onRun={() => assist('facts')}
              disabled={pending}
              mock={mock}
            />
          </>
        ) : null}

        {tab === 'rejectedClaims' ? (
          <RowsEditor<EvidenceBankDraft['rejectedClaims'][number]>
            id="eb-rejected"
            rows={draft.rejectedClaims}
            onChange={(rejectedClaims) => setDraft((prev) => ({ ...prev, rejectedClaims }))}
            empty={() => ({ claim: '', status: 'rejected' as const, reason: '', replacement: '' })}
            addLabel="Add a rejected claim"
            disabled={pending}
            emptyText="Nothing ruled out yet. A claim nobody can see is one that comes back in the next draft."
            renderRow={({ row, rowId, patch }) => (
              <>
                <p className="datum-ops__hint">
                  {row.ref ? `Recorded as [${row.ref}]` : 'New — a ref is assigned when you save'}
                </p>
                <Field
                  id={`${rowId}-claim`}
                  label="Claim"
                  value={row.claim}
                  onChange={(claim) => patch({ claim })}
                  disabled={pending}
                  multiline
                />
                <div className="datum-ops__field">
                  <label htmlFor={`${rowId}-status`}>Why it is here</label>
                  <select
                    id={`${rowId}-status`}
                    value={row.status}
                    onChange={(e) =>
                      patch({ status: e.target.value === 'expired' ? 'expired' : 'rejected' })
                    }
                    disabled={pending}
                  >
                    <option value="rejected">Rejected — it was never supportable</option>
                    <option value="expired">Expired — it was true and no longer is</option>
                  </select>
                </div>
                <Field
                  id={`${rowId}-reason`}
                  label="Reason"
                  value={row.reason}
                  onChange={(reason) => patch({ reason })}
                  disabled={pending}
                  multiline
                />
                <Field
                  id={`${rowId}-replacement`}
                  label="Say this instead"
                  value={row.replacement}
                  onChange={(replacement) => patch({ replacement })}
                  disabled={pending}
                  placeholder="E4, or a sentence."
                />
              </>
            )}
          />
        ) : null}

        <div className="datum-ops__review-footer">
          <div className="datum-ops__actions">
            <button
              type="button"
              className="datum-ops__btn datum-ops__btn--primary"
              onClick={save}
              disabled={pending}
            >
              Save
            </button>
            <span className="datum-ops__hint">
              {unsaved > 0
                ? `${unsaved} row${unsaved === 1 ? '' : 's'} not saved yet.`
                : 'Everything here is saved.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssistPanel({
  title,
  blurb,
  notes,
  onNotes,
  onRun,
  disabled,
  mock,
}: {
  title: string
  blurb: string
  notes: string
  onNotes: (value: string) => void
  onRun: () => void
  disabled: boolean
  mock: boolean
}) {
  return (
    <div className="datum-ops__assist">
      <div className="datum-ops__assist-head">
        <strong>{title}</strong>
        {mock ? <span className="datum-ops__pill datum-ops__pill--muted">mock</span> : null}
      </div>
      <p className="datum-ops__hint">{blurb}</p>
      <div className="datum-ops__field">
        <label htmlFor="eb-assist-notes">Your notes (optional)</label>
        <textarea
          id="eb-assist-notes"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          disabled={disabled}
          placeholder="Paste a results email, a support stat, a page you trust."
        />
      </div>
      <div className="datum-ops__actions">
        <button type="button" className="datum-ops__btn" onClick={onRun} disabled={disabled}>
          {disabled ? 'Working…' : title}
        </button>
      </div>
    </div>
  )
}
