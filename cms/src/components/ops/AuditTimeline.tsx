'use client'

import React from 'react'

import type { AuditTimelineEntry } from './articleStatus'

type Props = {
  entries: AuditTimelineEntry[]
  title: string
  blurb: string
  emptyText: string
}

/** Append-only audit timeline; same markup as the article review audit trail. */
export function AuditTimeline({ entries, title, blurb, emptyText }: Props) {
  return (
    <section className="datum-ops__audit" aria-labelledby="audit-trail-heading">
      <div className="datum-ops__audit-head">
        <div>
          <h2 id="audit-trail-heading">{title}</h2>
          <p>{blurb}</p>
        </div>
        <span>{entries.length} events</span>
      </div>
      {entries.length === 0 ? (
        <p className="datum-ops__empty">{emptyText}</p>
      ) : (
        <ol className="datum-ops__timeline">
          {entries.map((entry) => (
            <li key={entry.id} className="datum-ops__timeline-item">
              <div className="datum-ops__timeline-marker" aria-hidden="true" />
              <div className="datum-ops__timeline-content">
                <div className="datum-ops__timeline-title">
                  <strong>{entry.summary}</strong>
                  <time dateTime={entry.createdAt}>{entry.createdAtLabel}</time>
                </div>
                <div className="datum-ops__timeline-meta">
                  <span>{entry.event}</span>
                  <span>{entry.actorType}</span>
                  <span>{entry.actor}</span>
                  {entry.fromStatus || entry.toStatus ? (
                    <span>
                      {entry.fromStatus ?? 'new'} → {entry.toStatus ?? 'unchanged'}
                    </span>
                  ) : null}
                </div>
                {entry.details != null ? (
                  <details className="datum-ops__audit-details">
                    <summary>Evidence</summary>
                    <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
