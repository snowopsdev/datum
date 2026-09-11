'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  CLEARED_SURFACES,
  type ClearedSurface,
  type VerifiedClaim,
  type VerificationDepth,
  VERIFICATION_DEPTHS,
  verifiedClaimProblems,
} from '../../lib/tenant/evidenceBank'
import { assistAction } from './setupActions'
import { Field, RowsEditor } from './setupFields'
import { SitePagesHint } from './SitePagesHint'
import { type EvidenceBankDraft, emptyEvidenceBankDraft, type NewRow } from './setupTypes'
import { saveEvidenceBankAction } from './tenantActions'
import './ops.css'

type Tab = 'verifiedClaims' | 'facts' | 'rejectedClaims'

const TABS: [Tab, string][] = [
  ['verifiedClaims', 'Claims'],
  ['facts', 'Facts'],
  ['rejectedClaims', 'Rejected & expired'],
]

const DEPTH_LABEL: Record<VerificationDepth, string> = {
  primary_document: 'We have the original document',
  reproduced: 'We reproduced the result ourselves',
  third_party_audit: 'A third party audited it',
  self_reported: 'Self-reported, not checked yet',
}

const TAB_BLURB: Record<Tab, string> = {
  verifiedClaims:
    'Numbers and results you can back up, like "412 customers surveyed". Each one needs a source, a date, and a re-check date before the writer can use it.',
  facts: 'Plain facts that need no proof: founding year, locations, product names.',
  rejectedClaims:
    'Things you have ruled out. Listing them here stops the writer from bringing them back.',
}

/**
 * What is still missing on a row the operator is typing, judged by the rule the
 * prompt uses rather than a second one written here. A row that fails it is
 * shown as unverified, because the alternative — leaving it looking like every
 * other claim — is how a half-finished note ends up read as a checked fact.
 */
