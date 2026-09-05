import config from '@payload-config'
import { getPayload } from 'payload'

import { TIMESTAMP_HEADER, SIGNATURE_HEADER, verifyWebhookSignature } from '@/jobs/webhookDeliver'
import { ARTICLE_STATUS_EVENT } from '@/lib/articleEvents'
import { revalidatePublishedArticle } from '@/lib/revalidatePublishedArticle'
import { resolveWebhookSettings } from '@/lib/webhookSettings'

/**
 * How old a delivery may be and still count. Each delivery attempt signs a
 * fresh timestamp, so this only has to cover clock skew and transit, not the
 * queue's retry backoff.
 */
const MAX_AGE_MS = 5 * 60 * 1000

/**
 * The default webhook consumer: point the webhook-settings URL at
 * `<SITE_URL>/hooks/revalidate` and worker-side publishes (pipeline runs,
 * scheduled publishing) purge the reader-facing cache they cannot purge
 * themselves — `revalidatePath` needs a Next request context, and the jobs
 * worker runs outside one. Lives under /hooks, not /api, which is Payload's
 * REST namespace.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const signature = request.headers.get(SIGNATURE_HEADER)
  const timestamp = request.headers.get(TIMESTAMP_HEADER)
  if (!signature || !timestamp) return Response.json({ error: 'unsigned' }, { status: 401 })

  const payload = await getPayload({ config })
  const settings = resolveWebhookSettings(
    await payload.findGlobal({ slug: 'webhook-settings', depth: 0 }),
    process.env,
  )
  if (!settings.secret) return Response.json({ error: 'not configured' }, { status: 401 })
  if (!verifyWebhookSignature(settings.secret, timestamp, rawBody, signature)) {
    return Response.json({ error: 'bad signature' }, { status: 401 })
  }
  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_AGE_MS) {
    return Response.json({ error: 'stale timestamp' }, { status: 401 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'malformed body' }, { status: 400 })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return Response.json({ error: 'malformed body' }, { status: 400 })
  }
  const body = parsed as Record<string, unknown>
  // Validate before invalidating any path: JSON parsing alone does not enforce
  // the delivery contract, and a bad slug must not cause a partial purge.
  if (
    (body.articleId != null &&
      (typeof body.articleId !== 'number' || !Number.isSafeInteger(body.articleId) || body.articleId <= 0)) ||
    ['event', 'from', 'to', 'slug', 'previousSlug'].some(
      (key) => body[key] != null && typeof body[key] !== 'string',
    )
  ) {
    return Response.json({ error: 'malformed body' }, { status: 400 })
  }

  // Only transitions into or out of `published` touch reader cache; everything
  // else (draft churn, review moves) is acknowledged and ignored, which is the
  // stage-scoped invalidation property this route exists to keep.
  const touchesPublished =
    body.event === ARTICLE_STATUS_EVENT &&
    body.articleId != null &&
    (body.from === 'published' || body.to === 'published')
  if (touchesPublished) {
    revalidatePublishedArticle({ id: body.articleId as number, slug: body.slug as string | null | undefined })
    // A save that renamed the slug while unpublishing cached the article under
    // the old slug; purge that path too or it serves until ISR expiry.
    if (body.previousSlug && body.previousSlug !== body.slug) {
      revalidatePublishedArticle({ id: body.articleId as number, slug: body.previousSlug as string })
    }
  }
  return Response.json({ revalidated: touchesPublished })
}
