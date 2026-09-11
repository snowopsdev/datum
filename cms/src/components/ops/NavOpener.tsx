'use client'

import { useNav, usePreferences } from '@payloadcms/ui'
import { PREFERENCE_KEYS } from 'payload/shared'
import React, { useEffect, useRef } from 'react'

/**
 * Keeps the sidebar open on a normal laptop.
 *
 * Payload treats anything at or below 1440px as a small screen: `NavProvider`
 * forces the nav shut on mount and only restores the operator's saved
 * preference above that width (`@payloadcms/ui` Nav/context). On a 1280–1440
 * display — most laptops — that means the one navigation this product has
 * starts hidden behind a hamburger on every load.
 *
 * So we re-open it once, after Payload has finished deciding. Once only: a
 * later close is the operator's, and this must not fight it. An explicit
 * `open: false` in the stored preference is honoured at every width.
 */
const DESKTOP_MIN_WIDTH = 1280

export function NavOpener({ children }: { children: React.ReactNode }) {
  const { hydrated, setNavOpen } = useNav()
  const { getPreference } = usePreferences()
  const applied = useRef(false)

  useEffect(() => {
    // `hydrated` flips in the same effect that forces the nav shut, so waiting
    // on it puts this after Payload's own decision rather than before it.
    if (!hydrated || applied.current) return
    applied.current = true
    let cancelled = false
    void (async () => {
      const preference = await getPreference<{ open?: boolean } | null>(PREFERENCE_KEYS.NAV)
      if (cancelled || preference?.open === false) return
      if (window.innerWidth >= DESKTOP_MIN_WIDTH) setNavOpen(true)
    })()
    return () => {
      cancelled = true
    }
  }, [getPreference, hydrated, setNavOpen])

  return <>{children}</>
}
