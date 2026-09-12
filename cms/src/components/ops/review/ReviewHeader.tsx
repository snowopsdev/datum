'use client'

import Link from 'next/link'
import React from 'react'

import { PipelineStepper } from '../PipelineStepper'
import {
  OWNER_LABEL,
  isStalled,
  STAGE_LABEL,
  stageOf,
  type BoardArticle,
} from '../articleStatus'

/** The back link, the stepper and the owner pill. */
export function ReviewHeader({
  article,
  activeRunIncludesArticle,
}: {
  article: BoardArticle
  activeRunIncludesArticle: boolean
}) {
  const stage = stageOf(article.status)
  const stalled = isStalled(article.status, activeRunIncludesArticle)
  return (
    <div className="datum-ops__header">
      <Link className="datum-ops__btn" href="/admin/ops/content" prefetch={false}>
        ← Content
      </Link>
      <div className="datum-ops__stage-header">
        <PipelineStepper current={stage} size="full" />
        {/* Stalled wears the Needs-you colour: nothing moves until a person
            presses Run, which is the definition of work waiting on them. */}
        <span
          className={`datum-content__owner datum-content__owner--${stalled ? 'stalled' : stage.owner}`}
        >
          {stalled ? 'Stalled' : OWNER_LABEL[stage.owner]} · {STAGE_LABEL[stage.stage]}:{' '}
          {stage.label}
        </span>
      </div>
    </div>
  )
}

/** The title line and its subtitle: keyword, template, audience and spend. */
export function ReviewTitle({ article }: { article: BoardArticle }) {
  return (
    <>
      <h1>{article.title || article.keyword}</h1>
      <p className="datum-ops__sub">
        {article.keyword}
        {article.templateName ? ` · ${article.templateName}` : ''}
        {article.icpName ? ` · for ${article.icpName}` : ''}
        {article.totalCostUsd != null ? ` · $${article.totalCostUsd.toFixed(2)}` : ''}
      </p>
    </>
  )
}
