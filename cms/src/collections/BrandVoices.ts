import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  Field,
} from 'payload'
import { APIError } from 'payload'

import {
  brandVoiceActivationProblems,
  brandVoiceContentOf,
  LANGUAGE_LEVELS,
  MAX_ADJECTIVES,
  MAX_SAMPLES,
  TONE_DIALS,
} from '../lib/brandVoice'
import { auditGovernanceChange } from '../lib/governanceAudit'

export type BrandVoiceStatus = 'draft' | 'active' | 'archived'

type CascadeContext = {
  brandVoiceCascade?: boolean
}

/**
 * Activation gate: a record may only become (or stay) `active` when it is
 * complete enough to govern the pipeline — partial updates to an active
 * record are re-validated too. Also stamps who activated it and when.
 */
export const gateActivation: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const effectiveStatus = data.status ?? originalDoc?.status
  if (effectiveStatus !== 'active') return data
  const merged = { ...(originalDoc ?? {}), ...data }
  const problems = brandVoiceActivationProblems(brandVoiceContentOf(merged))
  if (problems.length > 0) {
    const verb = data.status === 'active' ? 'activate' : 'save active'
    throw new APIError(`Cannot ${verb} brand voice: ${problems.join('; ')}`, 400)
  }
  if (data.status === 'active' && originalDoc?.status !== 'active') {
    const user = req.user as { email?: string; id?: number | string } | null | undefined
    data.activatedAt = new Date().toISOString()
    data.activatedBy = user?.email ?? (user?.id != null ? String(user.id) : 'system')
  }
  return data
}

/**
 * Only drafts may be deleted — active and archived voices are governance
 * history. Enforced here so the rule holds from the stock admin document view
 * and the REST/local APIs, not just the ops view's delete action.
 */
export const draftOnlyDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({ collection: 'brand-voices', id, depth: 0, req })
  if (doc.status !== 'draft') {
    throw new APIError(
      `Only draft brand voices can be deleted; "${doc.name}" is ${doc.status}. Archive it instead.`,
      400,
    )
  }
}

/**
 * Exactly one brand voice is active at a time. When a record becomes active,
 * every other active record is archived in the same request/transaction. The
 * context flag stops the cascade from re-entering itself.
 */
export const cascadeSingleActive: CollectionAfterChangeHook = async ({ context, doc, req }) => {
  if (doc.status !== 'active') return doc
  if ((context as CascadeContext).brandVoiceCascade) return doc
  await req.payload.update({
    collection: 'brand-voices',
    where: {
      and: [{ status: { equals: 'active' } }, { id: { not_equals: doc.id } }],
    },
    data: { status: 'archived' },
    req,
    overrideAccess: true,
    context: {
      brandVoiceCascade: true,
      governanceAudit: {
        event: 'brand_voice_superseded',
        summary: `Superseded by "${doc.name}"`,
        details: { supersededBy: doc.id },
      },
    },
  })
  return doc
}

const words = (name: 'preferredWords' | 'bannedWords', description: string): Field => ({
  name,
  type: 'array',
  admin: { description },
  fields: [
    { name: 'word', type: 'text', required: true },
    { name: 'note', type: 'text' },
  ],
})

/**
 * Workspace-wide brand voice governance. Single-tenant today: exactly one
 * `active` record governs every pipeline run. When tenancy lands, add
 * `{ name: 'tenant', type: 'relationship', relationTo: 'tenants' }` here and
 * scope the access closures + `cascadeSingleActive`'s `where` by it.
 */
