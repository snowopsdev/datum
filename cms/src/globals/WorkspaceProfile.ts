import type { GlobalConfig } from 'payload'

import { auditGlobalChange } from '../lib/governanceAudit'
import { COMPETITOR_DOMAINS_ENV_VAR, TARGET_DOMAIN_ENV_VAR } from '../lib/tenant/workspaceProfile'

/**
 * Who this workspace writes for, and who it writes against.
 *
 * Resolution lives in `lib/tenant/workspaceProfile.ts`: each field falls back
 * to its env var, and a mock run falls back again to a demo workspace, so an
 * unsaved global never stops a run. Saving it is what turns the env vars from
 * required deployment configuration into an optional fallback.
 */
export const WorkspaceProfile: GlobalConfig = {
  slug: 'workspace-profile',
  label: 'Workspace',
  admin: {
    group: false,
    description:
      'The site this workspace writes for and the competitors it is measured against. ' +
      `Leave the domain fields blank to use the ${TARGET_DOMAIN_ENV_VAR} / ${COMPETITOR_DOMAINS_ENV_VAR} ` +
      'environment variables.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [auditGlobalChange('workspace-profile', 'workspace_profile')],
  },
  fields: [
    {
      name: 'companyName',
      type: 'text',
      admin: {
        description:
          'How the company is named in prose. Anything said about it counts as a first-party claim.',
      },
    },
    {
      name: 'targetDomain',
      type: 'text',
      admin: {
        description: `The site we publish to, as a bare host (example.com). Blank uses ${TARGET_DOMAIN_ENV_VAR}.`,
      },
    },
    {
      name: 'competitors',
      type: 'array',
      admin: {
        description: `Sites the content-gap report is measured against. Blank uses ${COMPETITOR_DOMAINS_ENV_VAR}.`,
      },
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
          admin: { description: 'Bare host, as with the target domain.' },
        },
        {
          name: 'name',
          type: 'text',
          admin: {
            description: 'What prose calls them. Blank uses the domain.',
          },
        },
      ],
    },
    {
      name: 'siteNotes',
      type: 'textarea',
      admin: {
        description:
          'Anything about the company the setup assistant should know. Never sent to the writer on its own.',
      },
    },
    {
      name: 'sitePages',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          'Pages fetched from the site for the setup assistant. Written by the fetch action.',
      },
    },
    {
      name: 'sitePagesFetchedAt',
      type: 'date',
      admin: { readOnly: true, description: 'When those pages were last fetched.' },
    },
  ],
}
