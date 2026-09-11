'use client'

import React from 'react'

import type { BriefIcpOption } from './BriefEditor'
import { scoreInvalidationNotice, type AuditSummary } from './auditTypes'
import type { BoardArticle, InformationGainRunView, TemplateOption } from './articleStatus'
import { PANEL_FOR_STATUS } from './review'
import { ArticleBody } from './review/ArticleBody'
import { AuditTrail } from './review/AuditTrail'
import { ReviewHeader, ReviewTitle } from './review/ReviewHeader'
import { Scorecard } from './review/Scorecard'
import { SeoResearch } from './review/SeoResearch'
import { useReviewAction } from './review/useReviewAction'
import './ops.css'

type Props = {
  article: BoardArticle
  /**
   * Whether a `queued`/`running` pipeline run lists this article. Without it a
   * runnable status is indistinguishable from work actually in flight, which
   * is what made the header claim "Datum is working" on pieces nothing was
   * touching.
   */
  activeRunIncludesArticle: boolean
  /**
   * Whether the article's `publishAt` had already passed when the page was
   * rendered. Resolved on the server rather than here: "is this date in the
   * past" is a reading of the clock, and a component that takes one during
   * render renders differently on the server than it does a moment later in
   * the browser. It goes stale the way every other value on this page goes
   * stale, and `router.refresh()` is what renews it.
   */
  scheduleExpired: boolean
  mode: 'mock' | 'live'
  /** Active audiences the brief may switch between. */
  icps: BriefIcpOption[]
  templates: TemplateOption[]
  editHref: string
  bodyHtml: string
  auditEntries: AuditSummary[]
  run: InformationGainRunView | null
}

/**
 * The review page: one article, the evidence for a decision on the left, the
 * controls for it on the right.
 *
 * Composition only. Every block here is a component in `review/`, and the
 * aside's controls are whichever panel `PANEL_FOR_STATUS` names — so "what can
 * a reviewer do at this status" is answered by one lookup table rather than by
 * nine status checks reading around each other's state.
 */
export function ArticleReview({
  article,
  activeRunIncludesArticle,
  scheduleExpired,
  mode,
  icps,
  templates,
  editHref,
  bodyHtml,
  auditEntries,
  run,
}: Props) {
  const action = useReviewAction()
  const summaryRun = article.informationGain?.run
  const summaryRunId = typeof summaryRun === 'number' ? summaryRun : (summaryRun?.id ?? null)
  const runIsCurrent = run != null && summaryRunId === run.id
  const StatusPanel = PANEL_FOR_STATUS[article.status]

  return (
    <div className="datum-ops">
      <ReviewHeader activeRunIncludesArticle={activeRunIncludesArticle} article={article} />

      <div className="datum-ops__review">
        <div className="datum-ops__review-main">
          <ReviewTitle article={article} />
          <ArticleBody article={article} bodyHtml={bodyHtml} icps={icps} mode={mode} />
          <SeoResearch article={article} bodyHtml={bodyHtml} />
          {run ? (
            <Scorecard isCurrent={runIsCurrent} run={run} summaryRunId={summaryRunId} />
          ) : null}
        </div>

        <aside className="datum-ops__review-aside">
          {action.error ? <p className="datum-ops__error">{action.error}</p> : null}
          {action.notice ? (
            <p className="datum-ops__ok" role="status">
              {action.notice}
            </p>
          ) : null}

          <StatusPanel
            action={action}
            article={article}
            editHref={editHref}
            icps={icps}
            mode={mode}
            run={run}
            runIsCurrent={runIsCurrent}
            scheduleExpired={scheduleExpired}
            scoreInvalidatedBy={scoreInvalidationNotice(article.status, auditEntries)}
            templates={templates}
          />

          <AuditTrail articleId={article.id} entries={auditEntries} />
        </aside>
      </div>
    </div>
  )
}
