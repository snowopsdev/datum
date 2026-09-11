'use client'

import { useNav, usePreferences } from '@payloadcms/ui'
import { PREFERENCE_KEYS } from 'payload/shared'
import React, { useEffect, useRef, useState } from 'react'

/**
 * Keeps the sidebar open on a normal laptop, and remembers when it is closed.
 *
 * Payload treats anything at or below 1440px as a small screen. `NavProvider`
 * forces the nav shut on mount and restores the operator's saved preference
 * only above that width, and `NavToggler` only *writes* the preference above
 * it (`@payloadcms/ui` Nav/context, Nav/NavToggler). On a 1280–1440 display —
 * most laptops — that leaves the one navigation this product has hidden behind
 * a hamburger on every load, and a close that no reload remembers.
 *
 * So this does both halves for that band: re-open once after Payload has
 * finished deciding, then persist each later toggle under the same `nav` key
 * Payload reads, so an operator who closes the sidebar finds it closed next
 * time. Above 1440 Payload already does all of this and we stay out of the
 * way; below 1280 the nav is a modal, where "open" is not a preference.
 */
const DESKTOP_MIN_WIDTH = 1280
/** `$breakpoint-l-width`: at or below this, Payload stops managing the preference. */
const PAYLOAD_LARGE_BREAKPOINT = 1440

const inPersistBand = () =>
  window.innerWidth >= DESKTOP_MIN_WIDTH && window.innerWidth <= PAYLOAD_LARGE_BREAKPOINT

export function NavOpener({ children }: { children: React.ReactNode }) {
  const { hydrated, navOpen, setNavOpen } = useNav()
  const { getPreference, setPreference } = usePreferences()
  const applied = useRef(false)
  const [settled, setSettled] = useState(false)
  /** What the stored preference already says, so we only write real changes. */
  const persisted = useRef<boolean | null>(null)
  const lastWidth = useRef(0)

  useEffect(() => {
    // `hydrated` flips in the same effect that forces the nav shut, so waiting
    // on it puts this after Payload's own decision rather than before it.
    if (!hydrated || applied.current) return
    applied.current = true
    let cancelled = false
    void (async () => {
      const preference = await getPreference<{ open?: boolean } | null>(PREFERENCE_KEYS.NAV)
      if (cancelled) return
      const stored = preference?.open
      const shouldOpen = stored !== false && window.innerWidth >= DESKTOP_MIN_WIDTH
      if (shouldOpen) setNavOpen(true)
      // Seed from what the nav now shows, so settling never writes by itself.
      persisted.current = shouldOpen ? true : (stored ?? false)
      lastWidth.current = window.innerWidth
      setSettled(true)
    })()
    return () => {
      cancelled = true
    }
  }, [getPreference, hydrated, setNavOpen])

  useEffect(() => {
    if (!settled || !inPersistBand()) return
    // A breakpoint crossing makes Payload close the nav on its own. That is
    // the window changing size, not the operator choosing anything, so it is
    // not a preference — note the new width and wait for a real toggle.
    if (window.innerWidth !== lastWidth.current) {
      lastWidth.current = window.innerWidth
      return
    }
    if (persisted.current === navOpen) return
    persisted.current = navOpen
    // `merge` because the same key also holds the nav group collapse state.
    void setPreference(PREFERENCE_KEYS.NAV, { open: navOpen }, true)
  }, [navOpen, setPreference, settled])

  return <>{children}</>
}
