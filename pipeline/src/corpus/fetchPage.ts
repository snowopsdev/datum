/**
 * Fetches a competitor page and reduces it to readable text.
 *
 * This is the pipeline's only outbound crawl, so it is deliberately timid: one
 * request per hop, a hard timeout, a byte ceiling on the response body, and a
 * character ceiling on the extracted text. It never throws — a snapshot of ten
 * SERP results should not fail because one of them is a PDF or a dead host, so
 * every outcome comes back as a `FetchedPage` with a `status` and a `reason`.
 *
 * SERP URLs are low-trust input and the fetched body is stored in Postgres and
 * fed to an LLM, so redirects are followed by hand (`redirect: 'manual'`, at
 * most `MAX_REDIRECTS` hops) and **every** hop is checked before it is
 * requested: the scheme must be `http:`/`https:`, and the hostname must resolve
 * to addresses that are none of loopback, private, link-local, unique-local,
 * unspecified, or multicast/reserved (`./addressGuard`). Letting the runtime
 * follow redirects would issue the internal request before anything could
 * object, which is exactly how a ranking page becomes an SSRF vector against
 * cloud metadata at `169.254.169.254` or an internal HTTP service.
 *
 * V1 still does not read robots.txt, has no per-host throttle, and does no
 * sanitisation beyond what Readability already strips; the text is only ever
 * fed to an LLM, never rendered.
 */

import { lookup as dnsLookup } from 'node:dns/promises'

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

import { config } from '../config'
import { normaliseWhitespace } from '../informationGain/lib'

import { isBlockedAddress, isBlockedHostname, normaliseHostname } from './addressGuard'
import { mockPageText } from './mockPages'

export interface FetchedPage {
  url: string
  /** The last URL in the redirect chain we actually requested, when there was one. */
  finalUrl: string | null
  /** `ok` = we have text; `failed` = we wanted text and did not get it; `skipped` = not html. */
  status: 'ok' | 'failed' | 'skipped'
  title: string | null
  text: string
  chars: number
  /** Why a non-`ok` page has no text; `null` when `status` is `ok`. */
  reason: string | null
  fetchedAt: string
}

export const FETCH_TIMEOUT_MS = 15_000
export const FETCH_MAX_BYTES = 200_000
export const PAGE_TEXT_CAP_CHARS = 24_000
/** Redirect hops followed before a chain is abandoned; the whole chain shares one deadline. */
export const MAX_REDIRECTS = 5
/** The identifier a site owner would use to contact us; never left half-formed. */
export const USER_AGENT = config.targetDomain
  ? `DatumBot/1.0 (+https://${config.targetDomain})`
  : 'DatumBot/1.0'

const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml']

/** Only the web: never `file:`, `data:`, `ftp:`, or anything else a redirect might reach for. */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** One resolved address for a hostname; the shape `dns.lookup(host, { all: true })` returns. */
export interface ResolvedAddress {
  address: string
  family: number
}

/** Injected in tests so the guard can be exercised without touching DNS. */
export type LookupFn = (hostname: string) => Promise<ResolvedAddress[]>

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true })

/** Why a target was refused, and whether that counts as `skipped` or `failed`. */
type Refusal = { status: 'skipped' | 'failed'; reason: string }

/**
 * Whether one URL may be requested. Refuses a non-web scheme and any host that
 * resolves — wholly or partly — to an address the crawler must not reach; a
 * host that will not resolve at all is a dead host, which is a `failed` fetch
 * rather than a refused one.
 */
async function guardTarget(url: string, lookupImpl: LookupFn): Promise<Refusal | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { status: 'skipped', reason: 'unsupported protocol' }
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { status: 'skipped', reason: 'unsupported protocol' }
  }
  const host = normaliseHostname(parsed.hostname)
  if (isBlockedHostname(host)) return { status: 'skipped', reason: 'private address' }

  let resolved: ResolvedAddress[]
  try {
    resolved = await lookupImpl(host)
  } catch (error) {
    const message = (error as { message?: string })?.message ?? 'lookup failed'
    return { status: 'failed', reason: `dns lookup failed: ${message}` }
  }
  if (resolved.length === 0) return { status: 'failed', reason: 'dns lookup failed: no addresses' }
  // Any blocked address in the set is disqualifying: which one the runtime
  // would pick is not ours to predict.
  if (resolved.some((entry) => isBlockedAddress(entry.address))) {
    return { status: 'skipped', reason: 'private address' }
  }
  return null
}

/**
 * Readability's article text for `html`, whitespace-normalised and capped.
 * Pure: no network, no clock. Falls back to the whole `<body>` when Readability
 * declines to pick an article, which is common on thin or list-shaped pages.
 */
