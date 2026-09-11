'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { activeRunIncludesArticle } from '@/lib/activeRuns'
import { CLEARED_INFORMATION_GAIN } from '@/lib/articleReviewGate'
import { ActivePipelineRunError } from '@/lib/createPipelineRun'
import { errorMessage } from '@/lib/errorMessage'
import { loadWorkspaceSetup } from '@/lib/loadWorkspaceReadiness'
import { gateRunReadiness, queueRunForArticles } from '@/lib/queueRunForArticles'
import { revalidatePublishedArticle } from '@/lib/revalidatePublishedArticle'
import type { Article } from '@/payload-types'

import { buildRegenerateRevisionNotes, type ArticleStatus } from './articleStatus'

/**
 * Nulls every `informationGain` key. The group has `access.update: () =>
 * false` (see `Articles.ts`) so the scoring stage's own write — the Local
 * API's default `overrideAccess: true` — is the only caller that can ever set
 * a decision; an ordinary `overrideAccess: false` update, like every other
 * action in this file, is refused for that group even when clearing it back
 * to null. `resetToDraftedAction`, `regenerateArticleAction`, and
 * `sendBackAction` all send an article back to be reworked (or, for
 * `sendBackAction`, back for revision on editorial grounds even when
 * information-gain passed it), and a stale decision left on it would make the
 * board show a scored verdict for a draft nobody has scored — or reworked —
 * since. All three calls pass `overrideAccess: true`, and only to reach this
 * same fixed, all-null payload. `gateVerifiedStatus`/`gateReviewOverride` are
 * `beforeChange` hooks, not access checks, so they still run and still guard
 * `status` even with `overrideAccess: true`.
 *
 * The shape itself lives in `articleReviewGate.ts` because
 * `invalidateStaleInformationGain` clears the group to exactly the same nulls
 * when a content edit invalidates a decision; two hand-maintained copies would
 * drift the first time the group gains a field.
 */
const NULL_INFORMATION_GAIN = CLEARED_INFORMATION_GAIN

const NULL_QA_RESULTS = {
  structural: { passed: null, violations: null },
  factCheck: { passed: null, notes: null, sources: null },
  qualitativeReview: {
    passed: null,
    notes: null,
    voiceScore: null,
    voiceNotes: null,
    notTraitViolations: null,
  },
} as const

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) {
    throw new Error('Unauthorized')
  }
  return { payload, user }
}

function revalidateOps(articleId?: number | string) {
  revalidatePath('/admin/ops/articles')
  revalidatePath('/admin/ops/content')
  revalidatePath('/admin/ops/reports')
  if (articleId != null) {
    revalidatePath(`/admin/ops/articles/${articleId}`)
  }
}

function auditContext(
  user: { email?: string | null; id: number | string },
  event: string,
  summary: string,
  details?: Record<string, unknown>,
) {
  return {
    articleAudit: {
      actor: typeof user.email === 'string' ? user.email : String(user.id),
      actorType: 'user' as const,
      event,
      summary,
      details,
    },
  }
}

/**
 * What a reviewer action did about the run that has to follow it.
 *
 * `queued: false` is a normal outcome, not a failure: the article has been
 * updated either way, and `reason` says what stopped the run so the page can
 * show it instead of leaving the reviewer to wonder why nothing is moving.
 */
export type QueuedRunResult = { queued: boolean; runId?: string; reason?: string }

/**
 * What an article became.
 *
 * Approve and publish used to end in a redirect to the board, so the page that
 * asked never needed an answer. The reviewer now stays on the article and the
 * page re-renders in place, which means the panel they see next is chosen from
 * the status the write actually landed — not from the one the button was
 * named after, which a `beforeChange` gate is free to have overridden.
 */
export type StatusResult = { status: ArticleStatus }

/**
 * `queueRun: false` for a caller that will start the run itself (or wants none
 * at all); `confirmLiveCost` for one that has told the reviewer what a live run
 * costs and had them agree. Neither is needed in the ordinary mock-mode case.
 */
export type ReviewActionOptions = { queueRun?: boolean; confirmLiveCost?: boolean }

