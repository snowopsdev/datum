import type React from 'react'

import type { ArticleStatus } from '../../../lib/articleStatusMeta'
import { ApprovedPanel } from './panels/ApprovedPanel'
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
