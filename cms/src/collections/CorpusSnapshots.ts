import type { CollectionConfig } from 'payload'

/**
 * A captured SERP research corpus for one (keyword, country) pair, written by
 * the research stage (`pipeline/src/research.ts`) with `overrideAccess: true`.
 * Articles reference the snapshot they were researched from via
 * `research.snapshot`; a snapshot may be reused across articles that share a
 * keyword, and a future re-cluster may update `facets`/`queryCluster` on an
 * existing row, so unlike the audit collections this one allows update.
 */
export const CorpusSnapshots: CollectionConfig = {
  slug: 'corpus-snapshots',
  admin: {
    group: false,
    useAsTitle: 'keyword',
    defaultColumns: ['keyword', 'country', 'capturedAt', 'status', 'baselineDocCount'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  timestamps: true,
  fields: [
    {
      name: 'keyword',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'keywordKey',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Lower-cased, trimmed keyword used for reuse lookups.',
      },
    },
    {
      name: 'country',
      type: 'text',
      required: true,
    },
    {
      name: 'capturedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: ['complete', 'partial', 'empty'],
    },
    {
      name: 'pipelineRunId',
      type: 'text',
      index: true,
    },
    {
      name: 'snapshotHash',
      type: 'text',
    },
    {
      name: 'models',
      type: 'json',
    },
    {
      name: 'queryCluster',
      type: 'json',
    },
    {
      name: 'pages',
      type: 'array',
      fields: [
        {
          name: 'position',
          type: 'number',
        },
        {
          name: 'url',
          type: 'text',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'domain',
          type: 'text',
        },
        {
          name: 'domainRating',
          type: 'number',
        },
        {
          name: 'fetchStatus',
          type: 'select',
          options: ['ok', 'failed', 'skipped'],
          required: true,
        },
        {
          name: 'failureReason',
          type: 'text',
        },
        {
          name: 'chars',
          type: 'number',
        },
        {
          name: 'textHash',
          type: 'text',
        },
        {
          name: 'text',
          type: 'textarea',
          admin: {
            description: 'Readable page text, capped at 24k chars (decision: stored for auditability).',
          },
        },
        {
          name: 'claimCount',
          type: 'number',
        },
      ],
    },
    {
      name: 'internalCorpus',
      type: 'array',
      fields: [
        {
          name: 'article',
          type: 'relationship',
          relationTo: 'articles',
          required: true,
        },
        {
          name: 'articleUpdatedAt',
          type: 'date',
          required: true,
        },
        {
          name: 'claimCount',
          type: 'number',
        },
      ],
    },
    {
      name: 'baselineClaims',
      type: 'json',
    },
    {
      name: 'facets',
      type: 'json',
    },
    {
      name: 'gaps',
      type: 'json',
    },
    {
      name: 'baselineDocCount',
      type: 'number',
    },
    {
      name: 'failedPageCount',
      type: 'number',
    },
  ],
}
