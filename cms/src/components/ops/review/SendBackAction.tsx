'use client'

import React, { useRef, useState } from 'react'

import { sendBackAction } from '../actions'
import { SEND_BACK_REASONS, type SendBackReasonCode } from '../sendBackReasons'
import type { ReviewAction } from './useReviewAction'

/**
 * Send back, with the reason the writer will read.
 *
 * The reason is required, and the button stays disabled until there is one —
 * the server refuses an empty one too. A chip tags the reason (and prefills
 * the box when it is empty); the text is what is sent. Send back cannot be
 * undone — it clears the scores and the schedule — so it takes the page's
 * armed confirm rather than offering Undo.
 *
 * The box is its own, not the review-notes box above it: that one arrives
 * holding the note the *approving* reviewer left, and sending "reads well" back
 * as the reason for a revision would put it on the draft as a failure.
 */
export function SendBackAction({ action, articleId }: { action: ReviewAction; articleId: number }) {
  const { arm, armed, disarm, pending, runAction } = action
  const [reason, setReason] = useState('')
  const [code, setCode] = useState<SendBackReasonCode | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const ready = reason.trim().length > 0

  const pick = (next: SendBackReasonCode, label: string) => {
    if (code === next) {
      setCode(null)
      return
    }
    setCode(next)
    if (next === 'other') field.current?.focus()
    else if (!reason.trim()) setReason(label)
  }

  return (
    <div className="datum-ops__block">
      <h3>Send back</h3>
      <div className="datum-ops__field">
        <label htmlFor="send-back-reason">Why is it going back? The writer reads this.</label>
        <textarea
          id="send-back-reason"
          ref={field}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="datum-ops__chips" role="group" aria-label="Reason">
        {SEND_BACK_REASONS.map((entry) => (
          <button
            key={entry.code}
            type="button"
            className="datum-ops__chip"
            aria-pressed={code === entry.code}
            disabled={pending}
            onClick={() => pick(entry.code, entry.label)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="datum-ops__actions">
        {armed === 'send-back' ? (
          <>
            <button
              type="button"
              className="datum-ops__btn datum-ops__btn--danger"
              data-confirm-go="send-back"
              disabled={pending || !ready}
              onClick={() => {
                disarm()
                runAction(() => sendBackAction(articleId, reason, code ?? undefined))
              }}
            >
              Confirm: send back
            </button>
            <button type="button" className="datum-ops__btn" disabled={pending} onClick={disarm}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="datum-ops__btn"
            data-confirm-trigger="send-back"
            disabled={pending || !ready}
            onClick={() => arm('send-back')}
          >
            Send back
          </button>
        )}
      </div>
    </div>
  )
}