export function extractReadableText(
  html: string,
  url: string,
): { title: string | null; text: string } {
  const { document } = parseHTML(html)
  // linkedom leaves `documentURI` unset and `baseURI` read-only; Readability
  // reads both when it rewrites relative links, so give it the one we can.
  try {
    ;(document as unknown as { documentURI: string }).documentURI = url
  } catch {
    // Not fatal: Readability guards its own URL resolution.
  }
  const doc = document as unknown as Document
  const article = new Readability(doc).parse()
  const raw = (article?.textContent || doc.body?.textContent) ?? ''
  const title = article?.title?.trim() || doc.title?.trim() || null
  return { title, text: normaliseWhitespace(raw).slice(0, PAGE_TEXT_CAP_CHARS) }
}

/** Reads at most `FETCH_MAX_BYTES` of a response body, then cancels the stream. */
async function readCapped(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < FETCH_MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      const room = FETCH_MAX_BYTES - total
      const chunk = value.byteLength > room ? value.subarray(0, room) : value
      chunks.push(chunk)
      total += chunk.byteLength
    }
  } finally {
    // Always release the socket: we bail out early on almost every real page.
    await reader.cancel().catch(() => {})
  }
  const buffer = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  // A cut mid-codepoint decodes to one replacement character, which is fine:
  // the tail of a truncated page is not evidence we would have used anyway.
  return new TextDecoder('utf-8').decode(buffer)
}

/**
 * Fetches one URL and extracts its readable text. Never throws.
 * `mock` defaults to `config.mockMode`, in which case canned per-host text is
 * returned with no network call and no DNS lookup at all. `fetchImpl`,
 * `lookupImpl`, and `now` exist for tests.
 */
export async function fetchPage(
  url: string,
  opts: {
    mock?: boolean
    fetchImpl?: typeof fetch
    lookupImpl?: LookupFn
    now?: () => Date
  } = {},
): Promise<FetchedPage> {
  const now = opts.now ?? (() => new Date())
  const fetchedAt = now().toISOString()
  const mock = opts.mock ?? config.mockMode

  if (mock) {
    const { title, text } = mockPageText(url)
    return {
      url,
      finalUrl: url,
      status: 'ok',
      title,
      text,
      chars: text.length,
      reason: null,
      fetchedAt,
    }
  }

  const failure = (status: 'failed' | 'skipped', reason: string, finalUrl: string | null = null) =>
    ({
      url,
      finalUrl,
      status,
      title: null,
      text: '',
      chars: 0,
      reason,
      fetchedAt,
    }) satisfies FetchedPage

  const doFetch = opts.fetchImpl ?? fetch
  const lookupImpl = opts.lookupImpl ?? defaultLookup
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    let target = url
    for (let hop = 0; ; hop += 1) {
      // A refusal on a later hop reads differently from one on the URL we were
      // handed, so the reason says which it was and `finalUrl` names the hop.
      const refused = await guardTarget(target, lookupImpl)
      if (refused) {
        return failure(
          refused.status,
          hop === 0 ? refused.reason : `redirected to ${refused.reason}`,
          hop === 0 ? null : target,
        )
      }

      const response = await doFetch(target, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: controller.signal,
      })

      const location = REDIRECT_STATUSES.has(response.status)
        ? response.headers.get('location')
        : null
      if (location) {
        // Nothing on a redirect's body is evidence; let the socket go.
        await response.body?.cancel().catch(() => {})
        if (hop >= MAX_REDIRECTS) return failure('skipped', 'too many redirects', target)
        try {
          target = new URL(location, target).toString()
        } catch {
          return failure('skipped', 'redirected to unsupported protocol', target)
        }
        continue
      }

      const finalUrl = target
      if (!response.ok) return failure('failed', `http ${response.status}`, finalUrl)

      const contentType = response.headers.get('content-type') ?? ''
      const type = contentType.toLowerCase()
      if (!HTML_CONTENT_TYPES.some((allowed) => type.includes(allowed))) {
        return failure('skipped', `content-type ${contentType || 'unknown'}`, finalUrl)
      }

      const html = await readCapped(response.body)
      const { title, text } = extractReadableText(html, finalUrl)
      if (text.length === 0) return failure('failed', 'no readable text', finalUrl)
      return {
        url,
        finalUrl,
        status: 'ok',
        title,
        text,
        chars: text.length,
        reason: null,
        fetchedAt,
      }
    }
  } catch (error) {
    const err = error as { name?: string; message?: string }
    return failure(
      'failed',
      err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'fetch failed'),
    )
  } finally {
    clearTimeout(timer)
  }
}
