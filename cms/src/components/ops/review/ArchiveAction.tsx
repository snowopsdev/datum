'use client'

import React, { useState } from 'react'

import { archiveArticleAction } from '../actions'
import type { ReviewAction } from './useReviewAction'

/**
 * Archive, behind the two-click confirm the regenerate button uses.
 *
 * Rendered into every panel a person owns and none that a run does: an
 * article a run is carrying is refused by `archiveArticleAction` anyway, and
 * offering the button beside "Datum will write this on the next run" invites
 * exactly the click that gets refused.
 *
 * It owns its confirm flag rather than taking one. Exactly one status panel
 * renders at a time, so there is never a second, still-unarmed Archive button
 * beside an armed one.
 */
export function ArchiveAction({
  action,
  archived,
  articleId,
}: {
  action: ReviewAction
  archived: boolean
  articleId: number
}) {
  const [confirming, setConfirming] = useState(false)
  const { pending, runAction, setNotice } = action

  if (archived) {
    return <span className="datum-ops__hint">Archived — hidden from the content board.</span>
  }
  if (confirming) {
    return (
      <>
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--danger"
          disabled={pending}
          onClick={() => {
            setConfirming(false)
            runAction(async () => {
              await archiveArticleAction(articleId)
              setNotice('Archived — it is off the content board.')
            })
          }}
        >
          Confirm: archive
        </button>
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </>
    )
  }
  return (
    <button
      type="button"
      className="datum-ops__btn"
      disabled={pending}
      onClick={() => setConfirming(true)}
      title="Take this piece off the content board. Nothing is deleted and the audit trail is kept."
    >
      Archive
    </button>
  )
}

/** The "Open in admin" link every panel ends its action row with. */
export function OpenInAdmin({ editHref }: { editHref: string }) {
  return (
    <a className="datum-ops__btn" href={editHref}>
      Open in admin
    </a>
  )
}
