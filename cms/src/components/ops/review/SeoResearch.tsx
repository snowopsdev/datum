'use client'

import React from 'react'

import type { BoardArticle } from '../articleStatus'

/**
 * The meta description and the research hint, once a body exists.
 *
 * Withheld until then on purpose: without a draft these two are all the body
 * block has to show, and printing them twice read as two different findings.
 */
export function SeoResearch({ article, bodyHtml }: { article: BoardArticle; bodyHtml: string }) {
  if (!(article.metaDescription || article.researchHint) || !bodyHtml) return null
  return (
    <div className="datum-ops__prose" style={{ marginTop: 12 }}>
      <h3>SEO / research</h3>
      {article.metaDescription ? <p>{article.metaDescription}</p> : null}
      {article.researchHint && article.researchHint !== article.metaDescription ? (
        <p>{article.researchHint}</p>
      ) : null}
    </div>
  )
}
