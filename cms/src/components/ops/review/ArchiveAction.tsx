'use client'

import React from 'react'

import { unwrap } from '../actionResult'
import { archiveArticleAction, unarchiveArticleAction } from '../actions'
import type { ReviewAction } from './useReviewAction'

/**
 * Archive, at once, with Undo instead of a confirm.
 *
 * Rendered into every panel a person owns and none that a run does: an
 * article a run is carrying is refused by `archiveArticleAction` anyway, and
 * offering the button beside "Datum will write this on the next run" invites
 * exactly the click that gets refused.
 *
 * Archiving deletes nothing and has a true inverse, so it does not ask first:
 * the notice (inline chip and toast) carries an Undo that unarchives, and the
 * archived panel keeps Unarchive after that. Pressing it also backs out of any
 * confirm armed elsewhere on the page.
 *
 * A published piece is the exception to "nothing changes": archiving it takes
 * it off the public site too, so `published` makes the title and notice say
 * so. Undo still puts it back, on the site as well.
 */
export function ArchiveAction({
  action,
  archived,
  articleId,
  published = false,
}: {
  action: ReviewAction
  archived: boolean
  articleId: number
  published?: boolean
}) {
  const { armed, disarm, pending, runAction, setNotice } = action

  if (archived) {
    return <span className="datum-ops__hint">Archived — hidden from the content list.</span>
  }
  return (
    <button
      type="button"
      className="datum-ops__btn"
      disabled={pending}
      onClick={() => {
        if (armed) disarm()
        runAction(async () => {
          unwrap(await archiveArticleAction(articleId))
          setNotice(
            published
              ? 'Archived — it is off the site and the content list.'
              : 'Archived — it is off the content list.',
            {
              label: 'Undo',
              toast: 'Archived',
              run: async () => {
                unwrap(await unarchiveArticleAction(articleId))
              },
              done: published
                ? 'Unarchived — it is back on the site and the content list.'
                : 'Unarchived — it is back on the content list.',
            },
          )
        })
      }}
      title={
        published
          ? 'Take this piece off the public site and the content list. Nothing is deleted, the audit trail is kept, and Undo puts it back.'
          : 'Take this piece off the content list. Nothing is deleted, the audit trail is kept, and Undo puts it back.'
      }
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