/**
 * Send an article that has just been reworked straight back into the pipeline.
 *
 * Resetting a draft or asking for a regeneration used to leave the article
 * sitting in a runnable status with nothing running: the reviewer had to go
 * back to the board, find it, tick it and press Run. This closes that gap, and
 * deliberately reuses `queueRunForArticles` so a run queued from an article
 * page is the same run, with the same refusals, as one queued from the board.
 *
 * The readiness gate is `gateRunReadiness`, the same one the board asks, so a
 * reviewer and an operator are told the same thing about the same workspace.
 * Every refusal comes back as `reason`; nothing here throws, because the
 * update it follows has already succeeded and reporting the whole action as
 * failed would be a lie about the part that worked.
 */
async function queueRunAfterRework(
  payload: Awaited<ReturnType<typeof requireUser>>['payload'],
  user: Awaited<ReturnType<typeof requireUser>>['user'],
  article: Article,
  options?: ReviewActionOptions,
): Promise<QueuedRunResult> {
  if (options?.queueRun === false) return { queued: false }

  const { readiness } = await loadWorkspaceSetup(payload)
  const notReady = gateRunReadiness(readiness, options?.confirmLiveCost)
  if (notReady) return { queued: false, reason: notReady }

  try {
    const { runId } = await queueRunForArticles(payload, user, [article], readiness)
    return { queued: true, runId }
  } catch (error) {
    if (error instanceof ActivePipelineRunError) return { queued: false, reason: error.message }
    return { queued: false, reason: errorMessage(error, 'Could not start a run for this article.') }
  }
}

/** A `maxDepth: 0` relationship is an id, but a populated row may still arrive. */
function relationshipId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

/**
 * The information-gain run the article's *current* decision came from, or null
 * when it carries none.
 *
 * Resolved through `informationGain.run` rather than by taking the newest row
 * for the article, because the two diverge exactly when it matters. Every
 * send-back action nulls `informationGain`, and `invalidateStaleInformationGain`
 * nulls it again whenever scored content is edited, so an article without a
 * pointer has no live verdict — while its newest run row still sits there
 * describing a draft that has since been thrown away. Reading that row would
 * make the next regeneration chase a problem the current draft may not even
 * have, in preference to the QA failures it actually does have.
 *
 * `find` rather than `findByID` so a run row deleted since it was linked is a
 * missing verdict rather than a 404 in the reviewer's face.
 */
async function currentInformationGainRun(
  payload: Awaited<ReturnType<typeof requireUser>>['payload'],
  article: { informationGain?: { run?: unknown } | null },
  user: Awaited<ReturnType<typeof requireUser>>['user'],
) {
  const runId = relationshipId(article.informationGain?.run)
  if (runId === null) return null
  const { docs } = await payload.find({
    collection: 'information-gain-runs',
    where: { id: { equals: runId } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
  })
  return docs[0] ?? null
}

export async function assignTemplateAction(articleId: number, templateId: number) {
  const { payload, user } = await requireUser()
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: { template: templateId },
    context: auditContext(user, 'template_assigned', 'Template assigned', { templateId }),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
}

export async function resetToDraftedAction(
  articleId: number,
  reviewNotes?: string,
  options?: ReviewActionOptions,
): Promise<QueuedRunResult> {
  const { payload, user } = await requireUser()
  const updated = await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      status: 'drafted' satisfies ArticleStatus,
      reviewNotes: reviewNotes?.trim() || null,
      reviewedBy: typeof user.email === 'string' ? user.email : String(user.id),
      qaResults: NULL_QA_RESULTS,
      informationGain: NULL_INFORMATION_GAIN,
    },
    context: auditContext(user, 'revision_reset', 'Article reset to drafted', {
      reviewNotes: reviewNotes?.trim() || null,
    }),
    user,
    // See NULL_INFORMATION_GAIN above — required to clear the informationGain group.
    overrideAccess: true,
  })
  revalidateOps(articleId)
  return queueRunAfterRework(payload, user, updated, options)
}

