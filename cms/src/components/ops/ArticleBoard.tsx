'use client'

import Link from 'next/link'
import React from 'react'

import type { BoardArticle } from './articleStatus'
import { STATUS_COLUMNS } from './articleStatus'
import './ops.css'

type Props = {
  articles: BoardArticle[]
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.max(0, Math.floor(ms / 3_600_000))
  if (hours < 1) return '<1h'
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function ArticleBoard({ articles }: Props) {
  const triage = articles.filter((a) => a.status === 'needs_revision').length
  const assign = articles.filter((a) => a.status === 'topic_selected').length
  const approve = articles.filter((a) => a.status === 'qa_passed').length
  const review = articles.filter(
    (a) => a.status === 'needs_review' || a.status === 'blocked',
  ).length

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Article board</h1>
        <div className="datum-ops__pills">
          <span className="datum-ops__pill">{triage} triage</span>
          <span className="datum-ops__pill">{assign} assign</span>
          <span className="datum-ops__pill">{approve} approve</span>
          <span className="datum-ops__pill">{review} review</span>
        </div>
      </div>
      <p className="datum-ops__lede">
        Actions only — open a card to assign, triage, or approve. Pipeline owns in-flight statuses.
      </p>
      <div className="datum-ops__board">
        {STATUS_COLUMNS.map((col) => {
          const items = articles.filter((a) => a.status === col.id)
          return (
            <div
              className={`datum-ops__column${col.actionable ? ' datum-ops__column--actionable' : ''}`}
              key={col.id}
            >
              <div className="datum-ops__column-head">
                <h2>{col.label}</h2>
                <span>{items.length}</span>
              </div>
              <div className="datum-ops__column-sub">{col.blurb}</div>
              <div className="datum-ops__column-body">
                {items.length === 0 ? (
                  <div className="datum-ops__empty">Nothing here</div>
                ) : (
                  items.map((a) => (
                    <Link
                      className="datum-ops__card"
                      href={`/admin/ops/articles/${a.id}`}
                      key={a.id}
                      prefetch={false}
                    >
                      <p className="datum-ops__card-title">{a.title || a.keyword}</p>
                      <p className="datum-ops__card-meta">
                        {a.templateName ?? 'No template'} · {ageLabel(a.updatedAt)}
                      </p>
                      <div className="datum-ops__row">
                        <span className={`datum-ops__status datum-ops__status--${a.status}`}>
                          {a.status.replace(/_/g, ' ')}
                        </span>
                        {a.totalCostUsd != null ? (
                          <span className="datum-ops__cost">${a.totalCostUsd.toFixed(2)}</span>
                        ) : null}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
