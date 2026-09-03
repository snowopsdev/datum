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
 * Checking is not enough on its own: `fetch` resolves the hostname a second
 * time when it opens the socket, so a host that answers publicly for the guard
 * and privately a moment later (DNS rebinding) would pass the check and still
 * be connected to a private address. The addresses the guard cleared are
 * therefore *pinned* to the connection — each hop gets its own undici `Agent`
 * whose `connect.lookup` (`pinnedLookup`) hands back only those addresses, and
 * refuses anything `isBlockedAddress` rejects, so no socket can reach an
 * address the guard did not clear. Pinning replaces resolution only; the TLS
 * server name is still the real hostname, so certificate checking is unchanged.
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
import { userAgentFor } from '../tenant'

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
/**
 * The identifier a site owner would use to contact us; never left half-formed.
 * This is the env-derived default. A run that knows its workspace passes
 * `opts.userAgent` (built with `userAgentFor`) so the contact URL names the
 * site in the `workspace-profile` global rather than whatever the host's
 * `TARGET_DOMAIN` happens to be.
 */
export const USER_AGENT = userAgentFor(config.targetDomain)

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

/** A cleared target, carrying the exact addresses that cleared it. */
type Cleared = { allowed: true; host: string; addresses: ResolvedAddress[] }

/**
 * Whether one URL may be requested. Refuses a non-web scheme and any host that
 * resolves — wholly or partly — to an address the crawler must not reach; a
 * host that will not resolve at all is a dead host, which is a `failed` fetch
 * rather than a refused one.
 *
 * A cleared target comes back with the addresses it was cleared on, because
 * those — and only those — are what the connection is allowed to use.
 */
async function guardTarget(
  url: string,
  lookupImpl: LookupFn,
): Promise<Cleared | { allowed: false; refusal: Refusal }> {
  const refuse = (status: 'skipped' | 'failed', reason: string) =>
    ({ allowed: false, refusal: { status, reason } }) as const

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return refuse('skipped', 'unsupported protocol')
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return refuse('skipped', 'unsupported protocol')
  }
  const host = normaliseHostname(parsed.hostname)
  if (isBlockedHostname(host)) return refuse('skipped', 'private address')

  let resolved: ResolvedAddress[]
  try {
    resolved = await lookupImpl(host)
  } catch (error) {
    const message = (error as { message?: string })?.message ?? 'lookup failed'
    return refuse('failed', `dns lookup failed: ${message}`)
  }
  if (resolved.length === 0) return refuse('failed', 'dns lookup failed: no addresses')
  // Any blocked address in the set is disqualifying: which one the runtime
  // would pick is not ours to predict.
  if (resolved.some((entry) => isBlockedAddress(entry.address))) {
    return refuse('skipped', 'private address')
  }
  return { allowed: true, host, addresses: resolved }
}

/**
 * The callback Node's `net.connect` hands a custom `lookup`: an array when it
 * asked for `all` (which it does by default, for happy-eyeballs), otherwise a
 * single address and family.
 */
type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | ResolvedAddress[],
  family?: number,
) => void

/** A `lookup` in the shape `net.connect` — and so undici's connector — expects. */
export type PinnedLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
) => void

/**
 * A `lookup` that resolves `host` to exactly the addresses the guard already
 * cleared, and nothing else.
 *
 * This is what closes the gap between checking an address and connecting to
 * one: the socket cannot re-resolve the name, so a second, private DNS answer
 * has nowhere to arrive. `isBlockedAddress` is applied again here rather than
 * trusted from the caller — the pinned set is the last thing between a URL and
 * a socket, and it should be able to stand on its own. Any other hostname, or
 * an empty allowed set, is an error: refusing to answer is the only safe
 * failure mode, because falling back to real DNS is the very thing being
 * prevented.
 */
export function pinnedLookup(host: string, addresses: ResolvedAddress[]): PinnedLookup {
  const expected = normaliseHostname(host)
  const allowed = addresses.filter((entry) => !isBlockedAddress(entry.address))
  return (hostname, options, callback) => {
    if (normaliseHostname(hostname) !== expected) {
      callback(new Error(`pinned lookup: ${hostname} is not the validated host ${expected}`), '')
      return
    }
    const first = allowed[0]
    if (!first) {
      callback(new Error(`pinned lookup: no allowed address for ${expected}`), '')
      return
    }
    if (options?.all) {
      callback(
        null,
        allowed.map((entry) => ({ address: entry.address, family: entry.family })),
      )
      return
    }
    callback(null, first.address, first.family)
  }
}

/** As much of undici's `Agent` as this module uses. */
interface PinnedDispatcher {
  destroy(): Promise<void>
}

