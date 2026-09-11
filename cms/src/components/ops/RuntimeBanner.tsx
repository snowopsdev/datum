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
    blockers: string[]
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => void runtimeStatusAction().then(setStatus), 0)
    return () => clearTimeout(id)
  }, [])

  if (!status || status.mode !== 'live' || dismissed) return null
  if (status.blockers.length === 0) return null
  // `missing` gets the "set these variables" sentence; anything else the
  // evaluator raised (a selected model no provider serves, say) is already
  // phrased as an instruction, so it is printed as written.
  const other = status.blockers.filter((blocker) => !status.missing.includes(blocker))

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
      {other.map((blocker) => (
        <React.Fragment key={blocker}> {blocker}.</React.Fragment>
      ))}
      <button aria-label="Dismiss" className="datum-runtime__close" onClick={() => setDismissed(true)} type="button">
        ×
      </button>
    </div>
  )
}
