import type { CollectionConfig } from 'payload'

const immutable = () => {
  throw new Error('Governance audit entries are append-only')
}

/**
 * Immutable audit trail for governance records (brand voices today; templates
 * can be added by extending `subject.relationTo`). Written only by the
 * `auditGovernanceChange` hook with `overrideAccess: true`.
 */
export const GovernanceAudit: CollectionConfig = {
  slug: 'governance-audit',
  admin: {
    group: false,
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'subject', 'event', 'actor'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [({ operation }) => (operation === 'update' ? immutable() : undefined)],
    beforeDelete: [immutable],
  },
  timestamps: true,
  fields: [
    {
      name: 'subject',
      type: 'relationship',
      relationTo: ['brand-voices'],
      required: true,
      index: true,
    },
    {
      name: 'event',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'summary',
      type: 'text',
      required: true,
    },
    {
      name: 'actorType',
      type: 'select',
      required: true,
      options: ['pipeline', 'user', 'system'],
    },
    {
      name: 'actor',
      type: 'text',
      required: true,
    },
    {
      name: 'fromStatus',
      type: 'text',
    },
    {
      name: 'toStatus',
      type: 'text',
    },
    {
      name: 'details',
      type: 'json',
    },
  ],
}