/**
 * An undici dispatcher that will only ever connect to `addresses`.
 *
 * undici is imported dynamically so the module stays loadable — and the tests
 * stay hermetic — without it: an injected `fetchImpl` never reaches this.
 */
async function pinnedDispatcher(
  host: string,
  addresses: ResolvedAddress[],
): Promise<PinnedDispatcher> {
  const { Agent } = await import('undici')
  return new Agent({ connect: { lookup: pinnedLookup(host, addresses) } })
}

/** `fetch`'s init plus undici's `dispatcher`, which Node honours but does not type. */
type CrawlRequestInit = RequestInit & { dispatcher?: PinnedDispatcher }

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

/**
 * Releases a response body we are not going to read.
 *
 * Every early return owes this: a `fetch` response whose body is neither
 * consumed nor cancelled keeps its connection open, so a server that dribbles
 * an error page or a non-HTML body indefinitely would park a socket per page
 * and accumulate them across snapshots — long after `fetchPage` has reported.
 * Never throws: a body already cancelled, already read, or absent (a stub, a
 * 204) is exactly the state we wanted.
 */
async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // Already cancelled, already read, or locked: nothing left to release.
  }
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
 * returned with no network call and no DNS lookup at all. `userAgent` defaults
 * to the env-derived `USER_AGENT`. `fetchImpl`, `lookupImpl`, and `now` exist
 * for tests.
 */
export async function fetchPage(
  url: string,
  opts: {
    mock?: boolean
    fetchImpl?: typeof fetch
    lookupImpl?: LookupFn
    now?: () => Date
    /** Crawler identity for this request; defaults to the env-derived `USER_AGENT`. */
    userAgent?: string
    /**
     * The raw HTML, handed over before Readability reduces it to text.
     *
     * Callers that need the page's links have no other way to get them:
     * `FetchedPage.text` is Readability's `textContent`, which has already
     * thrown every anchor away. Rather than widen `FetchedPage` — it is stored
     * on every corpus snapshot row, and 200 kB of markup has no business
     * there — the HTML is offered once, in passing, to whoever asked for it.
     * Never called in mock mode, where there is no markup to offer.
     */
    onHtml?: (html: string) => void
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
  const userAgent = opts.userAgent?.trim() || USER_AGENT
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  // One per hop; torn down together once the page is read or given up on.
  const dispatchers: PinnedDispatcher[] = []
  try {
    let target = url
    for (let hop = 0; ; hop += 1) {
      // A refusal on a later hop reads differently from one on the URL we were
      // handed, so the reason says which it was and `finalUrl` names the hop.
      const guard = await guardTarget(target, lookupImpl)
      if (!guard.allowed) {
        const { status, reason } = guard.refusal
        return failure(
          status,
          hop === 0 ? reason : `redirected to ${reason}`,
          hop === 0 ? null : target,
        )
      }

      // Pin this hop's connection to the addresses just cleared. Only the real
      // `fetch` gets a dispatcher: an injected `fetchImpl` is a stub with no
      // socket to pin, and giving it one would drag undici into the tests.
      const init: CrawlRequestInit = {
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: controller.signal,
      }
      if (!opts.fetchImpl) {
        const dispatcher = await pinnedDispatcher(guard.host, guard.addresses)
        dispatchers.push(dispatcher)
        init.dispatcher = dispatcher
      }

      const response = await doFetch(target, init)

      const location = REDIRECT_STATUSES.has(response.status)
        ? response.headers.get('location')
        : null
      if (location) {
        // Nothing on a redirect's body is evidence; let the socket go.
        await cancelBody(response)
        if (hop >= MAX_REDIRECTS) return failure('skipped', 'too many redirects', target)
        try {
          target = new URL(location, target).toString()
        } catch {
          return failure('skipped', 'redirected to unsupported protocol', target)
        }
        continue
      }

      const finalUrl = target
      // Neither branch below reads the body, so release it before reporting.
      if (!response.ok) {
        await cancelBody(response)
        return failure('failed', `http ${response.status}`, finalUrl)
      }

      const contentType = response.headers.get('content-type') ?? ''
      const type = contentType.toLowerCase()
      if (!HTML_CONTENT_TYPES.some((allowed) => type.includes(allowed))) {
        await cancelBody(response)
        return failure('skipped', `content-type ${contentType || 'unknown'}`, finalUrl)
      }

      const html = await readCapped(response.body)
      // Before extraction, so a page with no readable article still yields its
      // links. A caller's callback is not allowed to sink the fetch.
      if (opts.onHtml) {
        try {
          opts.onHtml(html)
        } catch {
          // The caller's problem, not this page's.
        }
      }
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
    // By here every body is read, cancelled, or aborted, so nothing is in
    // flight for `destroy` to cut short — it just returns the sockets.
    for (const dispatcher of dispatchers) await dispatcher.destroy().catch(() => {})
  }
}
