'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import './ops.css'

type NavLink = {
  label: string
  href: string
  /**
   * Highlight only on this exact path. The setup hub is a parent of four
   * editors, and without this every one of them lights up two links.
   */
  exact?: boolean
}

type Section = { label: string; links: NavLink[]; collapsed?: boolean }

const SECTIONS: Section[] = [
  {
    label: 'Content',
    links: [
      { label: 'New content', href: '/admin/ops/new' },
      { label: 'Content', href: '/admin/ops/content' },
      { label: 'Reports', href: '/admin/ops/reports' },
    ],
  },
  {
    label: 'Setup',
    links: [
      { label: 'Setup checklist', href: '/admin/ops/setup', exact: true },
      { label: 'Workspace', href: '/admin/ops/setup/workspace' },
      { label: 'Audiences', href: '/admin/ops/setup/audiences' },
      { label: 'Positioning', href: '/admin/ops/setup/positioning' },
      { label: 'Evidence bank', href: '/admin/ops/setup/evidence' },
      { label: 'Brand voice', href: '/admin/ops/governance/brand-voice' },
      { label: 'Templates', href: '/admin/ops/templates' },
      { label: 'Sources', href: '/admin/collections/evidence-sources' },
      { label: 'Source review', href: '/admin/ops/governance/source-review' },
      { label: 'Scoring policy', href: '/admin/globals/information-gain-policy' },
      { label: 'Models', href: '/admin/globals/llm-settings' },
    ],
  },
  {
    // The raw collections. Useful, rarely, so folded by default.
    label: 'Records',
    collapsed: true,
    links: [
      { label: 'Article records', href: '/admin/collections/articles' },
      { label: 'Article audits', href: '/admin/collections/article-audit' },
      { label: 'Governance audits', href: '/admin/collections/governance-audit' },
      { label: 'Cost logs', href: '/admin/collections/cost-log' },
      { label: 'Media', href: '/admin/collections/media' },
      { label: 'Users', href: '/admin/collections/users' },
    ],
  },
]

export function ExtraOpsNavLinks() {
  const pathname = usePathname()
  const isActive = (link: NavLink) =>
    pathname === link.href || (!link.exact && pathname.startsWith(`${link.href}/`))

  return (
    <div className="datum-ops-nav">
      {SECTIONS.map((section) => {
        const links = section.links.map((link) => (
          <Link
            aria-current={isActive(link) ? 'page' : undefined}
            className={`datum-ops-nav__link${isActive(link) ? ' is-active' : ''}`}
            href={link.href}
            key={link.href}
            prefetch={false}
          >
            {link.label}
          </Link>
        ))
        if (section.collapsed) {
          // Open when the current page lives inside it, so the active link is visible.
          const open = section.links.some((l) => isActive(l))
          return (
            <details className="datum-ops-nav__section datum-ops-nav__section--fold" key={section.label} open={open}>
              <summary className="datum-ops-nav__label">{section.label}</summary>
              {links}
            </details>
          )
        }
        return (
          <div className="datum-ops-nav__section" key={section.label}>
            <div className="datum-ops-nav__label">{section.label}</div>
            {links}
          </div>
        )
      })}
    </div>
  )
}
