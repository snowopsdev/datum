'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect, useRef } from 'react'

import './ops.css'

/**
 * Ops views mark their wrapper `#ops-main`. Any other admin screen (collection
 * lists, document edit, globals) has no such wrapper, so fall back to Payload's
 * own: the edit view's `<main>`, then the default template's content column.
 */
const FALLBACK_SELECTORS = ['main', '.template-default__wrap']

const findTarget = (): HTMLElement | null =>
  document.getElementById('ops-main') ??
  FALLBACK_SELECTORS.map((selector) => document.querySelector<HTMLElement>(selector)).find(
    Boolean,
  ) ??
  null

/**
 * "Skip to content", the first tab stop on every admin page that has content to
 * skip to. Hidden until focused. A hash link alone would not move focus into
 * the target (and the target is not natively focusable), so the click moves it.
 */
export function SkipToContent() {
  const pathname = usePathname()
  const ref = useRef<HTMLAnchorElement>(null)

  // Re-check per route: the login screen has no template, the rest do. Hidden
  // (display: none) means out of the tab order, so it is not a dead first stop.
  useEffect(() => {
    if (ref.current) ref.current.hidden = findTarget() === null
  }, [pathname])

  return (
    <a
      ref={ref}
      className="datum-skip-link"
      href="#ops-main"
      onClick={(event) => {
        const target = findTarget()
        if (!target) return
        event.preventDefault()
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
        target.focus()
        target.scrollIntoView({ block: 'start' })
      }}
    >
      Skip to content
    </a>
  )
}
