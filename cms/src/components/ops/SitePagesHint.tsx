'use client'

import Link from 'next/link'
import React from 'react'

/**
 * "The assistant has nothing of yours to read yet."
 *
 * Every setup assistant drafts from the workspace's own site pages, and with
 * none fetched it drafts from almost nothing while looking exactly the same.
 * One component so the stepper's steps and the evidence bank's own assist
 * panels say it in the same words and point at the same place.
 *
 * Renders nothing when the pages are there, or when the caller does not know
 * (`undefined`) — a screen that cannot answer the question must not answer it
 * wrongly.
 */
export function SitePagesHint({ fetchedAt }: { fetchedAt?: string | null }) {
  if (fetchedAt !== null) return null
  return (
    <p className="datum-ops__warn">
      No site pages fetched yet — the assistant drafts from your site. Fetch them on the{' '}
      <Link href="/admin/ops/setup/workspace" prefetch={false}>
        Workspace step
      </Link>
      .
    </p>
  )
}
