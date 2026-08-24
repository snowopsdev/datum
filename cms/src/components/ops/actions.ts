'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import type { ArticleStatus } from './articleStatus'

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
      qaResults: {
        structural: { passed: null, violations: null },
        factCheck: { passed: null, notes: null, sources: null },
        qualitativeReview: { passed: null, notes: null },
      },
    },
    context: auditContext(user, 'revision_reset', 'Article reset to drafted', {
      reviewNotes: reviewNotes?.trim() || null,
    }),
    user,
    overrideAccess: false,
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
        qualitativeReview: { passed: false, notes: note },
      },
    },
    context: auditContext(user, 'article_sent_back', 'Article sent back for revision', {
      reviewNotes: note,
    }),
    user,
    overrideAccess: false,
  })
  revalidateOps(articleId)
}
