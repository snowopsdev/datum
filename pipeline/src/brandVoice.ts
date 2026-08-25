import type { Payload } from 'payload'

import { brandVoiceContentOf, type BrandVoiceContent } from '../../cms/src/lib/brandVoice'

// One import site for stage code: the shared helpers live in the CMS lib so
// the admin UI, extraction, and this pipeline render the voice identically.
export * from '../../cms/src/lib/brandVoice'

/** The single active brand voice, normalised, or null when none is active. */
export async function loadActiveBrandVoice(payload: Payload): Promise<BrandVoiceContent | null> {
  const { docs } = await payload.find({
    collection: 'brand-voices',
    where: { status: { equals: 'active' } },
    limit: 1,
    depth: 0,
    sort: '-activatedAt',
  })
  const doc = docs[0]
  return doc ? brandVoiceContentOf(doc) : null
}
