import type { GlobalConfig } from 'payload'

import { WEBHOOK_SECRET_ENV_VAR, WEBHOOK_URL_ENV_VAR } from '../lib/webhookSettings'

/**
 * Where article status-change events are delivered. Resolution lives in
 * `lib/webhookSettings.ts`: each field falls back to its env var, and
 * delivery is off until both a URL and a secret resolve. Payloads are signed
 * (SHA256 HMAC) so the receiver can reject anything else claiming to be us.
 */
export const WebhookSettings: GlobalConfig = {
  slug: 'webhook-settings',
  label: 'Webhooks',
  admin: {
    group: false,
    description:
      'Article status changes POST a signed event here. Leave fields blank to use the ' +
      `${WEBHOOK_URL_ENV_VAR} / ${WEBHOOK_SECRET_ENV_VAR} environment variables; nothing is sent until both a URL and a secret are set.`,
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Kill switch. Unchecking stops all deliveries, whatever else is configured.',
      },
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        description: `Endpoint that receives event POSTs. Blank uses ${WEBHOOK_URL_ENV_VAR}.`,
      },
    },
    {
      name: 'secret',
      type: 'text',
      admin: {
        description: `Shared secret that signs each delivery. Blank uses ${WEBHOOK_SECRET_ENV_VAR}.`,
      },
    },
  ],
}
