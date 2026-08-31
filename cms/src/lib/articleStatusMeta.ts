/**
 * The status machine's one declarative table, shared by the Payload collection
 * (select options), the ops UI (board/stepper metadata via
 * `components/ops/articleStatus.ts`), and the pipeline (stage pickup, via the
 * thin re-export in `pipeline/src/articleStatusMeta.ts`).
 *
 * This file replaced three hand-synced copies of the status list — the literal
 * options array in `collections/Articles.ts`, the registries in
 * `articleStatus.ts`, and the entry statuses the pipeline stages wait on —
 * which AGENTS.md used to guard with a "keep these aligned" convention.
 * Alignment with `pipeline/src/stages.ts` is now asserted by
 * `pipeline/test/statusAlignment.test.ts` instead of by convention.
 *
 * Must stay dependency-free: both workspaces import it, and the collection
 * config cannot pull in component or pipeline code.
 */

export const ARTICLE_STATUSES = [
  'topic_selected',
  'brief_review',
  'researched',
  'drafted',
  'qa_passed',
  'verified',
  'needs_review',
  'blocked',
  'needs_revision',
  'approved',
  'published',
] as const

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

/**
 * The five stages a person thinks in. Every internal status maps to exactly
 * one, so a status can never mean one thing on one screen and another
 * elsewhere.
 */
export const CONTENT_STAGES = ['research', 'brief', 'writing', 'review', 'publish'] as const
export type ContentStage = (typeof CONTENT_STAGES)[number]

/**
 * Who has to do something for a card to move.
 *
 * `run` — a pipeline run advances it; nobody needs to read it first.
 * `you`  — it is waiting on a human decision and a run will not touch it.
 * `done` — terminal.
 */
export type ColumnOwner = 'run' | 'you' | 'done'

/** The pipeline's stage names, in run order (`pipeline/src/stages.ts` walks them). */
export const PIPELINE_STAGE_NAMES = ['research', 'generate', 'qa', 'informationGain'] as const
export type PipelineStageName = (typeof PIPELINE_STAGE_NAMES)[number]

/** Board copy for "what happens next" on statuses a run picks up. */
export const PIPELINE_STAGE_LABEL: Record<PipelineStageName, string> = {
  research: 'Research',
  generate: 'Writing the draft',
  qa: 'QA checks',
  informationGain: 'Information-gain scoring',
}

export type StatusMeta = {
  stage: ContentStage
  owner: ColumnOwner
  /** Short state within the stage, e.g. "checks failed". */
  label: string
  /** The verb on the row's button when a person has to act; null otherwise. */
  action: string | null
  /**
   * The machine owns the article's content while it sits here: a run is about
   * to read or overwrite it, so human edits would be lost or would invalidate
   * work already paid for. Declarative for now; the enforcing gate lives with
   * its siblings in `articleReviewGate.ts` once added.
   */
  readOnly: boolean
  /** Which pipeline stage waits on this status; null when only a person moves it. */
  pickupStage: PipelineStageName | null
}

export const STATUS_META = {
  topic_selected: {
    stage: 'research',
    owner: 'run',
    label: 'researching what already ranks',
    action: null,
    readOnly: false,
    pickupStage: 'research',
  },
  brief_review: {
    stage: 'brief',
    owner: 'you',
    label: 'brief ready to approve',
    action: 'Review brief',
    readOnly: false,
    pickupStage: null,
  },
  researched: {
    stage: 'writing',
    owner: 'run',
    label: 'about to write',
    action: null,
    readOnly: false,
    pickupStage: 'generate',
  },
  drafted: {
    stage: 'writing',
    owner: 'run',
    label: 'running checks',
    action: null,
    readOnly: true,
    pickupStage: 'qa',
  },
  qa_passed: {
    stage: 'review',
    owner: 'run',
    label: 'scoring information gain',
    action: null,
    readOnly: true,
    pickupStage: 'informationGain',
  },
  verified: {
    stage: 'review',
    owner: 'you',
    label: 'passed every check',
    action: 'Approve',
    readOnly: false,
    pickupStage: null,
  },
  needs_review: {
    stage: 'review',
    owner: 'you',
    label: 'scoring wants your call',
    action: 'Decide',
    readOnly: false,
    pickupStage: null,
  },
  blocked: {
    stage: 'review',
    owner: 'you',
    label: 'scoring blocked it',
    action: 'Decide',
    readOnly: false,
    pickupStage: null,
  },
  needs_revision: {
    stage: 'review',
    owner: 'you',
    label: 'checks failed',
    action: 'See what failed',
    readOnly: false,
    pickupStage: null,
  },
  approved: {
    stage: 'publish',
    owner: 'you',
    label: 'signed off',
    action: 'Publish',
    readOnly: false,
    pickupStage: null,
  },
  published: {
    stage: 'publish',
    owner: 'done',
    label: 'live',
    action: null,
    readOnly: false,
    pickupStage: null,
  },
} as const satisfies Record<ArticleStatus, StatusMeta>

/**
 * Statuses a pipeline run advances, derived from the table at the type level
 * so adding a `pickupStage` automatically widens the union.
 */
export type RunnableStatus = {
  [K in ArticleStatus]: (typeof STATUS_META)[K]['pickupStage'] extends null ? never : K
}[ArticleStatus]
