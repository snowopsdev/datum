'use client'

import React from 'react'

import { formatAuditTimestamp } from '../../articleStatus'
import { ArchiveAction, OpenInAdmin } from '../ArchiveAction'
import type { PanelProps } from '../types'

/** Live: where it went and when. */
export function PublishedPanel({ action, article, editHref }: PanelProps) {
  return (
    <div className="datum-ops__block">
      <h3>Live</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        {article.publishedAt
          ? `Published ${formatAuditTimestamp(article.publishedAt)}.`
          : 'Published; the time it went live was not recorded.'}
      </p>
      <div className="datum-ops__actions">
        {article.slug ? (
          <a
            className="datum-ops__btn datum-ops__btn--primary"
            href={`/articles/${article.slug}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            /articles/{article.slug}
          </a>
        ) : (
          <span className="datum-ops__hint">No slug on this piece, so it has no public address.</span>
        )}
        <ArchiveAction action={action} archived={article.archived} articleId={article.id} />
        <OpenInAdmin editHref={editHref} />
      </div>
    </div>
  )
}
