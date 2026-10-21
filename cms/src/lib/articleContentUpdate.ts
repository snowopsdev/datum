import type { CollectionBeforeChangeHook } from 'payload'

import { sameValue } from './sameValue'

const PUBLIC_CONTENT_FIELDS = [
  'title',
  'keyword',
  'slug',
  'body',
  'faqItems',
  'titleTag',
  'metaDescription',
  'ogTitle',
  'ogDescription',
  'ogImage',
] as const

// Array row IDs are storage metadata, not a change to a reader's FAQ.
function publicValue(field: string, value: unknown): unknown {
  if (field === 'faqItems' && Array.isArray(value)) {
    return value.map(({ question, answer }) => ({ question, answer }))
  }
  return value
}

/** Only actual public edits advance the reader-facing modification date. */
export const trackArticleContentUpdate: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
}) => {
  const changed =
    operation === 'update' &&
    PUBLIC_CONTENT_FIELDS.some(
      (field) =>
        field in data &&
        !sameValue(publicValue(field, data[field]), publicValue(field, originalDoc?.[field])),
    )
  // Ignore caller-supplied timestamps, including Local API overrides. Creation
  // is not a later edit; unknown historical edits stay unknown.
  data.contentUpdatedAt = changed
    ? new Date().toISOString()
    : (originalDoc?.contentUpdatedAt ?? null)
  return data
}
