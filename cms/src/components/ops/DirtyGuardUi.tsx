'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { agoLabel, describeChanged, saveLabel, unsavedLabel } from './dirtyGuardCore'
import type { DirtyGuard } from './useDirtyGuard'
import './ops.css'

// The UI never builds a form value, so it is generic over whichever one the editor has.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGuard = DirtyGuard<any>

/** The dirty dot and "N unsaved changes". A stable live region, so a count that
 *  changes is announced once and a keystroke that changes nothing is not. */
export function SaveStatus({ guard }: { guard: Pick<AnyGuard, 'dirty' | 'changeCount'> }) {
  return (
    <span className="datum-ops__dirty" role="status">
      {guard.dirty ? (
        <>
          <span aria-hidden="true" className="datum-ops__dirty-dot" />
          {unsavedLabel(guard.changeCount)}
        </>
      ) : null}
    </span>
  )
}

/**
 * Save, disabled while there is nothing to save, labelled by what is true:
 * "Save", "Saving…", and after a save "Saved · 3:04 PM". The status beside it
 * says how many changes are waiting.
 */
export function SaveButton({
  guard,
  pending,
  onClick,
  blocked,
  title,
}: {
  guard: AnyGuard
  pending: boolean
  onClick: () => void
  /** A reason the editor cannot save yet, on top of there being nothing to save. */
  blocked?: boolean
  title?: string
}) {
  return (
    <>
      <button
        className="datum-ops__btn datum-ops__btn--primary"
        disabled={pending || !guard.dirty || blocked}
        onClick={onClick}
        title={title}
        type="button"
      >
        {saveLabel({ ...guard, saving: guard.saving || pending })}
      </button>
      <SaveStatus guard={guard} />
    </>
  )
}

/**
 * The sticky bar that appears while there is something unsaved, above the
 * fixed run bar. The buttons are the only live content; the count is for the
 * eye, since `SaveStatus` already announces it.
 */
export function UnsavedBar({
  guard,
  pending,
  onSave,
  blocked,
}: {
  guard: AnyGuard
  pending: boolean
  onSave: () => void
  blocked?: boolean
}) {
  if (!guard.dirty) return null
  return (
    <div className="datum-ops__unsaved-bar" data-unsaved-bar>
      <span aria-hidden="true" className="datum-ops__dirty-dot" />
      <span aria-hidden="true" className="datum-ops__unsaved-count">
        {unsavedLabel(guard.changeCount)}
      </span>
      <button
        className="datum-ops__btn"
        disabled={pending}
        onClick={() => guard.discard()}
        type="button"
      >
        Discard
      </button>
      <button
        className="datum-ops__btn datum-ops__btn--primary"
        disabled={pending || blocked}
        onClick={onSave}
        type="button"
      >
        {saveLabel({ ...guard, saving: guard.saving || pending }, true)}
      </button>
    </div>
  )
}

/** "Restored the edit you hadn't saved", or the question when the record moved on. */
export function RestoreNotice({ guard }: { guard: AnyGuard }) {
  const restore = guard.restore
  if (!restore) return null
  const ago = agoLabel(restore.at)
  return (
    <div className="datum-ops__restore" role="status">
      <span>
        {restore.kind === 'restored'
          ? `Restored the edit you hadn't saved, from ${ago}.`
          : `You have an unsaved edit from ${ago}, but this was saved elsewhere since.`}
      </span>
      {restore.kind === 'stale' ? (
        <button className="datum-ops__btn" onClick={guard.keepMine} type="button">
          Use mine
        </button>
      ) : null}
      <button
        className="datum-ops__btn"
        onClick={restore.kind === 'restored' ? guard.discard : guard.dismissRestore}
        type="button"
      >
        Discard
      </button>
    </div>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * "Leave without saving?" A modal: focus starts on Stay, Tab stays inside,
 * Escape is Stay. Without `save` there is no "Save and leave" — a guard that
 * cannot save should not offer it.
 */
export function LeaveDialog({ guard, canSave = true }: { guard: AnyGuard; canSave?: boolean }) {
  const request = guard.leave
  const stayRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!request) return
    stayRef.current?.focus()
  }, [request])

  if (!request || typeof document === 'undefined') return null

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!guard.leaveSaving) guard.stay()
      return
    }
    if (event.key !== 'Tab') return
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes?.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="datum-ops datum-ops__dialog-scrim" onKeyDown={onKeyDown}>
      <div
        aria-describedby="datum-leave-body"
        aria-labelledby="datum-leave-title"
        aria-modal="true"
        className="datum-ops__dialog"
        ref={panelRef}
        role="alertdialog"
      >
        <h2 id="datum-leave-title">Leave without saving?</h2>
        <p id="datum-leave-body">
          Your changes to {describeChanged(guard.changed, guard.labels)} will be lost. We&rsquo;ll
          keep a local copy for 24 hours.
        </p>
        <div className="datum-ops__actions">
          {canSave ? (
            <button
              className="datum-ops__btn datum-ops__btn--primary"
              disabled={guard.leaveSaving}
              onClick={() => void guard.saveAndLeave()}
              type="button"
            >
              {guard.leaveSaving ? 'Saving…' : 'Save and leave'}
            </button>
          ) : null}
          <button
            className="datum-ops__btn"
            disabled={guard.leaveSaving}
            onClick={guard.confirmLeave}
            type="button"
          >
            Leave
          </button>
          <button
            className="datum-ops__btn"
            disabled={guard.leaveSaving}
            onClick={guard.stay}
            ref={stayRef}
            type="button"
          >
            Stay
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Everything the guard puts on the page besides the Save button itself. */
export function DirtyGuardChrome({
  guard,
  pending,
  onSave,
  blocked,
}: {
  guard: AnyGuard
  pending: boolean
  onSave: () => void
  blocked?: boolean
}) {
  return (
    <>
      <UnsavedBar blocked={blocked} guard={guard} onSave={onSave} pending={pending} />
      <LeaveDialog guard={guard} />
    </>
  )
}
