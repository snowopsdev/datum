import type { BriefIcpOption } from '../BriefEditor'
import type {
  BoardArticle,
  InformationGainRunView,
  TemplateOption,
} from '../articleStatus'
import type { ReviewAction } from './useReviewAction'

/**
 * The one prop shape every status panel takes.
 *
 * Uniform on purpose: `PANEL_FOR_STATUS` picks a component by status, so the
 * page cannot know which of these a given panel will read. Panels own their
 * own form state (notes, justification, the schedule input) because exactly
 * one of them renders at a time — a status is a single value.
 */
export type PanelProps = {
  action: ReviewAction
  article: BoardArticle
  editHref: string
  /** Active audiences the brief may switch between. */
  icps: BriefIcpOption[]
  mode: 'mock' | 'live'
  run: InformationGainRunView | null
  /** Whether `article.informationGain` still points at `run`. */
  runIsCurrent: boolean
  /**
   * Whether the article's `publishAt` had already passed when the page was
   * rendered. Resolved on the server: "is this date in the past" is a reading
   * of the clock, and a component that takes one during render renders
   * differently on the server than it does a moment later in the browser.
   */
  scheduleExpired: boolean
  /**
   * The fields whose edit cost this article its score, when that edit is the
   * last thing that happened to it — otherwise null. A demotion out of
   * `verified` looks identical to a draft that was never scored, so without
   * this the reviewer has no way to tell a rule from a bug.
   */
  scoreInvalidatedBy: string | null
  templates: TemplateOption[]
}
