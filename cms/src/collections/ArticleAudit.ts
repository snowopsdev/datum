import type { CollectionConfig } from 'payload'

const immutable = () => {
  throw new Error('Article audit entries are append-only')
}

export const ArticleAudit: CollectionConfig = {
  slug: 'article-audit',
  admin: {
    group: false,
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'article', 'event', 'actor', 'pipelineRunId'],
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
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
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
      name: 'pipelineRunId',
      type: 'text',
      index: true,
    },
    {
      name: 'stage',
      type: 'text',
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
