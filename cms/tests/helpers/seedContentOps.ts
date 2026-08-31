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

/**
 * Articles cannot be hard-deleted (append-only audit FK), so cleanup archives
 * them — and also withdraws any the suite published, because the public
 * routes, homepage, and report metrics select `published` rows without
 * excluding archived ones. `approved` is the state the fixture held before
 * the test published it. Run while webhooks are already disabled so the
 * withdrawal queues no delivery; on a caching (production) server the old
 * page may persist for one ISR window, which this suite does not target.
 */
export async function retireArticles(payload: Payload, ids: number[]): Promise<void> {
  for (const id of ids) {
    const current = await payload.findByID({
      collection: 'articles',
      id,
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'articles',
      id,
      overrideAccess: true,
      data: {
        archived: true,
        ...(current.status === 'published' ? { status: 'approved' } : {}),
      },
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
