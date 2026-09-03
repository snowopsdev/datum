import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  Field,
} from 'payload'
import { APIError } from 'payload'

import { auditGovernanceChange } from '../lib/governanceAudit'
import {
  CONFIDENCE_OPTIONS,
  CONFIDENCE_USAGE_HINT,
  icpCompletenessProblems,
  icpContentOf,
} from '../lib/tenant'

type CascadeContext = {
  icpPrimaryCascade?: boolean
}

/** The confidence dial, with the usage rule spelled out where it is set. */
const confidence = (description: string): Field => ({
  name: 'confidence',
  type: 'select',
  options: [...CONFIDENCE_OPTIONS],
  admin: {
    description: `${description} Verified and strong directional ${CONFIDENCE_USAGE_HINT.state}; qualitative pattern and cultural signal ${CONFIDENCE_USAGE_HINT.hedge}; inference and hypothesis ${CONFIDENCE_USAGE_HINT.frame_as_view}.`,
  },
})

const textRows = (name: 'churnTriggers' | 'notOurUser', description: string): Field => ({
  name,
  type: 'array',
  admin: { description },
  fields: [{ name: 'text', type: 'text', required: true }],
})

/**
 * Activation gate, mirroring `gateActivation` on brand voices: an audience may
 * only become — or stay — `active` when it is complete enough to write
 * against, and partial edits to an active record are re-validated too.
 *
 * It also owns two rules about `primary`, because both need the record's
 * effective state after the patch is merged. A draft cannot be primary: a
 * primary audience is what every new piece is created against, and pointing
 * that at an unfinished record would put an incomplete ICP into prompts. And
 * the first audience to be activated becomes primary on its own, so a
 * workspace is never active-but-unpointed after doing the obvious thing.
 */
export const gateIcpActivation: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const merged = { ...(originalDoc ?? {}), ...data }
  const effectiveStatus = merged.status
  if (merged.primary === true && effectiveStatus !== 'active') {
    throw new APIError(
      'Only an active audience can be the primary one. Activate it first, then make it primary.',
      400,
    )
  }
  if (effectiveStatus !== 'active') return data

  // `originalDoc`, not `data`: a local-API update hands the hook the whole
  // merged document, so `data.status` says 'active' even for an edit that did
  // not touch the status. Asking whether it *was* active is the only way to
  // tell an activation from an edit — and it decides both the wording of the
  // error and whether the activation stamps get written.
  const activating = originalDoc?.status !== 'active'

  const problems = icpCompletenessProblems(icpContentOf(merged))
  if (problems.length > 0) {
    throw new APIError(
      `Cannot ${activating ? 'activate' : 'save active'} audience: ${problems.join('; ')}`,
      400,
    )
  }

  if (activating) {
    const user = req.user as { email?: string; id?: number | string } | null | undefined
    data.activatedAt = new Date().toISOString()
    data.activatedBy = user?.email ?? (user?.id != null ? String(user.id) : 'system')
    if (merged.primary !== true) {
      const others = await req.payload.count({
        collection: 'icps',
        where: {
          and: [
            { status: { equals: 'active' } },
            ...(originalDoc?.id != null ? [{ id: { not_equals: originalDoc.id } }] : []),
          ],
        },
        overrideAccess: true,
        req,
      })
      if (others.totalDocs === 0) data.primary = true
    }
  }
  return data
}

/**
 * Exactly one active audience is primary. When one becomes primary, every
 * other loses the flag in the same request/transaction. Unlike the brand
 * voice's cascade the losers are not archived — several audiences are
 * legitimately active at once, only the default pointer is exclusive.
 */
export const cascadeSinglePrimary: CollectionAfterChangeHook = async ({ context, doc, req }) => {
  if (doc.status !== 'active' || doc.primary !== true) return doc
  if ((context as CascadeContext).icpPrimaryCascade) return doc
  await req.payload.update({
    collection: 'icps',
    where: {
      and: [{ primary: { equals: true } }, { id: { not_equals: doc.id } }],
    },
    data: { primary: false },
    req,
    overrideAccess: true,
    context: {
      icpPrimaryCascade: true,
      governanceAudit: {
        event: 'icp_primary_moved',
        summary: `"${doc.name}" is now the primary audience`,
        details: { primaryIs: doc.id },
      },
    },
  })
  return doc
}

/**
 * Only drafts may be deleted. An audience that governed a run is part of the
 * record of why an article says what it says, and articles point at it.
 */
export const draftOnlyDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({ collection: 'icps', id, depth: 0, req })
  if (doc.status !== 'draft') {
    throw new APIError(
      `Only draft audiences can be deleted; "${doc.name}" is ${doc.status}. Archive it instead.`,
      400,
    )
  }
}

