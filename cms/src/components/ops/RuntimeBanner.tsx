'use client'

import React, { useEffect, useState } from 'react'

import { runtimeStatusAction } from './tenantActions'
import './ops.css'

/**
 * For whoever deploys this, not for editors: live mode that cannot run.
 *
 * It used to be an onboarding gate, which put an environment problem in front
 * of a content person who could not fix it. Now it is a banner that names what
 * is wrong and otherwise stays out of the way.
 *
 * Nothing here can be dismissed. Every blocker readiness raises in live mode
 * is fatal — a missing key, an `.env.example` placeholder still in place, a
 * model no provider serves — and each one fails every run until somebody
 * fixes it, so none of them is a notice you read once. `ready` is the test for
 * that rather than "are any variables missing": a placeholder domain names no
 * missing variable and fails runs exactly the same.
 */
export function RuntimeBanner() {
  const [status, setStatus] = useState<{
    mode: 'mock' | 'live'
    ready: boolean
    missing: string[]
    problems: string[]
  } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => void runtimeStatusAction().then(setStatus), 0)
    return () => clearTimeout(id)
  }, [])

  if (!status || status.mode !== 'live' || status.ready) return null
  // `missing` holds environment variable names; `problems` holds sentences the
  // evaluator already phrased as instructions. Kept apart by readiness, so
  // neither list has to be reconstructed by subtracting the other.
  const { missing, problems } = status
  if (missing.length === 0 && problems.length === 0) return null

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
        <strong>Live runs cannot start yet.</strong>
      )}
      {problems.map((problem) => (
        <React.Fragment key={problem}> {problem}.</React.Fragment>
      ))}
    </div>
  )
}
