'use client'

import React, { useState } from 'react'

import {
  publishArticleAction,
  scheduleArticleAction,
  sendBackAction,
  unscheduleArticleAction,
} from '../../actions'
import { formatAuditTimestamp } from '../../articleStatus'
import { ArchiveAction, OpenInAdmin } from '../ArchiveAction'
import type { PanelProps } from '../types'

/**
 * An ISO instant as the `datetime-local` string its input wants, in UTC.
 *
 * UTC rather than the viewer's zone on purpose: every other time on this page
 * comes from `formatAuditTimestamp`, which is pinned to UTC, and an input that
 * disagreed with the "Scheduled for…" line right above it would be read as a
 * bug in one of them. It also keeps the control safe to server-render — the
 * Node process's zone and the browser's are frequently different, and a value
 * derived from `getHours()` would not survive hydration.
 */
function toUtcInputValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

/** The same string back as an instant. `datetime-local` omits the seconds. */
function utcInputValueToIso(value: string): string {
  return `${value.length === 16 ? `${value}:00` : value}Z`
}

/** Signed off and waiting: publish it now, or pick a time. */
export function ApprovedPanel({ action, article, editHref, scheduleExpired }: PanelProps) {
  const { pending, runAction, setNotice } = action
  const [notes, setNotes] = useState(article.reviewNotes ?? '')
  /**
   * The scheduling input, in UTC. Seeded from whatever is already scheduled so
   * changing a time is an edit rather than a retype.
   */
  const [scheduleAt, setScheduleAt] = useState(() => toUtcInputValue(article.publishAt))

  return (
    <div className="datum-ops__block">
      <h3>Publish</h3>
      {article.publishAt ? (
        <p
          className={scheduleExpired ? 'datum-ops__warn' : 'datum-ops__sub'}
          style={{ marginBottom: 10 }}
        >
          {scheduleExpired ? 'Schedule expired on' : 'Scheduled for'}{' '}
          {formatAuditTimestamp(article.publishAt)} ·{' '}
          <button
            type="button"
            className="datum-ops__link-btn"
            disabled={pending}
            onClick={() =>
              runAction(async () => {
                await unscheduleArticleAction(article.id)
                setScheduleAt('')
                setNotice('Unscheduled — it stays approved until you publish it.')
              })
            }
          >
            Unschedule
          </button>
        </p>
      ) : (
        <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
          Publish it now, or pick a time and Datum publishes it for you.
        </p>
      )}
      {/* Shown rather than assumed: Send back writes this text into
          `reviewNotes` and onto the failing qualitative check, and the box
          arrives holding the note the *approving* reviewer left. Sending that
          back as the reason for a revision would put "reads well" on the draft
          as a failure. */}
      <div className="datum-ops__field">
        <label htmlFor="note">Review notes</label>
        <textarea
          id="note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="datum-ops__field">
        <label htmlFor="publish-at">Publish at (UTC)</label>
        <input
          id="publish-at"
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
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
              const { status } = await publishArticleAction(article.id, notes)
              setNotice(status === 'published' ? 'Published · view it' : `Saved as ${status}.`)
            })
          }
        >
          Publish now
        </button>
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending || scheduleAt === ''}
          onClick={() =>
            runAction(async () => {
              const { publishAt } = await scheduleArticleAction(
                article.id,
                utcInputValueToIso(scheduleAt),
              )
              setNotice(`Scheduled for ${formatAuditTimestamp(publishAt)}`)
            })
          }
        >
          Schedule
        </button>
        <button
          type="button"
          className="datum-ops__btn"
          disabled={pending}
          onClick={() =>
            runAction(() => sendBackAction(article.id, notes.trim() || 'Sent back after approval.'))
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