export const BrandVoices: CollectionConfig = {
  slug: 'brand-voices',
  admin: {
    group: false,
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'source', 'updatedAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [gateActivation],
    beforeDelete: [draftOnlyDelete],
    // Audit BEFORE cascading: the cascade's nested update shares `req`, and
    // Payload merges its `context` into `req.context`, so an audit hook that
    // ran afterwards would record the superseded annotation for this record.
    afterChange: [auditGovernanceChange('brand-voices', 'brand_voice'), cascadeSingleActive],
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
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
          'Only the single active record governs the pipeline. Activating one archives the previous active record.',
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'onboarding',
      options: ['onboarding', 'upload'],
    },
    {
      name: 'sourceFile',
      type: 'relationship',
      relationTo: 'brand-voice-files',
      admin: { description: 'The uploaded guide this record was extracted from, if any.' },
    },
    {
      name: 'onboardingStep',
      type: 'number',
      min: 0,
      max: 9,
      defaultValue: 0,
      admin: { description: 'Last completed onboarding step; the stepper resumes from here.' },
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
    // --- Step 1: brand essence & mission ---------------------------------
    {
      name: 'essence',
      type: 'group',
      fields: [
        {
          name: 'oneLiner',
          type: 'text',
          admin: { description: 'What you do and for whom, in one sentence.' },
        },
        { name: 'mission', type: 'textarea' },
      ],
    },
    // --- Step 2: core values -----------------------------------------------
    {
      name: 'coreValues',
      type: 'array',
      admin: { description: 'What the business stands for (e.g. trust, speed). The voice must reflect these.' },
      fields: [
        { name: 'value', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
    // --- Step 3: target audience -------------------------------------------
    {
      name: 'audience',
      type: 'group',
      fields: [
        { name: 'description', type: 'textarea' },
        {
          name: 'languageLevel',
          type: 'select',
          options: [...LANGUAGE_LEVELS],
        },
        { name: 'interests', type: 'textarea' },
        { name: 'needs', type: 'textarea' },
      ],
    },
    // --- Step 4: human persona ---------------------------------------------
    {
      name: 'persona',
      type: 'textarea',
      admin: {
        description: 'Your brand as a real person at a party: how do they talk, joke, or help others?',
      },
    },
    // --- Step 5: three adjectives (voice chart) -----------------------------
    {
      name: 'voiceAdjectives',
      type: 'array',
      maxRows: MAX_ADJECTIVES,
      admin: { description: `Exactly ${MAX_ADJECTIVES} adjectives that describe the brand, each with a do/don't example.` },
      fields: [
        { name: 'adjective', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        { name: 'doExample', type: 'textarea' },
        { name: 'dontExample', type: 'textarea' },
      ],
    },
    {
      name: 'voiceInOwnWords',
      type: 'textarea',
      admin: { description: 'Longer-form description of the voice, in your own words.' },
    },
    // --- Step 6: what we are NOT -------------------------------------------
    {
      name: 'notTraits',
      type: 'array',
      admin: { description: 'Traits to avoid so the team knows the boundaries (e.g. "funny, but not sarcastic").' },
      fields: [
        { name: 'trait', type: 'text', required: true },
        { name: 'boundaryNote', type: 'textarea' },
      ],
    },
    // --- Step 7: tone dials --------------------------------------------------
    {
      name: 'tone',
      type: 'group',
      fields: TONE_DIALS.map((dial) => ({
        name: dial.key,
        type: 'number' as const,
        min: 1,
        max: 5,
        defaultValue: 3,
        admin: { description: `1 = ${dial.low} … 5 = ${dial.high}` },
      })),
    },
    // --- Step 8: word choices ------------------------------------------------
    words('preferredWords', 'Words you love to use.'),
    words('bannedWords', 'Jargon and words to ban. Enforced by a deterministic QA check on every generated field.'),
    // --- Step 9: sample writing ---------------------------------------------
    {
      name: 'samples',
      type: 'array',
      maxRows: MAX_SAMPLES,
      admin: { description: 'Existing on-voice writing, used as examples when generating.' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'text', type: 'textarea', required: true },
      ],
    },
    // --- Upload extraction provenance ---------------------------------------
    {
      name: 'extraction',
      type: 'group',
      admin: { readOnly: true, description: 'Set when the record was extracted from an uploaded guide.' },
      fields: [
        { name: 'model', type: 'text' },
        { name: 'provider', type: 'text' },
        { name: 'extractedAt', type: 'date' },
        { name: 'sourceChars', type: 'number' },
        { name: 'warnings', type: 'json' },
      ],
    },
  ],
}
