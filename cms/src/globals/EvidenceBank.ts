import type { GlobalBeforeValidateHook, GlobalConfig } from 'payload'

import { auditGlobalChange } from '../lib/governanceAudit'
import { CLEARED_SURFACES, nextRef, VERIFICATION_DEPTHS } from '../lib/tenant/evidenceBank'

/**
 * The evidence bank: the only first-party facts a draft may state.
 *
 * The operating rules live in the field descriptions rather than a wiki,
 * because they are what makes the asset work and an operator meets the fields
 * before they meet any documentation:
 *
 * - Proof travels with the claim. A row without a source and its limits is an
 *   assertion, and the writer has no way to tell the difference.
 * - A softened version of an unsupported claim is still unsupported. Hedging
 *   "the fastest" into "among the fastest" removes the evidence, not the claim.
 * - Rejected claims stay visible. A row nobody can see is a claim that comes
 *   back in the next draft, with nothing to stop it.
 */

type Row = Record<string, unknown>

const rowsOf = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === 'object') : []

const ARRAYS = ['verifiedClaims', 'facts', 'rejectedClaims'] as const

/** Postgres hands a `numeric` column back as a string often enough to matter. */
const counterOf = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/** The largest number already spent on a ref in this document. */
const highestRefIn = (doc: unknown): number => {
  const record = (doc ?? {}) as Record<string, unknown>
  let highest = 0
  for (const field of ARRAYS) {
    for (const row of rowsOf(record[field])) {
      const match = /^[EFR](\d+)$/.exec(typeof row.ref === 'string' ? row.ref.trim() : '')
      if (match) highest = Math.max(highest, Number(match[1]))
    }
  }
  return highest
}

/**
 * Give every new row a stable, human-readable ref.
 *
 * Payload's array-row ids are uuids, which are useless in a prompt and in an
 * audit row: a writer cites `[E3]`, and a reviewer reading a six-month-old
 * article needs `[E3]` to still mean the same claim. The counter is monotonic
 * and refs are never reused, because a deleted `E4` may still be cited by a
 * published article and pointing that citation at a different claim would
 * rewrite history silently. One counter serves all three prefixes: refs only
 * have to be unique and stable, and one number is simpler to keep honest than
 * three.
 *
 * The starting point is the highest of three numbers, not just the stored
 * counter, because a partial update — `updateGlobal` with only `verifiedClaims`
 * in it, which is how the demo fixture and any script writes — carries no
 * `refCounter` at all. Falling back to the saved document, and then to the refs
 * actually present, means the worst a drifted counter can do is skip a number.
 */
export const assignEvidenceRefs: GlobalBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const stored = Math.max(
    counterOf(data.refCounter),
    counterOf((originalDoc as Record<string, unknown> | undefined)?.refCounter),
    highestRefIn(originalDoc),
    highestRefIn(data),
  )
  let counter = stored
  const assign = (field: (typeof ARRAYS)[number], prefix: 'E' | 'F' | 'R') => {
    const rows = rowsOf(data[field])
    if (rows.length === 0) return
    for (const row of rows) {
      const ref = typeof row.ref === 'string' ? row.ref.trim() : ''
      if (ref !== '') continue
      counter += 1
      row.ref = nextRef(prefix, counter)
    }
    data[field] = rows
  }
  assign('verifiedClaims', 'E')
  assign('facts', 'F')
  assign('rejectedClaims', 'R')
  if (counter !== counterOf(data.refCounter)) data.refCounter = counter
  return data
}

const REF_FIELD = {
  name: 'ref',
  type: 'text' as const,
  admin: {
    readOnly: true,
    description: 'Assigned on save and never reused. This is what a draft cites.',
  },
}

