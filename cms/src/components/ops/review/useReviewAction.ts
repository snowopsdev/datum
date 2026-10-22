'use client'

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

/**
 * What a notice says. A bare string, or text with a link — "Published · view
 * it" is a real link to the live page, not a hint. The same shape is what a
 * toast renders.
 */
export type ReviewNotice = string | { text: string; href?: string; hrefLabel?: string }

export function noticeText(notice: ReviewNotice): string {
  return typeof notice === 'string' ? notice : notice.text
}

/**
 * How to take back what a notice reports. Only for actions with a true
 * inverse (archive, unschedule); `done` is the notice the undo leaves behind.
 * `toast` is the short form of the notice for the toast, which sits beside the
 * longer inline one rather than repeating it.
 */
export type ReviewUndo = {
  label: string
  run: () => Promise<unknown>
  done: string
  toast: string
}

/** How long a toast with an Undo stays: longer than a plain 6s success. */
const UNDO_TOAST_MS = 8000

/** What every panel is handed to run a reviewer action and report on it. */
export type ReviewAction = {
  /**
   * The one confirm armed on this page, by key, or null. A page-level slot
   * rather than state in each panel: two confirms armed at once (Regenerate
   * and a live-cost Reset, say) is two buttons asking for the same click.
   */
  armed: string | null
  /** Arm a confirm, disarming whichever was armed. */
  arm: (key: string) => void
  /** Disarm, and put focus back on the control that armed it. */
  disarm: () => void
  error: string | null
  /**
   * What just happened, when it worked. Reset, regenerate and Run all queue a
   * run now, and whether one was queued is the whole answer to "did that do
   * anything" — an empty screen after pressing Run is what this replaces.
   */
  notice: ReviewNotice | null
  pending: boolean
  runAction: (fn: () => Promise<unknown>) => void
  /** Undo the last action, when it left one. */
  runUndo: () => void
  /** With `undo`, the notice also becomes a toast and an inline Undo chip. */
  setNotice: (value: ReviewNotice | null, undo?: ReviewUndo) => void
  undo: ReviewUndo | null
}

/**
 * Run a reviewer action and re-render the page in place.
 *
 * Approving and publishing used to push the reviewer back to the board, which
 * threw away the one thing they were about to want — the piece they had just
 * decided on, now showing what the decision did to it. Everything refreshes
 * instead: the server component re-reads the article and the panel for its new
 * status replaces the one that was just used.
 *
 * One hook for every panel so the busy flag, the error line and the notice are
 * genuinely one state: two panels cannot disagree about whether a write is in
 * flight, and a notice left by one is cleared by the next action.
 */
export function useReviewAction(): ReviewAction {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNoticeState] = useState<ReviewNotice | null>(null)
  const [undo, setUndo] = useState<ReviewUndo | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const undoRef = useRef<ReviewUndo | null>(null)
  const toastId = useRef<string | number | null>(null)
  /** The key whose trigger should get focus back once it can take it. */
  const refocus = useRef<string | null>(null)
  const focusUndo = useRef(false)

  const dismissUndoToast = () => {
    if (toastId.current !== null) toast.dismiss(toastId.current)
    toastId.current = null
  }

  const arm = (key: string) => {
    refocus.current = null
    setArmed(key)
  }
  const disarm = () => {
    refocus.current = armed
    setArmed(null)
  }

  // Escape backs out of a confirm from anywhere on the page.
  useEffect(() => {
    if (!armed) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        refocus.current = armed
        setArmed(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [armed])

  // Arming swaps the trigger for Confirm/Cancel, so focus would fall to
  // <body>; it goes to Confirm. Disarming goes back to the trigger — after
  // `pending` clears, because a disabled button cannot take focus. The Undo
  // chip, when there is one, wins: the trigger it replaces is usually gone.
  useEffect(() => {
    if (armed) {
      document.querySelector<HTMLElement>(`[data-confirm-go="${armed}"]`)?.focus()
      return
    }
    if (pending) return
    if (refocus.current) {
      document.querySelector<HTMLElement>(`[data-confirm-trigger~="${refocus.current}"]`)?.focus()
      refocus.current = null
    }
    if (focusUndo.current && undo) {
      document.querySelector<HTMLElement>('[data-notice-undo]')?.focus()
    }
    focusUndo.current = false
  }, [armed, pending, undo])

  const setNotice = (value: ReviewNotice | null, withUndo?: ReviewUndo) => {
    dismissUndoToast()
    setNoticeState(value)
    undoRef.current = withUndo ?? null
    setUndo(withUndo ?? null)
    if (value !== null && withUndo) {
      focusUndo.current = true
      toastId.current = toast.success(withUndo.toast, {
        action: { label: withUndo.label, onClick: () => runUndo(withUndo) },
        duration: UNDO_TOAST_MS,
      })
    }
  }

  const runUndo = (which: ReviewUndo | null = undoRef.current) => {
    // A stale toast must not undo something newer than what it reported.
    if (!which || which !== undoRef.current) return
    setError(null)
    dismissUndoToast()
    startTransition(async () => {
      try {
        await which.run()
        // Only now is there nothing left to undo. A failed Undo keeps its
        // notice and chip so it can be retried, rather than leaving the
        // action it reported as permanent.
        undoRef.current = null
        setUndo(null)
        setNoticeState(which.done)
        router.refresh()
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error))
      }
    })
  }

  const runAction = (fn: () => Promise<unknown>) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (error) {
        // Whatever was actually thrown. "Action failed" hid the gate messages
        // (`articleReviewGate.ts`) that explain why a write was refused, which
        // are the only thing that tells a reviewer what to do differently.
        setError(error instanceof Error ? error.message : String(error))
      }
    })
  }

  return {
    armed,
    arm,
    disarm,
    error,
    notice,
    pending,
    runAction,
    runUndo: () => runUndo(),
    setNotice,
    undo,
  }
}
