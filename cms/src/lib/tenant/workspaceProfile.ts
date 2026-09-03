/**
 * Workspace profile — who this deploy writes for, and who it writes against.
 *
 * The domain and the competitor list used to be environment policy owned by
 * `pipeline/src/config.ts`. They are workspace facts, not deployment facts, so
 * they moved into an admin global and the env vars became the fallback —
 * resolved here the way `resolveWebhookSettings` resolves webhooks: admin field
 * wins per field, then env, then (in mock mode only) a demo default.
 *
 * Dependency-free on purpose: the admin UI, the readiness evaluator, and the
 * pipeline all import it, so no `payload`, `next`, `react`, or `process.env`.
 */

export const TARGET_DOMAIN_ENV_VAR = 'TARGET_DOMAIN'
export const COMPETITOR_DOMAINS_ENV_VAR = 'COMPETITOR_DOMAINS'

/** What a mock run pretends the workspace is, so a fresh clone runs with no setup. */
export const MOCK_TARGET_DOMAIN = 'datum.example.com'
export const MOCK_COMPETITOR_DOMAINS = 'competitor-one.com,competitor-two.com'

/** One page of the workspace's own site, captured for the setup assistant. */
export interface SitePage {
  url: string
  title: string | null
  text: string
  fetchedAt: string
}

/** Shape of the `workspace-profile` global (blank means "use env/default"). */
export interface WorkspaceProfileDoc {
  companyName?: string | null
  targetDomain?: string | null
  competitors?: ({ domain?: string | null; name?: string | null } | null)[] | null
  siteNotes?: string | null
  sitePages?: unknown
  sitePagesFetchedAt?: string | null
}

export interface Competitor {
  domain: string
  /** What prose calls them. Defaults to the domain when nobody has named them. */
  name: string
}

export type WorkspaceProfileSource = 'admin' | 'env' | 'default'

export interface ResolvedWorkspaceProfile {
  /** '' when unset; prompts omit the company line rather than print an empty name. */
  companyName: string
  targetDomain: string | null
  competitors: Competitor[]
  siteNotes: string
  sitePages: SitePage[]
  source: {
    targetDomain: WorkspaceProfileSource
    competitors: WorkspaceProfileSource
  }
}

const clean = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** Hostname labels: letters, digits, hyphens; a hyphen never leads or trails. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/**
 * A bare, comparable host, or null when the input is not one.
 *
 * Accepts what an operator actually pastes — `https://Example.com/pricing?x=1`,
 * `example.com:8443`, `example.com.` — and reduces it to `example.com`. `www`
 * is deliberately kept: `www.example.com` and `example.com` are different
 * targets to Ahrefs, so silently rewriting one into the other would change
 * which site the gap report is about.
 */
export function normaliseDomain(raw: unknown): string | null {
  const value = clean(raw)
  if (!value) return null
  if (/\s/.test(value)) return null
  let host = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  host = host.split(/[/?#]/)[0] ?? ''
  // Userinfo and port are addressing, not identity.
  const at = host.lastIndexOf('@')
  if (at >= 0) host = host.slice(at + 1)
  host = host.split(':')[0] ?? ''
  host = host.replace(/\.+$/, '').toLowerCase()
  if (!host) return null
  const labels = host.split('.')
  // A single label is a LAN name, never a site we crawl or rank-track.
  if (labels.length < 2) return null
  if (!labels.every((label) => LABEL.test(label))) return null
  return host
}

/** `"a.com, b.com"` → two competitors named after their domains. Invalid entries are dropped. */
export function parseCompetitorDomainsEnv(value: string | undefined | null): Competitor[] {
  if (typeof value !== 'string') return []
  const seen = new Set<string>()
  const competitors: Competitor[] = []
  for (const entry of value.split(',')) {
    const domain = normaliseDomain(entry)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    competitors.push({ domain, name: domain })
  }
  return competitors
}

function competitorsFromDoc(doc: WorkspaceProfileDoc | null | undefined): Competitor[] {
  const rows = Array.isArray(doc?.competitors) ? doc.competitors : []
  const seen = new Set<string>()
  const competitors: Competitor[] = []
  for (const row of rows) {
    const domain = normaliseDomain(row?.domain)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    competitors.push({ domain, name: clean(row?.name) ?? domain })
  }
  return competitors
}

function sitePagesOf(value: unknown): SitePage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const url = clean(row.url)
    if (!url) return []
    return [
      {
        url,
        title: clean(row.title) ?? null,
        text: typeof row.text === 'string' ? row.text : '',
        fetchedAt: clean(row.fetchedAt) ?? '',
      },
    ]
  })
}

