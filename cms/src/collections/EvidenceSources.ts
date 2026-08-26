import type { CollectionConfig } from 'payload'

import { normaliseDomain, SOURCE_QUALITY_CLASSES } from '../lib/informationGain'
import { auditGovernanceChange } from '../lib/governanceAudit'

/**
 * The admin's allow/deny list for evidence domains. One row per domain, and it
 * is the only way a source can be certified `first_party_dataset` — the
 * information-gain judge's own rubric is capped at `secondary` because it is an
 * uncalibrated guess about a domain nobody has vetted. Read by the
 * informationGain stage through `resolveSourceQuality`.
 */
export const EvidenceSources: CollectionConfig = {
  slug: 'evidence-sources',
  admin: {
    group: false,
    useAsTitle: 'domain',
    defaultColumns: ['domain', 'qualityClass', 'active', 'updatedAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.domain === 'string') {
          const d = normaliseDomain(data.domain)
          if (!d) throw new Error('domain is required')
          data.domain = d
        }
        return data
      },
    ],
    afterChange: [auditGovernanceChange('evidence-sources', 'evidence_source')],
  },
  timestamps: true,
  fields: [
    {
      name: 'domain',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Hostname without scheme or path, e.g. docs.example.com. Matches that host and its subdomains.',
      },
    },
    {
      name: 'qualityClass',
      type: 'select',
      required: true,
      options: [...SOURCE_QUALITY_CLASSES],
      admin: {
        description:
          'Source-quality weight used in evidence integrity: first_party_dataset 1.0 · primary 0.95 · official_docs 0.90 · secondary 0.75 · unverified 0.40 · blocked 0. Unlisted domains are capped at secondary.',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'Why this domain carries this weight.' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Inactive rows are ignored; the domain falls back to the rubric.' },
    },
  ],
}
