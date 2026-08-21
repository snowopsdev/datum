'use client'

import Link from 'next/link'
import React from 'react'

import './ops.css'

export function ExtraOpsNavLinks() {
  return (
    <div className="datum-ops-nav">
      <div className="datum-ops-nav__label">Ops</div>
      <Link className="datum-ops-nav__link" href="/admin/ops/articles" prefetch={false}>
        Article board
      </Link>
      <Link className="datum-ops-nav__link" href="/admin/ops/reports" prefetch={false}>
        Reports
      </Link>
      <Link className="datum-ops-nav__link" href="/admin/ops/templates" prefetch={false}>
        Templates
      </Link>
    </div>
  )
}
