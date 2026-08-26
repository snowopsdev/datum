'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

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
 */
const NULL_INFORMATION_GAIN = {
  run: null,
  decision: null,
  policyVersion: null,
  consensusCoverage: null,
  verifiedGainUnits: null,
  verificationRatio: null,
  internalDuplicationRate: null,
  verifiedNovelClaims: null,
  scoredAt: null,
} as const

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

export async function resetToDraftedAction(articleId: number, reviewNotes?: string) {
  const { payload, user } = await requireUser()
  await payload.update({
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
}

export async function approveArticleAction(articleId: number, reviewNotes?: string) {
  const { payload, user } = await requireUser()
  await payload.update({
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
}

export async function publishArticleAction(articleId: number, reviewNotes?: string) {
  const { payload, user } = await requireUser()
  await payload.update({
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
  const latestRun = await payload.find({
    collection: 'information-gain-runs',
    where: { article: { equals: articleId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const runId = latestRun.docs[0]?.id ?? null
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
 * last information-gain run (or, absent a run, QA) found — `revisionNotes` is
 * injected into the next `generate` prompt verbatim (see
 * `docs/information-gain.md`'s gap-fed generation section). Nulls `qaResults`
 * and `informationGain` for the same reason `resetToDraftedAction` does: a
 * stale decision must not linger next to a draft nobody has re-scored yet, so
 * this call also needs `overrideAccess: true` — see `NULL_INFORMATION_GAIN`.
 */
export async function regenerateArticleAction(articleId: number, note?: string) {
  const { payload, user } = await requireUser()
  const article = await payload.findByID({
    collection: 'articles',
    id: articleId,
    overrideAccess: false,
    user,
  })
  const latestRun = await payload.find({
    collection: 'information-gain-runs',
    where: { article: { equals: articleId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const run = latestRun.docs[0] ?? null
  const revisionNotes = buildRegenerateRevisionNotes(run, article, note)
  await payload.update({
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
}
