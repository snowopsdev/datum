/**
 * Persisting the domains a scoring run ran into that nobody has rated.
 *
 * The rules for *what* counts as a candidate are pure and live in the shared lib
 * (`cms/src/lib/informationGain/candidates.ts`); this file is only the upsert.
 * One row per domain, so a domain seen across ten articles is one thing to
 * decide rather than ten.
 */

import type { Payload } from 'payload'

import type { EvidenceSourceCandidate } from '../../../cms/src/payload-types'

import { mergeSightings, suggestClass, type CandidateSighting } from './lib'

/** A `create` that lost a race against another writer looks like this. */
const isDuplicateKey = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate key|unique constraint/i.test(message)
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** The newest domain rating anyone reported, keeping the old one when this run saw none. */
function latestRating(sightings: CandidateSighting[], previous: unknown): number | null {
  for (const sighting of sightings) {
    if (typeof sighting.domainRating === 'number') return sighting.domainRating
  }
  return typeof previous === 'number' ? previous : null
}

async function upsertDomain(
  payload: Payload,
  domain: string,
  sightings: CandidateSighting[],
): Promise<'created' | 'updated'> {
  const citations = sightings.reduce((sum, s) => sum + (s.kind === 'cited' ? (s.citations ?? 1) : 0), 0)
  const serps = sightings.filter((s) => s.kind === 'serp').length
  const seenAt = sightings[0]?.seenAt ?? new Date().toISOString()

  const { docs } = await payload.find({
    collection: 'evidence-source-candidates',
    where: { domain: { equals: domain } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existing = docs[0] as EvidenceSourceCandidate | undefined

  if (existing === undefined) {
    try {
      await payload.create({
        collection: 'evidence-source-candidates',
        overrideAccess: true,
        data: {
          domain,
          status: 'pending',
          suggestedClass: suggestClass(sightings),
          citationCount: citations,
          serpCount: serps,
          domainRating: latestRating(sightings, null),
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
          sightings: mergeSightings([], sightings),
        },
      })
      return 'created'
    } catch (error) {
      // Two articles in one run can surface the same domain concurrently.
      if (!isDuplicateKey(error)) throw error
      return upsertDomain(payload, domain, sightings)
    }
  }

  const merged = mergeSightings(existing.sightings, sightings)
  await payload.update({
    collection: 'evidence-source-candidates',
    id: existing.id,
    overrideAccess: true,
    data: {
      // An approved row being touched again means its rule is no longer active
      // (an active one would have filtered the sighting out upstream), so the
      // domain genuinely needs deciding again. A dismissal is a standing answer
      // and is never undone by the pipeline.
      ...(existing.status === 'approved' ? { status: 'pending' as const } : {}),
      suggestedClass: suggestClass(merged),
      citationCount: numberOr(existing.citationCount, 0) + citations,
      serpCount: numberOr(existing.serpCount, 0) + serps,
      domainRating: latestRating(sightings, existing.domainRating),
      lastSeenAt: seenAt,
      sightings: merged,
    },
  })
  return 'updated'
}

/**
 * Writes one row per domain in `sightings`. Returns what it did so the stage can
 * log it; a caller that cares about failure should catch, because a candidate
 * that did not get written must never cost an article its decision.
 */
export async function recordCandidateSightings(
  payload: Payload,
  sightings: CandidateSighting[],
): Promise<{ created: number; updated: number }> {
  const byDomain = new Map<string, CandidateSighting[]>()
  for (const sighting of sightings) {
    const group = byDomain.get(sighting.domain) ?? []
    group.push(sighting)
    byDomain.set(sighting.domain, group)
  }

  let created = 0
  let updated = 0
  for (const [domain, group] of byDomain) {
    const result = await upsertDomain(payload, domain, group)
    if (result === 'created') created += 1
    else updated += 1
  }
  return { created, updated }
}
