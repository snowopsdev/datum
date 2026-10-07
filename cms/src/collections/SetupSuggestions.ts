import type { CollectionConfig } from 'payload'
import type { GovernanceAuditContext } from '../lib/governanceAudit'
export const SetupSuggestions: CollectionConfig = {
  slug: 'setup-suggestions',
  admin: {
    group: 'Governance',
    useAsTitle: 'signature',
    defaultColumns: ['kind', 'count', 'status', 'lastSeenAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    afterChange: [
      async ({ doc, context, req }) => {
        const audit = context.governanceAudit as GovernanceAuditContext | undefined
        if (audit)
          await req.payload.create({
            collection: 'governance-audit',
            overrideAccess: true,
            req,
            data: {
              subjectGlobal: 'setup-suggestions',
              event: audit.event ?? 'setup_suggestion_updated',
              summary: audit.summary ?? 'Setup suggestion decided',
              actorType: audit.actorType ?? 'user',
              actor: audit.actor ?? 'unknown',
              details: audit.details,
            },
          })
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      options: ['banned_word', 'not_trait', 'unbacked_claim', 'rejected_ref'],
      defaultValue: 'banned_word',
    },
    { name: 'signature', type: 'text', unique: true, index: true },
    {
      name: 'target',
      type: 'select',
      options: ['brand-voice', 'evidence-bank'],
      defaultValue: 'brand-voice',
    },
    { name: 'proposal', type: 'json' },
    { name: 'occurrences', type: 'json' },
    { name: 'count', type: 'number', defaultValue: 0 },
    {
      name: 'status',
      type: 'select',
      options: ['open', 'accepted', 'dismissed', 'obsolete'],
      defaultValue: 'open',
      index: true,
    },
    { name: 'firstSeenAt', type: 'date' },
    { name: 'lastSeenAt', type: 'date' },
    { name: 'decidedBy', type: 'text' },
    { name: 'decidedAt', type: 'date' },
    { name: 'decisionReason', type: 'textarea' },
  ],
}
