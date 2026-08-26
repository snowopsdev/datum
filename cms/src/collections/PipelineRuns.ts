import type { CollectionConfig } from 'payload'

const signedIn = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export const PipelineRuns: CollectionConfig = {
  slug: 'pipeline-runs',
  labels: { singular: 'Pipeline run', plural: 'Pipeline runs' },
  admin: {
    group: false,
    hidden: true,
    useAsTitle: 'runId',
  },
  access: {
    read: signedIn,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'runId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: ['onboarding', 'admin', 'cli'],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: ['queued', 'running', 'succeeded', 'failed'],
    },
    { name: 'mode', type: 'select', required: true, options: ['mock', 'live'] },
    { name: 'template', type: 'relationship', relationTo: 'templates', required: true },
    { name: 'requestedCount', type: 'number', required: true, min: 1, max: 5 },
    { name: 'articles', type: 'relationship', relationTo: 'articles', hasMany: true },
    { name: 'configFingerprint', type: 'text', required: true, index: true },
    { name: 'configSnapshot', type: 'json', required: true },
    { name: 'finalStatuses', type: 'json' },
    { name: 'warnings', type: 'json' },
    { name: 'errorSummary', type: 'textarea' },
    { name: 'requestedBy', type: 'text', required: true },
    { name: 'startedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
  ],
}
