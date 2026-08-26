/**
 * Fetches a competitor page and reduces it to readable text.
 *
 * This is the pipeline's only outbound crawl, so it is deliberately timid: one
 * request, a hard timeout, a byte ceiling on the response body, and a character
 * ceiling on the extracted text. It never throws — a snapshot of ten SERP
 * results should not fail because one of them is a PDF or a dead host, so every
 * outcome comes back as a `FetchedPage` with a `status` and a `reason`.
 *
 * The one outbound safety check is the scheme: only `http:`/`https:` are
 * fetched, before the request and again on `response.url` after redirects.
 * V1 does not read robots.txt, does not resolve hosts to reject private
 * addresses, has no per-host throttle, and does no sanitisation beyond what
 * Readability already strips; the text is only ever fed to an LLM, never
 * rendered.
 */

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

import { config } from '../config'
import { normaliseWhitespace } from '../informationGain/lib'
import { mockPageText } from './mockPages'

export interface FetchedPage {
  url: string
  /** `response.url` after redirects, when the response exposes one. */
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
/** The identifier a site owner would use to contact us; never left half-formed. */
export const USER_AGENT = config.targetDomain
  ? `DatumBot/1.0 (+https://${config.targetDomain})`
  : 'DatumBot/1.0'

const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml']

/** Only the web: never `file:`, `data:`, `ftp:`, or anything else a redirect might reach for. */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

/** The URL's protocol, or null when it does not parse as a URL at all. */
function protocolOf(url: string): string | null {
  try {
    return new URL(url).protocol
  } catch {
    return null
  }
}

const isWebUrl = (url: string): boolean => {
  const protocol = protocolOf(url)
  return protocol !== null && ALLOWED_PROTOCOLS.includes(protocol)
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
 * returned with no network call at all. `fetchImpl` and `now` exist for tests.
 */
export async function fetchPage(
  url: string,
  opts: { mock?: boolean; fetchImpl?: typeof fetch; now?: () => Date } = {},
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

  // SERP URLs are low-trust input and the body ends up in Postgres and in an
  // LLM prompt, so the scheme is checked before the request and again after
  // redirects. This is a protocol guard only: no DNS or private-IP resolution.
  if (!isWebUrl(url)) return failure('skipped', 'unsupported protocol')

  const doFetch = opts.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await doFetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const finalUrl = response.url || null
    if (finalUrl !== null && !isWebUrl(finalUrl)) {
      return failure('skipped', 'redirected to unsupported protocol', finalUrl)
    }
    if (!response.ok) return failure('failed', `http ${response.status}`, finalUrl)

    const contentType = response.headers.get('content-type') ?? ''
    const type = contentType.toLowerCase()
    if (!HTML_CONTENT_TYPES.some((allowed) => type.includes(allowed))) {
      return failure('skipped', `content-type ${contentType || 'unknown'}`, finalUrl)
    }

    const html = await readCapped(response.body)
    const { title, text } = extractReadableText(html, finalUrl ?? url)
    if (text.length === 0) return failure('failed', 'no readable text', finalUrl)
    return { url, finalUrl, status: 'ok', title, text, chars: text.length, reason: null, fetchedAt }
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
