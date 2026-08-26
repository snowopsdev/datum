/**
 * Run-scoped information-gain governance: the thresholds the stage judges
 * against, and the domain table it scores evidence with.
 *
 * Both are resolved once per run rather than per article, for the same reason
 * models are (see `pipeline/src/models.ts`): every article in one run must be
 * judged by the same policy, and a mid-run admin edit must not produce a batch
 * where half the articles were held to different numbers. The resolved policy
 * is hashed into a `policyVersion` that is stamped onto every stored result, so
 * a scorecard can always be traced back to the thresholds behind it.
 */

import type { Payload } from 'payload'

import {
  POLICY_FIELDS,
  resolvePolicy,
  type EvidenceSourceRule,
  type PolicyKey,
  type ResolvedPolicy,
} from './lib'
import { policyVersion } from './policyVersion'

/** The resolved policy plus the version stamp stored with every scorecard. */
export interface RunPolicy extends ResolvedPolicy {
  version: string
}

/**
 * Thresholds for this run: the Information Gain global wins, then the
 * `INFORMATION_GAIN_*` env overrides, then the platform default. A value that
 * is missing or out of range falls through to the next source instead of
 * throwing, so a bad admin entry can never wedge the pipeline.
 */
export async function loadInformationGainPolicy(payload: Payload): Promise<RunPolicy> {
  const globalDoc = (await payload.findGlobal({
    slug: 'information-gain-policy',
    depth: 0,
  })) as Partial<Record<PolicyKey, unknown>>
  const resolved = resolvePolicy(globalDoc, process.env)
  const version = policyVersion(resolved.canonical)

  for (const field of POLICY_FIELDS) {
    const key = field.key as PolicyKey
    console.log(`[pipeline] ig policy ${key}: ${resolved.policy[key]} (${resolved.sources[key]})`)
  }
  console.log(`[pipeline] ig policy version: ${version}`)

  return { ...resolved, version }
}

/**
 * The admin's evidence-domain table, active rows only. Inactive rows are
 * dropped here rather than passed through with `active: false` so that the row
 * count logged is the number of rules that can actually match; `resolveSourceQuality`
 * skips inactive rules again either way.
 */
export async function loadEvidenceSources(payload: Payload): Promise<EvidenceSourceRule[]> {
  const { docs } = await payload.find({
    collection: 'evidence-sources',
    where: { active: { equals: true } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const rules = docs.map((doc) => ({
    domain: doc.domain,
    qualityClass: doc.qualityClass,
    active: true,
  }))
  console.log(`[pipeline] evidence sources: ${rules.length} active rule(s)`)
  return rules
}