const claimProblems = (row: NewRow<VerifiedClaim>): string[] =>
  verifiedClaimProblems({ ...row, ref: row.ref ?? '' })

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
  sitePagesFetchedAt,
}: {
  initial: EvidenceBankDraft
  today: string
  /**
   * From the workspace profile. Both assist panels below read the site pages,
   * so null is worth saying before somebody presses one.
   */
  sitePagesFetchedAt: string | null
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
  const unverifiedCount = draft.verifiedClaims.filter((row) => claimProblems(row).length > 0).length
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
      setMessage('Saved. New rows now have a ref the writer can cite.')
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
        setError('Datum found nothing to propose. Try adding more notes.')
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
        'Proposed rows added above. They are not saved yet. Add a source to each one, then press Save.',
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
        What Datum is allowed to say about your company. A draft can only state something about you
        if it is listed here, and it must cite the row. Put the proof next to every claim.
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
        <p className="datum-ops__sub">{TAB_BLURB[tab]}</p>
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
                Only show claims that need a re-check
              </label>
              <span className="datum-ops__hint">
                {expiredCount > 0
                  ? `${expiredCount} claim${expiredCount === 1 ? ' is' : 's are'} past the re-check date. The writer will not use ${expiredCount === 1 ? 'it' : 'them'}.`
                  : 'No claims are past their re-check date.'}
              </span>
              {unverifiedCount > 0 ? (
                <span className="datum-ops__hint">
                  {`${unverifiedCount} claim${unverifiedCount === 1 ? ' is' : 's are'} not ready. The writer will not use ${unverifiedCount === 1 ? 'it' : 'them'} until the source, date, and re-check date are filled in.`}
                </span>
              ) : null}
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
              emptyText="No claims yet. Add one, or paste notes below and let Datum propose some."
              renderRow={({ row, rowId, patch }) => (
                <>
                  <p className="datum-ops__hint">
                    {row.ref ? `Cited as [${row.ref}]` : 'New. Gets a ref when you save.'}
                    {row.recheckAt && row.recheckAt.slice(0, 10) < today ? ' · Expired' : ''}
                  </p>
                  {claimProblems(row).length > 0 ? (
                    <p className="datum-ops__warn">
                      Not ready. The writer will not use this until: {claimProblems(row).join('; ')}
                      .
                    </p>
                  ) : null}
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
                    label="Where it comes from"
                    value={row.primarySource}
                    onChange={(primarySource) => patch({ primarySource })}
                    disabled={pending}
                    placeholder="Our 2026 customer survey (n=412)"
                  />
                  <Field
                    id={`${rowId}-sourceUrl`}
                    label="Link (optional)"
                    value={row.sourceUrl}
                    onChange={(sourceUrl) => patch({ sourceUrl })}
                    disabled={pending}
                  />
                  <Field
                    id={`${rowId}-sourceDate`}
                    label="Date of the source"
                    value={row.sourceDate ? row.sourceDate.slice(0, 10) : ''}
                    onChange={(sourceDate) => patch({ sourceDate })}
                    disabled={pending}
                    type="date"
                  />
                  <Field
                    id={`${rowId}-sampleOrMethod`}
                    label="How it was measured (optional)"
                    value={row.sampleOrMethod}
                    onChange={(sampleOrMethod) => patch({ sampleOrMethod })}
                    disabled={pending}
                    multiline
                    placeholder="Sample size, method, time period."
                  />
                  <div className="datum-ops__field">
                    <label htmlFor={`${rowId}-depth`}>How well is it checked?</label>
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
                    label="What this claim does not say"
                    value={row.limits}
                    onChange={(limits) => patch({ limits })}
                    disabled={pending}
                    multiline
                    placeholder="It does not mean every customer saw this result."
                    hint="QA rejects a draft that stretches the claim past this."
                  />
                  <div className="datum-ops__field">
                    <label htmlFor={`${rowId}-surfaces`}>Where it can be used</label>
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
                    <p className="datum-ops__hint">
                      Leave all unchecked if it can be used anywhere.
                    </p>
                  </div>
                  <Field
                    id={`${rowId}-recheckAt`}
                    label="Re-check by"
                    value={row.recheckAt ? row.recheckAt.slice(0, 10) : ''}
                    onChange={(recheckAt) => patch({ recheckAt })}
                    disabled={pending}
                    type="date"
                    hint="After this date the claim expires and the writer stops using it."
                  />
                </>
              )}
            />
            <AssistPanel
              title="Let Datum propose claims from your notes"
              buttonLabel="Propose claims"
              blurb="Paste a results email, a support stat, or a page you trust. Datum turns it into draft claims. They arrive without a source, so add the proof before you save."
              notes={notes}
              onNotes={setNotes}
              onRun={() => assist('verifiedClaims')}
              disabled={pending}
              mock={mock}
              sitePagesFetchedAt={sitePagesFetchedAt}
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
              emptyText="No facts yet. Founding year, locations, product names go here."
              renderRow={({ row, rowId, patch }) => (
                <>
                  <p className="datum-ops__hint">
                    {row.ref ? `Cited as [${row.ref}]` : 'New. Gets a ref when you save.'}
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
                    placeholder="The person to ask if it turns out to be wrong."
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
              title="Let Datum pull facts from your site"
              buttonLabel="Pull facts from the site"
              blurb="Reads the site pages fetched on the Workspace page and lists what they state. Nothing is saved until you check each one and press Save."
              notes={notes}
              onNotes={setNotes}
              onRun={() => assist('facts')}
              disabled={pending}
              mock={mock}
              sitePagesFetchedAt={sitePagesFetchedAt}
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
            emptyText="Nothing ruled out yet. Add a claim here to stop the writer from using it."
            renderRow={({ row, rowId, patch }) => (
              <>
                <p className="datum-ops__hint">
                  {row.ref ? `Recorded as [${row.ref}]` : 'New. Gets a ref when you save.'}
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
                  <label htmlFor={`${rowId}-status`}>Why it is ruled out</label>
                  <select
                    id={`${rowId}-status`}
                    value={row.status}
                    onChange={(e) =>
                      patch({ status: e.target.value === 'expired' ? 'expired' : 'rejected' })
                    }
                    disabled={pending}
                  >
                    <option value="rejected">Rejected: it was never true</option>
                    <option value="expired">Expired: it used to be true</option>
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
                  placeholder="A ref like E4, or a sentence."
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
                : 'All saved.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssistPanel({
  title,
  buttonLabel,
  blurb,
  notes,
  onNotes,
  onRun,
  disabled,
  mock,
  sitePagesFetchedAt,
}: {
  title: string
  buttonLabel: string
  blurb: string
  notes: string
  onNotes: (value: string) => void
  onRun: () => void
  disabled: boolean
  mock: boolean
  sitePagesFetchedAt: string | null
}) {
  return (
    <div className="datum-ops__assist">
      <div className="datum-ops__assist-head">
        <strong>{title}</strong>
        {mock ? <span className="datum-ops__pill datum-ops__pill--muted">mock</span> : null}
      </div>
      <p className="datum-ops__hint">{blurb}</p>
      <SitePagesHint fetchedAt={sitePagesFetchedAt} />
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
          {disabled ? 'Working…' : buttonLabel}
        </button>
      </div>
    </div>
  )
}