export async function approveArticleAction(
  articleId: number,
  reviewNotes?: string,
): Promise<StatusResult> {
  const { payload, user } = await requireUser()
  const approved = await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      status: 'approved' satisfies ArticleStatus,
      reviewNotes: reviewNotes?.trim() || null,
      reviewedBy: typeof user.email === 'string' ? user.email : String(user.id),
    },
    context: auditContext(user, 'article_approved', 'Article approved', {
      reviewNotes: reviewNotes?.trim() || null,
    }),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
  return { status: approved.status }
}

export async function publishArticleAction(
  articleId: number,
  reviewNotes?: string,
): Promise<StatusResult> {
  const { payload, user } = await requireUser()
  const published = await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      status: 'published' satisfies ArticleStatus,
      publishedAt: new Date().toISOString(),
      reviewNotes: reviewNotes?.trim() || null,
      reviewedBy: typeof user.email === 'string' ? user.email : String(user.id),
    },
    context: auditContext(user, 'article_published', 'Article published', {
      reviewNotes: reviewNotes?.trim() || null,
    }),
    user,
    overrideAccess: false,
  })
  revalidatePublishedArticle(published)
  revalidateOps(articleId)
  return { status: published.status }
}

/**
 * Parks an approved article for the `publish-due` job (`jobs/publishDue.ts`)
 * to publish when the time arrives.
 *
 * Two refusals, both about not letting the page display a promise nothing will
 * keep. A date in the past would sit there reading "Scheduled for…" while the
 * job — which selects on `publishAt <= now` — published it on its very next
 * tick, five minutes later, with no scheduling having meaningfully happened.
 * And the job only ever picks up `approved`, so a date written onto any other
 * status is inert: the field is deliberately allowed to survive status moves
 * as stored intent, but *setting* it somewhere it can never fire is the UI
 * lying rather than the field remembering.
 *
 * The stored value is normalised to an ISO instant. The control that feeds
 * this is a `datetime-local` input, which has no zone of its own, so the
 * conversion happens in the browser's zone and what is persisted is the
 * absolute moment the reviewer meant.
 */
export async function scheduleArticleAction(articleId: number, publishAt: string) {
  const { payload, user } = await requireUser()
  const when = new Date(publishAt)
  if (Number.isNaN(when.getTime())) {
    throw new Error('Pick a date and time to schedule this article.')
  }
  if (when.getTime() <= Date.now()) {
    throw new Error('Pick a time in the future to schedule this article.')
  }
  const article = await payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 0,
    overrideAccess: false,
    user,
  })
  if (article.status !== 'approved') {
    throw new Error('Only an approved article can be scheduled. Approve it first.')
  }
  const iso = when.toISOString()
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: { publishAt: iso },
    context: auditContext(user, 'publish_scheduled', 'Publish scheduled', { publishAt: iso }),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
  return { publishAt: iso }
}

/** Takes the date back off, leaving the article approved and unpublished. */
export async function unscheduleArticleAction(articleId: number) {
  const { payload, user } = await requireUser()
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: { publishAt: null },
    context: auditContext(user, 'publish_unscheduled', 'Publish schedule cleared'),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
}

/**
 * Takes a piece off the board without destroying it — see the `archived` field
 * on `Articles.ts` for why a hard delete is not on offer.
 *
 * Refused while a `queued`/`running` run lists the article, through the same
 * `activeRunIncludesArticle` the review page and the content list resolve
 * "Datum is working on this" with. A run mid-flight writes a status, a body
 * and cost rows onto an article the reviewer has just declared dead, and the
 * pipeline's own skip (`archived` articles are passed over at selection) does
 * not help a run that already picked this one up. Throwing is right here where
 * the queue helpers merely report: nothing was written, so there is no half of
 * the action to be honest about.
 */
export async function archiveArticleAction(articleId: number, reason?: string) {
  const { payload, user } = await requireUser()
  if (await activeRunIncludesArticle(payload, user, articleId)) {
    throw new Error(
      'This article is in an active run. Wait for the run to finish before archiving it.',
    )
  }
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: { archived: true },
    context: auditContext(user, 'article_archived', 'Article archived', {
      reason: reason?.trim() || null,
    }),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
}

