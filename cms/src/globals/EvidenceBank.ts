import { APIError, type GlobalBeforeValidateHook, type GlobalConfig } from 'payload'

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

type ArrayField = (typeof ARRAYS)[number]

type Prefix = 'E' | 'F' | 'R'

/** Which letter each list's refs carry, so a ref says which list it came from. */
const PREFIX: Record<ArrayField, Prefix> = {
  verifiedClaims: 'E',
  facts: 'F',
  rejectedClaims: 'R',
}

const shapedFor = (prefix: Prefix): RegExp => new RegExp(`^${prefix}\\d+$`)

/** Postgres array rows carry a uuid; a hand-written one may carry a number. */
const idOf = (row: Row): string =>
  typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id).trim() : ''

const refOf = (row: Row): string => (typeof row.ref === 'string' ? row.ref.trim().toUpperCase() : '')

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
      const match = /^[EFR](\d+)$/.exec(refOf(row))
      if (match) highest = Math.max(highest, Number(match[1]))
    }
  }
  return highest
}

/**
 * The ref every saved row owns, keyed by the array-row id Payload gave it.
 *
 * This is what makes a ref immutable rather than merely sticky. The row id is
 * the only thing about a row that the operator cannot type, so it is the only
 * thing that can say "this is still the same claim" when everything else about
 * the row has been edited.
 */
const savedRefsById = (doc: unknown): Map<string, string> => {
  const record = (doc ?? {}) as Record<string, unknown>
  const byId = new Map<string, string>()
  for (const field of ARRAYS) {
    for (const row of rowsOf(record[field])) {
      const id = idOf(row)
      const ref = refOf(row)
      if (id !== '' && shapedFor(PREFIX[field]).test(ref)) byId.set(id, ref)
    }
  }
  return byId
}

/**
 * Give every row a stable, human-readable ref, and never let one move.
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
 * That promise is only as good as what happens when a write disagrees with it,
 * so a supplied ref is never simply believed. A row the saved document already
 * knows by id keeps the ref it was given, whatever this write calls it — that
 * is what stops an edit, an import, or a hand-made API call from renaming `E3`
 * to `E5` and silently re-pointing every article that cited either. A row the
 * document has never seen may declare its own ref, because whole-array writes
 * are how the demo fixture and any script put a bank in place and their refs
 * are the ones the prompt fixtures and the seed agree on; but only if it is
 * shaped right, carries its list's own letter, and nothing else has claimed it.
 * Everything left over is minted.
 *
 * The counter's starting point is the highest of four numbers, not just the
 * stored one, because a partial update — `updateGlobal` with only
 * `verifiedClaims` in it — carries no `refCounter` at all. Falling back to the
 * saved document, and then to the refs actually present, means the worst a
 * drifted counter can do is skip a number.
 */
export const assignEvidenceRefs: GlobalBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const saved = savedRefsById(originalDoc)
  let counter = Math.max(
    counterOf(data.refCounter),
    counterOf((originalDoc as Record<string, unknown> | undefined)?.refCounter),
    highestRefIn(originalDoc),
    highestRefIn(data),
  )

  // Only the arrays this write actually carries. A partial update that names
  // one list must not blank the other two.
  const slots: { row: Row; prefix: Prefix; ref: string }[] = []
  for (const field of ARRAYS) {
    if (!Array.isArray(data[field])) continue
    const rows = rowsOf(data[field])
    data[field] = rows
    for (const row of rows) slots.push({ row, prefix: PREFIX[field], ref: '' })
  }

  const claimed = new Set<string>()
  for (const slot of slots) {
    const id = idOf(slot.row)
    const owned = id === '' ? undefined : saved.get(id)
    if (owned === undefined || claimed.has(owned)) continue
    slot.ref = owned
    claimed.add(owned)
  }
  for (const slot of slots) {
    if (slot.ref !== '') continue
    const declared = refOf(slot.row)
    if (declared === '' || claimed.has(declared)) continue
    if (!shapedFor(slot.prefix).test(declared)) continue
    slot.ref = declared
    claimed.add(declared)
  }
  for (const slot of slots) {
    if (slot.ref !== '') continue
    counter += 1
    slot.ref = nextRef(slot.prefix, counter)
    claimed.add(slot.ref)
  }

  // The invariant the rest of the system is entitled to assume, checked rather
  // than hoped for: a citation resolves to exactly one row, or the write is
  // refused while the operator still has the edit in front of them.
  const seen = new Set<string>()
  for (const slot of slots) {
    if (!shapedFor(slot.prefix).test(slot.ref)) {
      throw new APIError(`Evidence ref "${slot.ref}" is not a valid ${slot.prefix} ref.`, 400)
    }
    if (seen.has(slot.ref)) {
      throw new APIError(`Evidence ref "${slot.ref}" is used by more than one row.`, 400)
    }
    seen.add(slot.ref)
    slot.row.ref = slot.ref
  }

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
