'use client'

import React, { useRef, useState } from 'react'
import { auditDetailsAction } from './auditActions'
import type { AuditSource } from './auditTypes'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; text: string }

export function AuditEvidence({ articleId, source }: { articleId: number; source: AuditSource }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const loading = useRef(false)
  const load = async () => {
    if (loading.current || state.kind === 'loaded') return
    loading.current = true
    setState({ kind: 'loading' })
    try {
      const result = await auditDetailsAction({ articleId, ...source })
      setState(
        result.ok
          ? {
              kind: 'loaded',
              text:
                result.details == null
                  ? 'No additional evidence.'
                  : JSON.stringify(result.details, null, 2),
            }
          : { kind: 'error', message: result.error },
      )
    } catch {
      setState({ kind: 'error', message: 'Could not load evidence. Try again.' })
    } finally {
      loading.current = false
    }
  }
  return (
    <details
      className="datum-ops__audit-details"
      onToggle={(event) => {
        if (event.currentTarget.open && state.kind === 'idle') void load()
      }}
    >
      <summary>Evidence</summary>
      {state.kind === 'loading' ? <p role="status">Loading evidence…</p> : null}
      {state.kind === 'error' ? (
        <p role="alert">
          {state.message}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}
      {state.kind === 'loaded' ? <pre>{state.text}</pre> : null}
    </details>
  )
}
