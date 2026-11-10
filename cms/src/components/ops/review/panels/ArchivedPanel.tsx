'use client'

import React from 'react'

import { STATUS_META } from '../../../../lib/articleStatusMeta'
import { unwrap } from '../../actionResult'
import { unarchiveArticleAction } from '../../actions'
import { OpenInAdmin } from '../ArchiveAction'
import type { PanelProps } from '../types'

/**
 * The read-only panel every archived article gets, whatever its status.
 *
 * Archived means off limits, not just off the content list: `gateArchivedStatus`
 * refuses status changes and schedules, and `queueRunForArticles` refuses to
 * queue one, so the controls the status panel would offer are exactly the
 * ones the server would refuse. The only thing a person can do here is bring
 * the piece back, after which the panel for its status takes over.
 */
export function ArchivedPanel({ action, article, editHref }: PanelProps) {
  const { pending, runAction, setNotice } = action
  const meta = STATUS_META[article.status]
  return (
    <div className="datum-ops__block">
      <h3>Archived</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        Off the content list and skipped by every run. It was {meta.label} (
        <code>{article.status}</code>) when it was archived, and it goes back to that step if you
        unarchive it.
      </p>
      <div className="datum-ops__actions">
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--primary"
          disabled={pending}
          onClick={() =>
            runAction(async () => {
              unwrap(await unarchiveArticleAction(article.id))
              setNotice('Unarchived — it is back on the content list.')
            })
          }
        >
          Unarchive
        </button>
        <OpenInAdmin editHref={editHref} />
      </div>
    </div>
  )
}
