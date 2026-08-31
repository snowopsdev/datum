import { createHmac, timingSafeEqual } from 'node:crypto'

import type { TaskConfig } from 'payload'

import { resolveWebhookSettings } from '../lib/webhookSettings'

type WebhookDeliverTask = {
  input: { event: string; body: Record<string, unknown> }
  output: { delivered: boolean; status: number | null }
}

/**
 * Matches Hygraph's documented delivery contract (3s timeout, 5 attempts
 * total) so a slow or flapping receiver neither blocks the queue nor loses
 * events silently: after the retries run out the job stays visible as failed.
 */
export const DELIVERY_TIMEOUT_MS = 3_000
export const DELIVERY_RETRIES = 4

export const SIGNATURE_HEADER = 'x-datum-signature'
export const TIMESTAMP_HEADER = 'x-datum-timestamp'
export const EVENT_HEADER = 'x-datum-event'

/**
 * The timestamp is inside the signed material so a captured delivery cannot be
 * replayed later with a fresh-looking header; the receiver checks freshness
 * against the same timestamp it verifies.
 */
export function signWebhookBody(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
}

/** Receiver-side check, constant-time. Used by the revalidate route and tests. */
export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signWebhookBody(secret, timestamp, rawBody))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export const WebhookDeliverTask: TaskConfig<WebhookDeliverTask> = {
  slug: 'webhook-deliver',
  label: 'Webhook delivery',
  retries: DELIVERY_RETRIES,
  inputSchema: [
    { name: 'event', type: 'text', required: true },
    { name: 'body', type: 'json', required: true },
  ],
  outputSchema: [
    { name: 'delivered', type: 'checkbox', required: true },
    { name: 'status', type: 'json' },
  ],
  async handler({ input, req }) {
    // Settings are re-resolved at delivery time, not enqueue time, so flipping
    // the kill switch also silences deliveries already sitting in the queue.
    const doc = await req.payload.findGlobal({ slug: 'webhook-settings', depth: 0 })
    const settings = resolveWebhookSettings(doc, process.env)
    if (!settings.enabled || !settings.url || !settings.secret) {
      return { output: { delivered: false, status: null } }
    }

    const rawBody = JSON.stringify(input.body)
    const timestamp = String(Date.now())
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
    try {
      const response = await fetch(settings.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SIGNATURE_HEADER]: signWebhookBody(settings.secret, timestamp, rawBody),
          [TIMESTAMP_HEADER]: timestamp,
          [EVENT_HEADER]: input.event,
        },
        body: rawBody,
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`webhook endpoint answered ${response.status} for "${input.event}"`)
      }
      return { output: { delivered: true, status: response.status } }
    } catch (error) {
      // Throwing hands the job back to the queue for its remaining retries. The
      // secret never appears in fetch errors, but the URL can (it may carry a
      // token in a query string), so the persisted message names the event only.
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? `timed out after ${DELIVERY_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message.replaceAll(settings.secret, '[redacted]').slice(0, 300)
            : 'delivery failed'
      throw new Error(`webhook delivery for "${input.event}" failed: ${reason}`)
    } finally {
      clearTimeout(timer)
    }
  },
}