/**
 * The audiences this workspace writes for.
 *
 * A collection rather than rows inside a global, because an article has to
 * point at exactly one of them: a relationship gives referential integrity,
 * a stock admin UI, and per-document governance audit rows, none of which a
 * global array row can have.
 */
export const Icps: CollectionConfig = {
  slug: 'icps',
  labels: { singular: 'Audience', plural: 'Audiences' },
  admin: {
    group: false,
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'primary', 'updatedAt'],
    description:
      'Who each piece is written for. The primary audience is used for new pieces; the brief can change it per piece.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [gateIcpActivation],
    beforeDelete: [draftOnlyDelete],
    // Audit before cascading, for the reason spelled out on `BrandVoices`: the
    // cascade's nested update shares `req`, so an audit hook running afterwards
    // would record the cascade's annotation against this record.
    afterChange: [auditGovernanceChange('icps', 'icp'), cascadeSinglePrimary],
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'How the team refers to this audience, e.g. "Growth marketer at a Series B SaaS".' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: ['draft', 'active', 'archived'],
      admin: {
        description:
          'Only active audiences count towards setup and can be picked in a brief. Activating needs a name, who they are, one pain, and how we solve it.',
      },
    },
    {
      name: 'primary',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description:
          'The default audience for new pieces. Exactly one active audience is primary; setting it here clears the others.',
      },
    },
    {
      name: 'activatedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'activatedBy',
      type: 'text',
      admin: { readOnly: true },
    },
    // --- WHO ----------------------------------------------------------------
    {
      name: 'who',
      type: 'textarea',
      admin: { description: 'One line: their role, the kind of company, and what they are measured on.' },
    },
    // --- PAIN ---------------------------------------------------------------
    {
      name: 'pains',
      type: 'array',
      admin: { description: 'What hurts, most important first. The first one becomes the brief’s audience line.' },
      fields: [
        { name: 'statement', type: 'textarea', required: true },
        {
          name: 'evidence',
          type: 'array',
          admin: { description: 'Where this came from: a URL, an interview set, a quote.' },
          fields: [
            { name: 'ref', type: 'text', required: true },
            { name: 'note', type: 'text' },
          ],
        },
        confidence('How sure are you that this pain is real?'),
      ],
    },
    // --- MOTIVATION ---------------------------------------------------------
    {
      name: 'motivation',
      type: 'group',
      admin: { description: 'What they are actually trying to do, beneath the pain.' },
      fields: [
        { name: 'text', type: 'textarea' },
        {
          name: 'hypothesis',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Marked in the prompt so the writer never states it as a finding.' },
        },
        confidence('How sure are you about this motivation?'),
      ],
    },
    // --- HOW WE SOLVE IT ----------------------------------------------------
    {
      name: 'solution',
      type: 'group',
      admin: { description: 'The mechanism, not the benefit: what actually happens that fixes the pain.' },
      fields: [
        { name: 'mechanism', type: 'textarea' },
        {
          name: 'sampleLines',
          type: 'array',
          admin: { description: 'Phrasings that land. The writer may reuse these verbatim.' },
          fields: [{ name: 'text', type: 'text', required: true }],
        },
        confidence('How sure are you that this is what fixes it?'),
      ],
    },
    // --- THE COMPETITION ----------------------------------------------------
    {
      name: 'competition',
      type: 'array',
      admin: {
        description:
          'What the alternatives claim to this audience, and when they were seen claiming it. A claim with no date ages without anyone noticing.',
      },
      fields: [
        {
          name: 'competitor',
          type: 'text',
          required: true,
          admin: { description: 'Usually a name from the Workspace competitor list; free text is fine.' },
        },
        { name: 'claim', type: 'textarea' },
        { name: 'claimedAt', type: 'date' },
        { name: 'source', type: 'text' },
        confidence('How sure are you they still claim this?'),
      ],
    },
    // --- WHY US -------------------------------------------------------------
    {
      name: 'whyUs',
      type: 'group',
      admin: { description: 'Why this audience should pick us over those claims.' },
      fields: [{ name: 'text', type: 'textarea' }, confidence('How sure are you about this?')],
    },
    // --- WHERE --------------------------------------------------------------
    {
      name: 'channels',
      type: 'array',
      admin: { description: 'Where this audience already is, and what they do there.' },
      fields: [
        { name: 'channel', type: 'text', required: true },
        { name: 'note', type: 'text' },
        confidence('How sure are you they are there?'),
      ],
    },
    // --- BOUNDARIES ---------------------------------------------------------
    textRows('churnTriggers', 'What makes this audience leave.'),
    textRows('notOurUser', 'Who looks like this audience but is not, so the writer does not aim at them.'),
    // --- OPERATOR NOTES -----------------------------------------------------
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description:
          'Working notes and raw material for the setup assistant. Never sent to the writer.',
      },
    },
  ],
}
