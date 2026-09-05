import type { Field, GlobalConfig } from 'payload'

import { POLICY_FIELDS, type PolicyFieldDef } from '../lib/informationGain'
import { auditGlobalChange } from '../lib/governanceAudit'

/** `minConsensusCoverage` → `Minimum consensus coverage`. */
const ABBREVIATIONS: Record<string, string> = { min: 'minimum', max: 'maximum' }
const humaniseKey = (key: string): string => {
  const words = key
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(' ')
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * What happens to the draft when a gate is breached, in plain terms.
 *
 * Exported so the admin copy and the test that guarantees every field names its
 * consequence read the same strings — the raw REVISE/BLOCK/HUMAN_REVIEW codes
 * mean nothing to whoever is setting these dials.
 */
export const OUTCOME_COPY: Record<PolicyFieldDef['outcome'], string> = {
  REVISE: 'sent back for revision',
  BLOCK: 'blocked from publishing',
  HUMAN_REVIEW: 'flagged for a person to review',
}

const policyField = (f: PolicyFieldDef): Field => {
  const label = humaniseKey(f.key)
  const admin = {
    description: `${f.description} If a draft fails this check, it gets ${OUTCOME_COPY[f.outcome]}. Leave this blank to fall back to the ${f.env} environment variable, or the built-in default of ${String(f.default)}.`,
  }
  if (f.kind === 'boolean') {
    // A select rather than a checkbox: an unchecked box is indistinguishable
    // from an unset one, which would show the three BLOCK gates (all defaulting
    // to true) as if they were off. Clearing the select returns it to unset.
    return {
      name: f.key,
      type: 'select',
      label,
      options: [
        { label: 'Enabled', value: 'enabled' },
        { label: 'Disabled', value: 'disabled' },
      ],
      admin: { ...admin, isClearable: true },
    }
  }
  return {
    name: f.key,
    type: 'number',
    label,
    min: 0,
    ...(f.kind === 'ratio' ? { max: 1 } : {}),
    admin,
  }
}

/**
 * The information-gain thresholds, editable by an admin. Resolution order is
 * the same as the Models global's: this global wins, then the env override,
 * then `DEFAULT_POLICY` — see `resolvePolicy` in `lib/informationGain`. Every
 * field is optional and deliberately carries **no** Payload `defaultValue`: one
 * would be persisted on the first admin save, which `resolvePolicy` could not
 * tell from a real admin choice, silently killing the env override and the
 * reported provenance. The default lives in `POLICY_FIELDS` and is named in
 * each field's description instead. The ratios are uncalibrated policy dials
 * rather than probabilities.
 */
export const InformationGainPolicy: GlobalConfig = {
  slug: 'information-gain-policy',
  label: 'Information-gain policy',
  admin: {
    group: false,
    description:
      "Information gain is the pipeline's check that a draft actually adds something new and provable, not just a reworded version of what's already out there. These rules decide whether a draft publishes, goes back for another pass, or gets flagged for a person to review. Every change here is logged in Governance audits and changes the policy version stamped on future runs, so you can trace exactly which rules judged any given article.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeValidate: [({ data }) => {
      // Preserve existing REST/Local API clients while storing GraphQL-safe
      // enum names. Existing database values are converted by the migration.
      for (const field of POLICY_FIELDS) {
        if (field.kind !== 'boolean' || !data) continue
        if (data[field.key] === 'true') data[field.key] = 'enabled'
        if (data[field.key] === 'false') data[field.key] = 'disabled'
      }
      return data
    }],
    afterChange: [auditGlobalChange('information-gain-policy', 'information_gain_policy')],
  },
  fields: POLICY_FIELDS.map(policyField),
}
