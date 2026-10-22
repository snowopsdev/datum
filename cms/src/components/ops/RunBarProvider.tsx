'use client'

import React from 'react'

import { GlobalRunBar } from './GlobalRunBar'
import { RuntimeBanner } from './RuntimeBanner'
import { SkipToContent } from './SkipToContent'

/**
 * Mounts the run bar once, for the whole admin.
 *
 * A Payload provider is the only slot that wraps every admin route — the header
 * and nav slots are per-view, and the bar has to survive navigation to be worth
 * having. It renders children untouched and adds one fixed-position sibling.
 * The skip link is mounted first so it is the first tab stop on every page.
 */
export function RunBarProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipToContent />
      <RuntimeBanner />
      {children}
      <GlobalRunBar />
    </>
  )
}
