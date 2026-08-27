'use client'

import React, { useEffect, useState } from 'react'

import { runtimeStatusAction } from './firstRunActions'
import './ops.css'

/**
 * For whoever deploys this, not for editors: live mode with keys missing.
 *
 * It used to be an onboarding gate, which put an environment problem in front
 * of a content person who could not fix it. Now it is a banner that names the
 * variables and otherwise stays out of the way. Dismissed per session.
 */
export function RuntimeBanner() {
  const [status, setStatus] = useState<{ mode: 'mock' | 'live'; missing: string[] } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => void runtimeStatusAction().then(setStatus), 0)
    return () => clearTimeout(id)
  }, [])

  if (!status || status.mode !== 'live' || status.missing.length === 0 || dismissed) return null

  return (
    <div className="datum-runtime" role="status">
      <strong>Live providers are not fully configured.</strong> Runs will fail until whoever deploys
      this sets <code>{status.missing.join('</code>, <code>')}</code>.
      <button aria-label="Dismiss" className="datum-runtime__close" onClick={() => setDismissed(true)} type="button">
        ×
      </button>
    </div>
  )
}
