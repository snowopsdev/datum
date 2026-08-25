import type { CollectionConfig } from 'payload'

/**
 * Uploaded brand guides (the "upload an existing asset" onboarding path).
 * Deliberately separate from `media`, whose `read: () => true` would make a
 * tenant's internal brand guide publicly downloadable.
 */
export const BrandVoiceFiles: CollectionConfig = {
  slug: 'brand-voice-files',
  admin: {
    group: false,
    useAsTitle: 'filename',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    mimeTypes: [
      'text/markdown',
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  fields: [
    {
      name: 'description',
      type: 'text',
    },
  ],
}
