'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

/** What every panel is handed to run a reviewer action and report on it. */
export type ReviewAction = {
  error: string | null
  /**
   * What just happened, when it worked. Reset, regenerate and Run all queue a
   * run now, and whether one was queued is the whole answer to "did that do
   * anything" — an empty screen after pressing Run is what this replaces.
   */
  notice: string | null
  pending: boolean
  runAction: (fn: () => Promise<unknown>) => void
  setNotice: (value: string | null) => void
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
  const [notice, setNotice] = useState<string | null>(null)

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

  return { error, notice, pending, runAction, setNotice }
}
