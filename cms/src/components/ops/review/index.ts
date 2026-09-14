import type React from 'react'

import type { ArticleStatus } from '../../../lib/articleStatusMeta'
import { ApprovedPanel } from './panels/ApprovedPanel'
import { ArchivedPanel } from './panels/ArchivedPanel'
import { BriefPanel } from './panels/BriefPanel'
import { NeedsRevisionPanel } from './panels/NeedsRevisionPanel'
import { PublishedPanel } from './panels/PublishedPanel'
import { ReviewDecisionPanel } from './panels/ReviewDecisionPanel'
import { RunNextStagePanel } from './panels/RunNextStagePanel'
import { TopicSelectedPanel } from './panels/TopicSelectedPanel'
import { VerifiedPanel } from './panels/VerifiedPanel'
import type { PanelProps } from './types'

export type { PanelProps } from './types'
export type { ReviewAction } from './useReviewAction'

/**
 * The one panel each status gets in the review aside.
 *
 * A total record rather than a chain of `status === …` blocks: adding a status
 * to `ARTICLE_STATUSES` now fails the typecheck here until somebody says what
 * a reviewer is meant to do with it, which is the question the old chain let
 * people skip — a new status simply rendered no controls at all.
 */
export const PANEL_FOR_STATUS: Record<ArticleStatus, React.ComponentType<PanelProps>> = {
  topic_selected: TopicSelectedPanel,
  brief_review: BriefPanel,
  researched: RunNextStagePanel,
  drafted: RunNextStagePanel,
  qa_passed: RunNextStagePanel,
  verified: VerifiedPanel,
  needs_review: ReviewDecisionPanel,
  blocked: ReviewDecisionPanel,
  needs_revision: NeedsRevisionPanel,
  approved: ApprovedPanel,
  published: PublishedPanel,
}

/**
 * The panel for an article: its status's, unless it is archived, in which case
 * the read-only one. Archived is a flag beside the status rather than a status
 * of its own, so it cannot live in the record above — and it has to win over
 * the status, because every control a status panel offers is one the server
 * now refuses for an archived piece.
 *
 * A record keyed by `panelKeyFor(article)` rather than a function returning a
 * component: React's compiler lint reads a component-valued call in render as
 * creating one, while a lookup by a string it can see is the shape it accepts.
 */
export const PANEL_FOR_KEY: Record<ArticleStatus | 'archived', React.ComponentType<PanelProps>> = {
  ...PANEL_FOR_STATUS,
  archived: ArchivedPanel,
}

export function panelKeyFor(article: {
  status: ArticleStatus
  archived: boolean
}): ArticleStatus | 'archived' {
  return article.archived ? 'archived' : article.status
}

/** Test seam: the component `ArticleReview` will render for this article. */
export function panelForArticle(article: {
  status: ArticleStatus
  archived: boolean
}): React.ComponentType<PanelProps> {
  return PANEL_FOR_KEY[panelKeyFor(article)]
}
