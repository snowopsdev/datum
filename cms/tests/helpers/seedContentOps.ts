import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config.js'

import type { Article } from '../../src/payload-types.js'

/**
 * Seeding for the content-ops e2e suite. Runs in the Playwright test process
 * against the same database as the app under test, the same way
 * `seedUser.ts` does.
 */

export async function opsPayload(): Promise<Payload> {
  return getPayload({ config })
}

/**
 * Own user rather than `seedUser.ts`'s: spec files run in parallel workers,
 * and two files seeding/deleting the same email race into duplicate-email
 * validation errors and mid-test logouts.
 */
export const opsTestUser = {
  email: 'ops-e2e@datum.local',
  password: 'test',
}

export async function seedOpsUser(payload: Payload): Promise<void> {
  await payload.delete({
    collection: 'users',
    where: { email: { equals: opsTestUser.email } },
  })
  await payload.create({ collection: 'users', data: opsTestUser })
}

export async function cleanupOpsUser(payload: Payload): Promise<void> {
  await payload.delete({
    collection: 'users',
    where: { email: { equals: opsTestUser.email } },
  })
}

export async function seedArticle(
  payload: Payload,
  data: Partial<Article> & { keyword: string },
): Promise<Article> {
  return payload.create({ collection: 'articles', overrideAccess: true, data: data as never })
}

/** Articles cannot be hard-deleted (append-only audit FK), so cleanup archives. */
export async function archiveArticles(payload: Payload, ids: number[]): Promise<void> {
  for (const id of ids) {
    await payload.update({
      collection: 'articles',
      id,
      overrideAccess: true,
      data: { archived: true },
    })
  }
}

export async function setWebhookSettings(
  payload: Payload,
  data: { enabled: boolean; url?: string | null; secret?: string | null },
): Promise<void> {
  await payload.updateGlobal({
    slug: 'webhook-settings',
    overrideAccess: true,
    data: { url: null, secret: null, ...data },
  })
}
