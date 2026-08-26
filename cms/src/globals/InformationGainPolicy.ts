import type { Field, GlobalConfig } from 'payload'

import { POLICY_FIELDS, type PolicyFieldDef } from '../lib/informationGain'
import { auditGlobalChange } from '../lib/governanceAudit'

/** `minConsensusCoverage` → `Min consensus coverage`. */
const humaniseKey = (key: string): string => {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const policyField = (f: PolicyFieldDef): Field => {
  const label = humaniseKey(f.key)
  const admin = {
    description: `${f.description} Failing this gate → ${f.outcome}. Leave blank to use ${f.env} from the environment, or the default ${String(f.default)}.`,
  }
  if (f.kind === 'boolean') {
    return { name: f.key, type: 'checkbox', label, defaultValue: Boolean(f.default), admin }
  }
  return {
    name: f.key,
    type: 'number',
    label,
    defaultValue: Number(f.default),
    min: 0,
    ...(f.kind === 'ratio' ? { max: 1 } : {}),
    admin,
  }
}

/**
 * The information-gain thresholds, editable by an admin. Resolution order is
 * the same as the Models global's: this global wins, then the env override,
 * then `DEFAULT_POLICY` — see `resolvePolicy` in `lib/informationGain`. Every
 * field is optional so a blank means "fall through to env/default", and the
 * ratios are uncalibrated policy dials rather than probabilities.
 */
export const InformationGainPolicy: GlobalConfig = {
  slug: 'information-gain-policy',
  label: 'Information-gain policy',
  admin: {
    group: false,
    description:
      'Deterministic publication gates applied by the informationGain pipeline stage. Every change is recorded in Governance audits and changes the policy version stamped on future runs.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [auditGlobalChange('information-gain-policy', 'information_gain_policy')],
  },
  fields: POLICY_FIELDS.map(policyField),
}
