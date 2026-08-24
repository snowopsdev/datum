'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import './ops.css'

export function ExtraOpsNavLinks() {
  const pathname = usePathname()
  const sections = [
    {
      label: 'Governance',
      links: [
        { label: 'Templates', href: '/admin/ops/templates' },
        { label: 'Users', href: '/admin/collections/users' },
      ],
    },
    {
      label: 'Operations',
      links: [
        { label: 'Article board', href: '/admin/ops/articles' },
        { label: 'Article records', href: '/admin/collections/articles' },
        { label: 'Media library', href: '/admin/collections/media' },
        { label: 'Reports', href: '/admin/ops/reports' },
      ],
    },
    {
      label: 'Validation',
      links: [
        { label: 'Cost logs', href: '/admin/collections/cost-log' },
        { label: 'Article audits', href: '/admin/collections/article-audit' },
      ],
    },
  ]

  return (
    <div className="datum-ops-nav">
      {sections.map((section) => (
        <div className="datum-ops-nav__section" key={section.label}>
          <div className="datum-ops-nav__label">{section.label}</div>
          {section.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`datum-ops-nav__link${active ? ' is-active' : ''}`}
                href={link.href}
                key={link.href}
                prefetch={false}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}
