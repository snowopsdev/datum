'use client'

import React, { useState } from 'react'

import { overrideReviewAction, sendBackAction } from '../../actions'
import { revisitBriefAction } from '../../briefActions'
import { ArchiveAction, OpenInAdmin } from '../ArchiveAction'
import type { PanelProps } from '../types'

/**
 * Scoring asked for a person: `needs_review` and `blocked` both land here.
 *
 * The justification box is deliberately *not* seeded from the article's
 * persisted `reviewJustification`: `gateReviewOverride` requires the submitted
 * justification to differ from the stored one, so a pre-filled box would
 * either silently re-satisfy the gate or hand the reviewer a value that is
 * guaranteed to be refused. The reviewer types a fresh one, every time.
 */
export function ReviewDecisionPanel({ action, article, editHref, run }: PanelProps) {
  const { pending, runAction } = action
  const [justification, setJustification] = useState('')

  return (
    <div className="datum-ops__block">
      <h3>Reviewer decision</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        {article.status === 'blocked'
          ? 'Scoring blocked this draft.'
          : 'Scoring asked for a human.'}{' '}
        {run
          ? `Run #${run.id} recorded ${run.reasons.length} reason${
              run.reasons.length === 1 ? '' : 's'
            } — read them on the scorecard before deciding.`
          : 'No scorecard is attached to this article.'}
      </p>
      <div className="datum-ops__field">
        <label htmlFor="justification">Justification (required to override)</label>
        <textarea
          id="justification"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          disabled={pending}
          placeholder="Why this draft is safe to verify despite the decision…"
        />
      </div>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        Overriding records your justification on the article and in the audit trail, and must be
        new text each time — a justification written for an earlier review will be refused.
      </p>
      <div className="datum-ops__actions">
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--primary"
          disabled={pending || justification.trim().length === 0}
          onClick={() => runAction(() => overrideReviewAction(article.id, justification))}
        >
          Override to verified
        </button>
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending}
          onClick={() =>
            runAction(() =>
              sendBackAction(
                article.id,
                justification.trim() || 'Sent back after information-gain review.',
              ),
            )
          }
        >
          Send back
        </button>
        <button
          className="datum-ops__btn"
          disabled={pending}
          onClick={() =>
            runAction(async () => {
              const result = await revisitBriefAction(article.id)
              if (!result.ok) throw new Error(result.error)
            })
          }
          title="Go back to the brief and change the angle or sections before rewriting"
          type="button"
        >
          Revisit brief
        </button>
        <ArchiveAction action={action} archived={article.archived} articleId={article.id} />
        <OpenInAdmin editHref={editHref} />
      </div>
    </div>
  )
}