export const EvidenceBank: GlobalConfig = {
  slug: 'evidence-bank',
  label: 'Evidence bank',
  admin: {
    group: false,
    description:
      'Everything this company may say about itself. A draft may state a first-party fact only if it is in here, and must cite the row’s ref. ' +
      'Proof travels with the claim: a row with no source and no limits is an assertion. A softened version of an unsupported claim is still unsupported.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeValidate: [assignEvidenceRefs],
    afterChange: [auditGlobalChange('evidence-bank', 'evidence_bank')],
  },
  fields: [
    {
      name: 'verifiedClaims',
      type: 'array',
      label: 'Verified claims',
      admin: {
        description:
          'Claims somebody has actually checked, each with the source, the method, and the limits it may not be stretched past. The writer cites these as [E1], [E2] and so on.',
      },
      fields: [
        REF_FIELD,
        {
          name: 'claim',
          type: 'textarea',
          required: true,
          admin: {
            description: 'The claim in one sentence, as you would be happy to see it printed.',
          },
        },
        {
          name: 'primarySource',
          type: 'text',
          admin: {
            description:
              'The document a checker could open: “Q2 2026 benchmark report”, “billing export, 2026-08-01”. Not “our data”.',
          },
        },
        { name: 'sourceUrl', type: 'text' },
        {
          name: 'sourceDate',
          type: 'date',
          admin: { description: 'When the source was produced. Sent to the writer with the claim.' },
        },
        {
          name: 'sampleOrMethod',
          type: 'textarea',
          admin: {
            description:
              'How it was measured, and over what. A number with no method behind it cannot be defended when somebody asks.',
          },
        },
        {
          name: 'verificationDepth',
          type: 'select',
          options: [...VERIFICATION_DEPTHS],
          admin: {
            description:
              'How hard it was checked, strongest first: a primary document, a reproduced result, a third-party audit, or self-reported.',
          },
        },
        {
          name: 'limits',
          type: 'textarea',
          admin: {
            description:
              'What this claim does NOT say — the generalisation a reader would make that the evidence does not support. QA fails a draft that goes past this.',
          },
        },
        {
          name: 'clearedSurfaces',
          type: 'select',
          hasMany: true,
          options: [...CLEARED_SURFACES],
          admin: {
            description:
              'Where legal or leadership has cleared this claim. Leave empty when it is cleared everywhere.',
          },
        },
        {
          name: 'recheckAt',
          type: 'date',
          admin: {
            description:
              'The date this stops being usable. After it the claim is treated as expired and moves into the writer’s “never state” list until somebody re-verifies it.',
          },
        },
      ],
    },
    {
      name: 'facts',
      type: 'array',
      label: 'Facts',
      admin: {
        description:
          'Plain facts that need no hedging and no limits: founding year, headquarters, integrations that exist. Cited as [F1], [F2].',
      },
      fields: [
        REF_FIELD,
        { name: 'fact', type: 'textarea', required: true },
        { name: 'source', type: 'text' },
        {
          name: 'owner',
          type: 'text',
          admin: { description: 'Who keeps this true. A fact with no owner goes stale unnoticed.' },
        },
        { name: 'lastConfirmedAt', type: 'date' },
      ],
    },
    {
      name: 'rejectedClaims',
      type: 'array',
      label: 'Rejected claims',
      admin: {
        description:
          'Claims that may never be stated, and why. Keep them here rather than deleting them: a claim nobody can see is one that comes back in the next draft. Cited as [R1] in the writer’s “never state” list.',
      },
      fields: [
        REF_FIELD,
        { name: 'claim', type: 'textarea', required: true },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'rejected',
          options: ['rejected', 'expired'],
          admin: {
            description:
              'Rejected: it was never supportable. Expired: it was true and the evidence has aged out.',
          },
        },
        {
          name: 'reason',
          type: 'textarea',
          admin: { description: 'Why, in the words you would use to explain it to the writer.' },
        },
        {
          name: 'replacement',
          type: 'text',
          admin: {
            description:
              'What to say instead: an evidence ref such as E1, or a sentence. The writer is told to use it.',
          },
        },
      ],
    },
    {
      name: 'refCounter',
      type: 'number',
      defaultValue: 0,
      admin: {
        hidden: true,
        description: 'Monotonic ref counter. Never decremented: a deleted ref is never reused.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description:
          'Anything the setup assistant should know while drafting this. Never sent to the writer.',
      },
    },
  ],
}
