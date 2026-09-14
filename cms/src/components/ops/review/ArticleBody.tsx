'use client'

import React from 'react'

import type { BriefIcpOption } from '../BriefEditor'
import type { BoardArticle } from '../articleStatus'
import { BriefMain } from './panels/BriefPanel'

/**
 * The draft, or the brief editor in its place.
 *
 * The prose block is `hidden` rather than unmounted at `brief_review` so the
 * body is still in the document for anything reading it, exactly as before.
 */
export function ArticleBody({
  article,
  bodyHtml,
  icps,
  mode,
}: {
  article: BoardArticle
  bodyHtml: string
  icps: BriefIcpOption[]
  mode: 'mock' | 'live'
}) {
  const isBriefReview = article.status === 'brief_review'
  return (
    <>
      {isBriefReview ? <BriefMain article={article} icps={icps} mode={mode} /> : null}
      <div className="datum-ops__prose" hidden={isBriefReview}>
        <h3>Article body</h3>
        {bodyHtml ? (
          <div className="datum-ops__body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <p>
            {article.metaDescription ||
              article.researchHint ||
              (article.status === 'topic_selected'
                ? 'Nothing written yet. Research runs first, then you approve a brief.'
                : 'No body yet.')}
          </p>
        )}
      </div>
    </>
  )
}
