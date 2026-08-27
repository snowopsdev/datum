'use client'

import React from 'react'

import { GlobalRunBar } from './GlobalRunBar'

/**
 * Mounts the run bar once, for the whole admin.
 *
 * A Payload provider is the only slot that wraps every admin route — the header
 * and nav slots are per-view, and the bar has to survive navigation to be worth
 * having. It renders children untouched and adds one fixed-position sibling.
 */
export function RunBarProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GlobalRunBar />
    </>
  )
}
