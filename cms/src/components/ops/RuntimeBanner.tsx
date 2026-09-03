'use client'

import React, { useEffect, useState } from 'react'

import { runtimeStatusAction } from './tenantActions'
import './ops.css'

/**
 * For whoever deploys this, not for editors: live mode with keys missing.
 *
 * It used to be an onboarding gate, which put an environment problem in front
 * of a content person who could not fix it. Now it is a banner that names the
 * variables and otherwise stays out of the way. Dismissed per session.
 */
export function RuntimeBanner() {
  const [status, setStatus] = useState<{
    mode: 'mock' | 'live'
    missing: string[]
    needsCodexLogin: boolean
    unsupportedModels: string[]
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => void runtimeStatusAction().then(setStatus), 0)
    return () => clearTimeout(id)
  }, [])

  if (!status || status.mode !== 'live' || dismissed) return null
  if (
    status.missing.length === 0 &&
    !status.needsCodexLogin &&
    status.unsupportedModels.length === 0
  )
    return null

  return (
    <div className="datum-runtime" role="status">
      <strong>Live providers are not fully configured.</strong>
      {status.missing.length > 0 && (
        <>
          {' '}
          Runs will fail until whoever deploys this sets{' '}
          {status.missing.map((name, index) => (
            <React.Fragment key={name}>
              {index > 0 && ', '}
              <code>{name}</code>
            </React.Fragment>
          ))}
          .
        </>
      )}
      {status.needsCodexLogin && (
        <>
          {' '}
          Codex models need <code>codex login</code> on this host.
        </>
      )}
      {status.unsupportedModels.length > 0 && (
        <> Local Codex execution is disabled; select an API-backed model for live runs.</>
      )}
      <button aria-label="Dismiss" className="datum-runtime__close" onClick={() => setDismissed(true)} type="button">
        ×
      </button>
    </div>
  )
}
