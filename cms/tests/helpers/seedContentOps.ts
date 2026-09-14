import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config.js'

import { BRAND_VOICE_FIXTURE } from '../../src/lib/brandVoiceFixture.js'
import { ICP_FIXTURE } from '../../src/lib/tenant/fixtures.js'
import type { IcpContent } from '../../src/lib/tenant/index.js'
import type { Article } from '../../src/payload-types.js'

/**
 * Seeding for the content-ops e2e suite. Runs in the Playwright test process
 * against the same database as the app under test, the same way
 * `seedUser.ts` does.
 */

/** The fixture audience in the shape the `icps` collection stores it. */
const icpDocFields = (icp: IcpContent) => ({
  name: icp.name,
  who: icp.who,
  pains: icp.pains.map((pain) => ({
    statement: pain.statement,
    evidence: pain.evidence.map((row) => ({ ref: row.ref, note: row.note })),
    confidence: pain.confidence,
  })),
  motivation: { ...icp.motivation },
  solution: {
    mechanism: icp.solution.mechanism,
    sampleLines: icp.solution.sampleLines.map((text) => ({ text })),
    confidence: icp.solution.confidence,
  },
  competition: icp.competition.map((row) => ({ ...row })),
  whyUs: { ...icp.whyUs },
  channels: icp.channels.map((row) => ({ ...row })),
  churnTriggers: icp.churnTriggers.map((text) => ({ text })),
  notOurUser: icp.notOurUser.map((text) => ({ text })),
})

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

/**
 * The template every seeded article that has to be runnable points at.
 *
 * `queueRunForArticles` refuses an article with no template, so a fixture that
 * exists to exercise the run controls needs one. The seed puts four in, and
 * which one a fixture uses is irrelevant — only that it has one.
 */
export async function firstTemplateId(payload: Payload): Promise<number> {
  const { docs } = await payload.find({
    collection: 'templates',
    limit: 1,
    depth: 0,
    sort: 'id',
    overrideAccess: true,
  })
  const id = docs[0]?.id
  if (typeof id !== 'number') {
    throw new Error('No templates in the test database — run `npm run seed --workspace cms`.')
  }
  return id
}

/**
 * Make the workspace able to start a run, without disturbing one that already
 * can.
 *
 * `gateRunReadiness` refuses every entry point until the workspace has an
 * active brand voice, a target domain and an active audience, so a test of the
 * run buttons is a test of that gate unless the governance assets are there.
 * Create-only, the way `fillDemoIcps` is: a database that already has an
 * operator's own voice or audience keeps it, and nothing is deactivated
 * afterwards — activation cascades (single active voice, single primary
 * audience) make "put it back" a lie rather than a cleanup.
 */
export async function ensureRunReadiness(payload: Payload): Promise<void> {
  const [voices, icps] = await Promise.all([
    payload.find({
      collection: 'brand-voices',
      where: { status: { equals: 'active' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'icps',
      where: { status: { equals: 'active' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  if (voices.docs.length === 0) {
    await payload.create({
      collection: 'brand-voices',
      overrideAccess: true,
      data: {
        ...BRAND_VOICE_FIXTURE,
        status: 'active',
        source: 'onboarding',
        onboardingStep: 9,
      } as never,
    })
  }
  if (icps.docs.length === 0) {
    await payload.create({
      collection: 'icps',
      overrideAccess: true,
      data: { ...icpDocFields(ICP_FIXTURE), status: 'active', primary: true } as never,
    })
  }
}
