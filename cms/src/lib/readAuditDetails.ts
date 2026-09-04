import type { Payload, TypedUser, Where } from 'payload'
import type { AuditSource, AuditDetailResult } from '../components/ops/auditTypes'

export async function readAuditDetails(
  payload: Payload,
  user: TypedUser,
  input: AuditSource & { articleId: number },
): Promise<AuditDetailResult> {
  if (
    !user ||
    !Number.isSafeInteger(input.articleId) ||
    input.articleId <= 0 ||
    !Number.isSafeInteger(input.recordId) ||
    input.recordId <= 0 ||
    (input.kind !== 'audit' && input.kind !== 'cost')
  ) {
    return { ok: false, error: 'Invalid evidence reference.' }
  }
  await payload.findByID({
    collection: 'articles',
    id: input.articleId,
    depth: 0,
    select: { status: true },
    user,
    overrideAccess: false,
  })
  const where: Where = {
    and: [{ id: { equals: input.recordId } }, { article: { equals: input.articleId } }],
  }
  if (input.kind === 'audit') {
    const { docs } = await payload.find({
      collection: 'article-audit',
      where,
      limit: 1,
      depth: 0,
      select: { details: true },
      user,
      overrideAccess: false,
    })
    return docs[0]
      ? { ok: true, details: docs[0].details ?? null }
      : { ok: false, error: 'Evidence not found.' }
  }
  const { docs } = await payload.find({
    collection: 'cost-log',
    where,
    limit: 1,
    depth: 0,
    select: {
      inputTokens: true,
      outputTokens: true,
      webSearchRequests: true,
      costUsd: true,
      request: true,
      response: true,
    },
    user,
    overrideAccess: false,
  })
  const row = docs[0]
  return row
    ? {
        ok: true,
        details: {
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          webSearchRequests: row.webSearchRequests,
          costUsd: row.costUsd,
          request: row.request,
          response: row.response,
        },
      }
    : { ok: false, error: 'Evidence not found.' }
}
