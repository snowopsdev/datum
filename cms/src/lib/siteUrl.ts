/**
 * Public site origin for absolute metadata URLs (canonical, OG, etc.).
 * Localhost is only used outside production so a missing SITE_URL cannot
 * ship localhost canonicals to crawlers.
 */
export function getSiteUrl(): string | undefined {
  const configured = process.env.SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'
  return undefined
}

export function getMetadataBase(): URL | undefined {
  const siteUrl = getSiteUrl()
  return siteUrl ? new URL(siteUrl) : undefined
}
