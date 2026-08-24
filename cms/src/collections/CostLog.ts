import type { CollectionConfig } from 'payload'

const immutable = () => {
  throw new Error('Cost log entries are append-only')
}

export const CostLog: CollectionConfig = {
  slug: 'cost-log',
  admin: {
    group: false,
    useAsTitle: 'pipelineRunId',
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
      name: 'pipelineRunId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
    },
    {
      name: 'stage',
      type: 'select',
      options: ['generate', 'factCheck', 'qualitativeReview'],
    },
    {
      name: 'provider',
      type: 'text',
    },
    {
      name: 'model',
      type: 'text',
    },
    {
      name: 'inputTokens',
      type: 'number',
    },
    {
      name: 'outputTokens',
      type: 'number',
    },
    {
      name: 'webSearchRequests',
      type: 'number',
    },
    {
      name: 'costUsd',
      type: 'number',
    },
    {
      name: 'request',
      type: 'json',
    },
    {
      name: 'response',
      type: 'json',
    },
  ],
}
