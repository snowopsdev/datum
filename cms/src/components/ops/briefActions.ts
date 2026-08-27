'use server'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { ActivePipelineRunError, createPipelineRun } from '../../lib/createPipelineRun'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'

export type BriefActionResult = { ok: true; message: string } | { ok: false; error: string }

/** What the editor may change. Everything else on the brief is research output. */
export interface BriefEdits {
  angle: string
  audience: string
  sections: { heading: string; notes: string; source: 'template' | 'research' | 'editor' }[]
  notes: string
}

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Sign in to work on a brief.')
  return { payload, user }
}

const actorOf = (user: { email?: string | null; id: number | string }) =>
  typeof user.email === 'string' && user.email ? user.email : String(user.id)

function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return fallback
}

function revalidate(articleId: number) {
  revalidatePath('/admin/ops/articles')
  revalidatePath(`/admin/ops/articles/${articleId}`)
  revalidatePath('/admin/ops/content')
}

const cleanEdits = (edits: BriefEdits) => ({
  angle: edits.angle.trim(),
  audience: edits.audience.trim(),
  notes: edits.notes.trim(),
  sections: edits.sections
    .map((s) => ({ heading: s.heading.trim(), notes: s.notes.trim(), source: s.source }))
    .filter((s) => s.heading.length > 0),
})

/** Save edits to a brief that is waiting for approval. */
export async function saveBriefAction(
  articleId: number,
  edits: BriefEdits,
): Promise<BriefActionResult> {
  try {
    const { payload, user } = await requireUser()
    const article = await payload.findByID({ collection: 'articles', id: articleId, depth: 0 })
    if (article.status !== 'brief_review') {
      return { ok: false, error: 'This brief has already been approved; the piece has moved on.' }
    }
    const next = cleanEdits(edits)
    await payload.update({
      collection: 'articles',
      id: articleId,
      data: { brief: { ...(article.brief ?? {}), ...next } },
      user,
      overrideAccess: false,
      context: {
        articleAudit: {
          actor: actorOf(user),
          actorType: 'user' as const,
          event: 'brief_edited',
          summary: 'Brief edited before approval',
          details: { sections: next.sections.length, hasNotes: next.notes.length > 0 },
        },
      },
    })
    revalidate(articleId)
    return { ok: true, message: 'Brief saved.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not save the brief.') }
  }
}

/**
 * Approve the brief and start writing.
 *
 * This is the one place the expensive half of the pipeline is set in motion.
 * Approval moves the piece to `researched` — the generate stage's entry status
 * — and queues a run for it, so the editor never has to find a "start" button:
 * saying yes to the brief *is* starting.
 */
export async function approveBriefAction(
  articleId: number,
  edits?: BriefEdits,
): Promise<BriefActionResult> {
  try {
    const { payload, user } = await requireUser()
    const article = await payload.findByID({ collection: 'articles', id: articleId, depth: 0 })
    if (article.status !== 'brief_review') {
      return { ok: false, error: 'This brief has already been approved.' }
    }
    if (!article.template) {
      return { ok: false, error: 'Assign a template before approving the brief.' }
    }

    const setup = await loadWorkspaceSetup(payload)
    const { readiness } = setup
    if (!readiness.runtime.ready) {
      return {
        ok: false,
        error: `Writing needs these configured first: ${readiness.runtime.missing.join(', ')}.`,
      }
    }
    if (!readiness.governance.ready) {
      return { ok: false, error: 'Activate a brand voice before writing.' }
    }

    const approvedAt = new Date().toISOString()
    const brief = {
      ...(article.brief ?? {}),
      ...(edits ? cleanEdits(edits) : {}),
      approvedAt,
      approvedBy: actorOf(user),
    }
    await payload.update({
      collection: 'articles',
      id: articleId,
      data: { status: 'researched', brief },
      user,
      overrideAccess: false,
      context: {
        articleAudit: {
          actor: actorOf(user),
          actorType: 'user' as const,
          event: 'brief_approved',
          summary: 'Brief approved; writing queued',
          details: { sections: brief.sections?.length ?? 0, hasNotes: Boolean(brief.notes) },
        },
      },
    })

    const templateId =
      typeof article.template === 'object' ? article.template.id : Number(article.template)
    await createPipelineRun(payload, user, {
      runId: randomUUID(),
      source: 'selected',
      templateId,
      count: 1,
      articleIds: [articleId],
      requestedBy: actorOf(user),
      readiness,
    })

    revalidate(articleId)
    revalidatePath('/admin')
    return { ok: true, message: 'Brief approved. Writing has started.' }
  } catch (e) {
    if (e instanceof ActivePipelineRunError) {
      // The status change already happened, so the next run picks it up.
      revalidate(articleId)
      return { ok: true, message: 'Brief approved. Writing will start when the current run finishes.' }
    }
    return { ok: false, error: errorMessage(e, 'Could not approve the brief.') }
  }
}

/**
 * Send a piece back to its brief. For when the draft is wrong because the
 * *angle* was wrong — rewriting against the same brief would repeat it.
 */
export async function revisitBriefAction(articleId: number): Promise<BriefActionResult> {
  try {
    const { payload, user } = await requireUser()
    const article = await payload.findByID({ collection: 'articles', id: articleId, depth: 0 })
    if (article.status === 'brief_review') return { ok: true, message: 'Already at the brief.' }
    if (article.status === 'topic_selected') {
      return { ok: false, error: 'Research has not run yet, so there is no brief to revisit.' }
    }
    if (article.status === 'published') {
      return { ok: false, error: 'A published piece cannot go back to its brief.' }
    }
    await payload.update({
      collection: 'articles',
      id: articleId,
      data: {
        status: 'brief_review',
        brief: { ...(article.brief ?? {}), approvedAt: null, approvedBy: null },
      },
      user,
      overrideAccess: false,
      context: {
        articleAudit: {
          actor: actorOf(user),
          actorType: 'user' as const,
          event: 'brief_reopened',
          summary: `Sent back to the brief from ${article.status}`,
          details: { from: article.status },
        },
      },
    })
    revalidate(articleId)
    return { ok: true, message: 'Back at the brief. Edit it and approve to write again.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not reopen the brief.') }
  }
}
