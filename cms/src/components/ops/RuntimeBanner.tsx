'use client'

import React, { useEffect, useState } from 'react'

import { runtimeStatusAction } from './tenantActions'
import './ops.css'

/**
 * For whoever deploys this, not for editors: live mode with keys missing.
 *
 * It used to be an onboarding gate, which put an environment problem in front
 * of a content person who could not fix it. Now it is a banner that names the
 * variables and otherwise stays out of the way.
 *
 * A missing key is not a notice you read once — every run fails until it is
 * set — so that version has no dismiss button. Anything else the evaluator
 * raised is advice, and advice can be dismissed for the session.
 */
export function RuntimeBanner() {
  const [status, setStatus] = useState<{
    mode: 'mock' | 'live'
    missing: string[]
    problems: string[]
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => void runtimeStatusAction().then(setStatus), 0)
    return () => clearTimeout(id)
  }, [])

  if (!status || status.mode !== 'live') return null
  // `missing` holds environment variable names; `problems` holds sentences the
  // evaluator already phrased as instructions. Kept apart by readiness, so
  // neither list has to be reconstructed by subtracting the other.
  const { missing, problems } = status
  if (missing.length === 0 && problems.length === 0) return null
  if (missing.length === 0 && dismissed) return null

  return (
    <div className="datum-runtime" role="status">
      {missing.length > 0 ? (
        <span>
          Live providers are not configured. Runs will fail until{' '}
          {missing.map((name, index) => (
            <React.Fragment key={name}>
              {index > 0 && ', '}
              <code>{name}</code>
            </React.Fragment>
          ))}{' '}
          {missing.length === 1 ? 'is' : 'are'} set in <code>cms/.env</code>.
        </span>
      ) : (
        <strong>Live providers are not fully configured.</strong>
      )}
      {problems.map((problem) => (
        <React.Fragment key={problem}> {problem}.</React.Fragment>
      ))}
      {missing.length > 0 ? null : (
        <button
          aria-label="Dismiss"
          className="datum-runtime__close"
          onClick={() => setDismissed(true)}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  )
}
