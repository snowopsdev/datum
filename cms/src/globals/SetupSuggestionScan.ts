import type { GlobalConfig } from 'payload'
/** Internal watermark; a new audit triggers a complete deterministic aggregation. */
export const SetupSuggestionScan: GlobalConfig = {
  slug: 'setup-suggestion-scan',
  admin: { hidden: true },
  access: { read: () => false, update: () => false },
  fields: [
    { name: 'auditCursor', type: 'text' },
    { name: 'auditCursorId', type: 'number' },
  ],
}
