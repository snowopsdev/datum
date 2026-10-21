const WORDS_PER_MINUTE = 200
/** An edit this soon after publishing is a typo fix, not worth an "Updated" note. */
const MATERIAL_UPDATE_MS = 24 * 60 * 60 * 1000

/** Minutes to read `plainText`, never below 1. */
export function readingMinutes(plainText: string): number {
  const words = plainText.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

/** "Oct 20, 2026". UTC so the server-rendered date cannot shift with the host zone. */
export function formatArticleDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Dateline segments: published date, reading time, and "Updated …" only for a material edit. */
export function articleDateline(opts: {
  publishedAt?: string | null
  updatedAt?: string | null
  minutes: number
}): string[] {
  const parts: string[] = []
  const published = formatArticleDate(opts.publishedAt)
  if (published) parts.push(published)
  parts.push(`${opts.minutes} min read`)

  if (opts.publishedAt && opts.updatedAt) {
    const gap = new Date(opts.updatedAt).getTime() - new Date(opts.publishedAt).getTime()
    const updated = formatArticleDate(opts.updatedAt)
    if (updated && gap > MATERIAL_UPDATE_MS) parts.push(`Updated ${updated}`)
  }
  return parts
}

/** Stable, URL-safe anchor for FAQ item `index`; the index keeps repeated questions unique. */
export function faqAnchorId(question: string, index: number): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return slug ? `faq-${index + 1}-${slug}` : `faq-${index + 1}`
}