export async function sendBackAction(articleId: number, reviewNotes: string) {
  const { payload, user } = await requireUser()
  const note = reviewNotes.trim() || 'Editor sent back for revision.'
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      status: 'needs_revision' satisfies ArticleStatus,
      reviewNotes: note,
      reviewedBy: typeof user.email === 'string' ? user.email : String(user.id),
      qaResults: {
        structural: { passed: true, violations: [] },
        factCheck: { passed: true, notes: 'OK' },
        qualitativeReview: {
          passed: false,
          notes: note,
          voiceScore: null,
          voiceNotes: null,
          notTraitViolations: [],
        },
      },
      informationGain: NULL_INFORMATION_GAIN,
    },
    context: auditContext(user, 'article_sent_back', 'Article sent back for revision', {
      reviewNotes: note,
    }),
    user,
    // See NULL_INFORMATION_GAIN above — required to clear the informationGain group.
    overrideAccess: true,
  })
  revalidateOps(articleId)
}

/**
 * Overrides a `needs_review`/`blocked` article straight to `verified` on the
 * reviewer's judgment rather than a `PASS` decision. `gateReviewOverride`
 * (`articleReviewGate.ts`) requires the submitted `reviewJustification` to be
 * different from whatever is already persisted — a stale justification left
 * over from an earlier review must not silently re-satisfy the gate — and
 * `gateVerifiedStatus` requires that same freshness before it will allow
 * `verified` for an article that never earned a `PASS`. Neither hook is
 * bypassed by anything here: this call uses `overrideAccess: false`, same as
 * every other reviewer action, and simply lets the hooks' `APIError` propagate
 * to the caller — catching and re-wrapping it would strip the message the
 * gate wrote explaining *why* the override was refused (e.g. a stale or
 * missing justification), which is the one thing the reviewer needs to see.
 */
export async function overrideReviewAction(articleId: number, justification: string) {
  const { payload, user } = await requireUser()
  const trimmed = justification.trim()
  if (!trimmed) {
    throw new Error('A justification is required to override this decision')
  }
  const article = await payload.findByID({
    collection: 'articles',
    id: articleId,
    overrideAccess: false,
    user,
  })
  const from = article.status
  const runId = (await currentInformationGainRun(payload, article, user))?.id ?? null
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      status: 'verified' satisfies ArticleStatus,
      reviewJustification: trimmed,
      reviewedBy: typeof user.email === 'string' ? user.email : String(user.id),
    },
    context: auditContext(
      user,
      from === 'blocked' ? 'block_overridden' : 'review_overridden',
      from === 'blocked'
        ? 'Reviewer overrode blocked to verified'
        : 'Reviewer overrode needs_review to verified',
      { justification: trimmed, runId },
    ),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
}

/**
 * Sends an article back to `researched` to regenerate with the reasons the
 * article's current information-gain run (or, when it carries none, QA) found — `revisionNotes` is
 * injected into the next `generate` prompt verbatim (see
 * `docs/information-gain.md`'s gap-fed generation section). Nulls `qaResults`
 * and `informationGain` for the same reason `resetToDraftedAction` does: a
 * stale decision must not linger next to a draft nobody has re-scored yet, so
 * this call also needs `overrideAccess: true` — see `NULL_INFORMATION_GAIN`.
 */
export async function regenerateArticleAction(
  articleId: number,
  note?: string,
  options?: ReviewActionOptions,
): Promise<QueuedRunResult> {
  const { payload, user } = await requireUser()
  const article = await payload.findByID({
    collection: 'articles',
    id: articleId,
    overrideAccess: false,
    user,
  })
  const run = await currentInformationGainRun(payload, article, user)
  const revisionNotes = buildRegenerateRevisionNotes(run, article, note)
  const updated = await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      status: 'researched' satisfies ArticleStatus,
      revisionNotes,
      revisionCount: (article.revisionCount ?? 0) + 1,
      qaResults: NULL_QA_RESULTS,
      informationGain: NULL_INFORMATION_GAIN,
    },
    context: auditContext(
      user,
      'article_regenerate_requested',
      'Article sent back for regeneration',
      { note: note?.trim() || null, runId: run?.id ?? null },
    ),
    user,
    // See NULL_INFORMATION_GAIN above — required to clear the informationGain group.
    overrideAccess: true,
  })
  revalidateOps(articleId)
  return queueRunAfterRework(payload, user, updated, options)
}
