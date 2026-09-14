'use client'

import React, { useState } from 'react'

import { regenerateArticleAction, resetToDraftedAction } from '../../actions'
import { revisitBriefAction } from '../../briefActions'
import { ArchiveAction, OpenInAdmin } from '../ArchiveAction'
import { EvidenceCard } from '../EvidenceCard'
import { QaFailures, QaTriage } from '../QaTriage'
import type { PanelProps } from '../types'

/** The information-gain reasons, restated beside the controls that act on them. */
function IgReasonsAside({
  run,
  runIsCurrent,
}: Pick<PanelProps, 'run' | 'runIsCurrent'>) {
  if (!run || run.reasons.length === 0) return null
  return (
    <div className="datum-ops__block">
      <h3>Information-gain reasons</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        From run #{run.id}
        {runIsCurrent ? '' : ' — an earlier scoring pass, not the current decision'}. Regenerating
        feeds these to the next draft verbatim.
      </p>
      <ul className="datum-ops__list">
        {run.reasons.map((reason, index) => (
          <li key={`aside-${reason.policy}-${index}`}>
            <code>{reason.policy}</code> {reason.message}
            {reason.claimId ? ` (claim ${reason.claimId})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * QA sent this draft back. The panel shows what failed and offers the two ways
 * out — re-enter QA, or throw the draft away and write another.
 */
export function NeedsRevisionPanel({
  action,
  article,
  editHref,
  mode,
  run,
  runIsCurrent,
}: PanelProps) {
  const { pending, runAction, setNotice } = action
  const [notes, setNotes] = useState(article.reviewNotes ?? '')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  /** Live mode only: reset and regenerate queue a run, so they cost money. */
  const [pendingReviewAction, setPendingReviewAction] = useState<'reset' | 'regenerate' | null>(
    null,
  )
  const revisionCount = article.revisionCount ?? 0

  /**
   * Report what reset and regenerate did with the run they queue.
   *
   * Both actions queue a run themselves and return whether they managed it.
   * Throwing away that answer left the reviewer to guess, and the guess was
   * wrong precisely when the workspace was not ready to run.
   */
  const reportQueued = (result: { queued: boolean; reason?: string }) => {
    setNotice(result.queued ? 'Run queued' : (result.reason ?? 'No run was queued.'))
  }

  /**
   * Without `confirmLiveCost` the gate refuses with "Confirm the live provider
   * cost before starting this run." and this panel has no control that could —
   * the reviewer is told to confirm something nothing on the page will let
   * them confirm. Mock mode is unaffected: the gate only looks at the flag in
   * live.
   */
  const runReviewAction = (which: 'reset' | 'regenerate', confirmLiveCost: boolean) => {
    setPendingReviewAction(null)
    runAction(async () => {
      const options = { confirmLiveCost }
      reportQueued(
        which === 'reset'
          ? await resetToDraftedAction(article.id, notes, options)
          : await regenerateArticleAction(article.id, notes, options),
      )
    })
  }

  const requestReviewAction = (which: 'reset' | 'regenerate') => {
    if (mode === 'live') setPendingReviewAction(which)
    else runReviewAction(which, false)
  }

  const revisitBrief = () =>
    runAction(async () => {
      const result = await revisitBriefAction(article.id)
      if (!result.ok) throw new Error(result.error)
    })

  return (
    <>
      <QaTriage article={article} />
      <QaFailures article={article} />
      <EvidenceCard article={article} />
      <IgReasonsAside run={run} runIsCurrent={runIsCurrent} />
      <div className="datum-ops__block">
        <h3>Resolve</h3>
        <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
          Reset to <code>drafted</code> re-enters QA on the next run. Regenerating goes further
          back, to <code>researched</code>, and writes a new draft on the next run.
          {revisionCount > 0
            ? ` Regenerated ${revisionCount} time${revisionCount === 1 ? '' : 's'} already.`
            : ''}
        </p>
        {article.revisionNotes ? (
          <details className="datum-ops__audit-details" style={{ marginBottom: 10 }}>
            <summary>Notes fed to the last regeneration</summary>
            <pre>{article.revisionNotes}</pre>
          </details>
        ) : null}
        <div className="datum-ops__field">
          <label htmlFor="note">Review note</label>
          <textarea
            id="note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            placeholder="What you fixed…"
          />
        </div>
        {/* One question at a time: the live-cost confirmation replaces the
            action row rather than sitting under it, so the panel never shows
            two Cancels answering different questions. */}
        {pendingReviewAction ? (
          <>
            <p className="datum-ops__warn">This calls paid providers. Continue?</p>
            <div className="datum-ops__actions">
              <button
                type="button"
                className="datum-ops__btn datum-ops__btn--primary"
                disabled={pending}
                onClick={() => runReviewAction(pendingReviewAction, true)}
              >
                Confirm
              </button>
              <button
                type="button"
                className="datum-ops__btn"
                disabled={pending}
                onClick={() => setPendingReviewAction(null)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="datum-ops__actions">
            <button
              type="button"
              className="datum-ops__btn datum-ops__btn--primary"
              disabled={pending}
              onClick={() => requestReviewAction('reset')}
            >
              Reset to drafted
            </button>
            <button
              className="datum-ops__btn"
              disabled={pending}
              onClick={revisitBrief}
              title="Go back to the brief and change the angle or sections before rewriting"
              type="button"
            >
              Revisit brief
            </button>
            {confirmRegenerate ? (
              <>
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--danger"
                  disabled={pending}
                  onClick={() => requestReviewAction('regenerate')}
                >
                  Confirm: discard draft &amp; regenerate
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() => setConfirmRegenerate(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="datum-ops__btn"
                disabled={pending}
                onClick={() => setConfirmRegenerate(true)}
              >
                Regenerate from gaps
              </button>
            )}
            <ArchiveAction action={action} archived={article.archived} articleId={article.id} />
            <OpenInAdmin editHref={editHref} />
          </div>
        )}
        {confirmRegenerate && !pendingReviewAction ? (
          <p className="datum-ops__warn" style={{ marginTop: 10 }}>
            This throws away the current body and sends the article back to <code>researched</code>,
            then writes a new draft on the next run with the reasons above (plus your note) in the
            prompt.
          </p>
        ) : null}
      </div>
    </>
  )
}
