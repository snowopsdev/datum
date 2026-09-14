'use client'

import React, { useState } from 'react'

import { approveArticleAction, publishArticleAction, sendBackAction } from '../../actions'
import { ArchiveAction, OpenInAdmin } from '../ArchiveAction'
import { DECISION_LABEL, type PanelProps } from '../types'

/**
 * QA and information gain both cleared the draft; the decision is a person's.
 *
 * Approving and publishing stay on the page, so each says what it did. The
 * status comes back from the action rather than being assumed from the
 * button's name: `gateVerifiedStatus` and friends are free to have landed the
 * write somewhere else, and the notice must not claim otherwise.
 */
export function VerifiedPanel({ action, article, editHref, run, runIsCurrent }: PanelProps) {
  const { pending, runAction, setNotice } = action
  const [notes, setNotes] = useState(article.reviewNotes ?? '')

  return (
    <div className="datum-ops__block">
      <h3>Approve</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        QA and information gain both cleared this draft
        {run && runIsCurrent ? ` (run #${run.id}, ${DECISION_LABEL[run.decision]})` : ''}.
      </p>
      <div className="datum-ops__field">
        <label htmlFor="note">Review notes</label>
        <textarea
          id="note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="datum-ops__actions">
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--primary"
          disabled={pending}
          onClick={() =>
            runAction(async () => {
              const { status } = await approveArticleAction(article.id, notes)
              setNotice(
                status === 'approved' ? 'Approved — publish when ready' : `Saved as ${status}.`,
              )
            })
          }
        >
          Approve
        </button>
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending}
          onClick={() =>
            runAction(async () => {
              const { status } = await publishArticleAction(article.id, notes)
              setNotice(status === 'published' ? 'Published · view it' : `Saved as ${status}.`)
            })
          }
        >
          Approve &amp; publish
        </button>
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending}
          onClick={() =>
            runAction(() => sendBackAction(article.id, notes || 'Sent back for revision.'))
          }
        >
          Send back
        </button>
        <ArchiveAction action={action} archived={article.archived} articleId={article.id} />
        <OpenInAdmin editHref={editHref} />
      </div>
    </div>
  )
}