/**
 * The profile this run should use. `mockDefault` is the mock-mode demo
 * workspace: a fresh clone with no global saved and no env vars still has a
 * domain to research against, which is what keeps `npm test` and a first mock
 * run working with zero setup. A live run gets `null` instead, and whoever
 * needs a domain says so at that moment.
 */
export function resolveWorkspaceProfile(
  doc: WorkspaceProfileDoc | null | undefined,
  env: Record<string, string | undefined>,
  opts: { mockDefault?: boolean } = {},
): ResolvedWorkspaceProfile {
  const adminDomain = normaliseDomain(doc?.targetDomain)
  const envDomain = normaliseDomain(env[TARGET_DOMAIN_ENV_VAR])
  const defaultDomain = opts.mockDefault ? MOCK_TARGET_DOMAIN : null
  const targetDomain = adminDomain ?? envDomain ?? defaultDomain

  const adminCompetitors = competitorsFromDoc(doc)
  const envCompetitors = parseCompetitorDomainsEnv(env[COMPETITOR_DOMAINS_ENV_VAR])
  const defaultCompetitors = opts.mockDefault
    ? parseCompetitorDomainsEnv(MOCK_COMPETITOR_DOMAINS)
    : []
  const competitors = adminCompetitors.length
    ? adminCompetitors
    : envCompetitors.length
      ? envCompetitors
      : defaultCompetitors

  return {
    companyName: clean(doc?.companyName) ?? '',
    targetDomain,
    competitors,
    siteNotes: clean(doc?.siteNotes) ?? '',
    sitePages: sitePagesOf(doc?.sitePages),
    source: {
      targetDomain: adminDomain ? 'admin' : envDomain ? 'env' : 'default',
      competitors: adminCompetitors.length ? 'admin' : envCompetitors.length ? 'env' : 'default',
    },
  }
}

/** What is still missing before the profile can drive a run, in the operator's words. */
export function workspaceProfileProblems(profile: ResolvedWorkspaceProfile): string[] {
  const problems: string[] = []
  if (!profile.targetDomain) problems.push('Set the target domain')
  if (profile.competitors.length === 0) problems.push('Add at least one competitor')
  return problems
}

/**
 * The `# Workspace` block for the generate system prompt.
 *
 * Empty sections are omitted rather than sent as bare headings, so a
 * half-filled profile never teaches the model that a heading can be blank.
 * Returns '' when there is nothing worth saying at all.
 */
export function workspaceProfileToPrompt(profile: ResolvedWorkspaceProfile): string {
  const lines: string[] = []
  const subject = profile.companyName || profile.targetDomain
  if (profile.companyName) {
    lines.push(
      profile.targetDomain
        ? `Company: ${profile.companyName} (${profile.targetDomain})`
        : `Company: ${profile.companyName}`,
    )
  } else if (profile.targetDomain) {
    lines.push(`Company site: ${profile.targetDomain}`)
  }
  if (profile.competitors.length > 0) {
    const named = profile.competitors
      .map((c) => (c.name === c.domain ? c.domain : `${c.name} (${c.domain})`))
      .join(', ')
    lines.push(`Competitors named in this workspace: ${named}`)
  }
  if (subject) {
    lines.push(
      `Treat any statement about ${subject}, its product, customers, pricing, results, or ` +
        'measurements as a first-party claim governed by the Evidence bank.',
    )
  }
  return lines.length > 0 ? `# Workspace\n${lines.join('\n')}` : ''
}

/**
 * The crawler identity. A site owner who sees the hit needs somewhere to
 * complain to, so the URL is only included when there is a real domain behind
 * it — `(+https://)` would be worse than saying nothing.
 */
export function userAgentFor(domain: string | null | undefined): string {
  return domain ? `DatumBot/1.0 (+https://${domain})` : 'DatumBot/1.0'
}
