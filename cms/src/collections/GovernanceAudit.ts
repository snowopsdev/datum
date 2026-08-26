import type { CollectionConfig } from 'payload'

const immutable = () => {
  throw new Error('Governance audit entries are append-only')
}

/**
 * Immutable audit trail for governance records — brand voices and evidence
 * sources today (add more by extending `subject.relationTo`), plus Globals such
 * as the information-gain policy, which have no id and are identified by
 * `subjectGlobal` instead. Written only by the `auditGovernanceChange` /
 * `auditGlobalChange` hooks with `overrideAccess: true`; every entry carries
 * exactly one of `subject` or `subjectGlobal`.
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
    beforeValidate: [
      ({ data }) => {
        const hasSubject = data?.subject != null
        const hasGlobal =
          typeof data?.subjectGlobal === 'string' && data.subjectGlobal.trim() !== ''
        if (hasSubject === hasGlobal) {
          throw new Error('Governance audit entries need exactly one of subject or subjectGlobal')
        }
        return data
      },
    ],
    beforeChange: [({ operation }) => (operation === 'update' ? immutable() : undefined)],
    beforeDelete: [immutable],
  },
  timestamps: true,
  fields: [
    {
      name: 'subject',
      type: 'relationship',
      relationTo: ['brand-voices', 'evidence-sources'],
      required: false,
      index: true,
    },
    {
      name: 'subjectGlobal',
      type: 'text',
      index: true,
      admin: {
        description:
          'Slug of the audited Global, set instead of subject when the record has no id.',
      },
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
