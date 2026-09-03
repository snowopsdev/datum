/**
 * Which pages of the workspace's own site the setup assistant gets to read.
 *
 * The assistant drafts ICPs, positioning, and evidence from what the company
 * already says about itself, so the crawl is deliberately narrow: the home page
 * plus the handful of marketing paths that carry that story. Blog posts are not
 * in it — `/blog` itself is the index, and every post under it is content we
 * are about to compete with rather than a statement of who the company is.
 *
 * Dependency-free like the rest of `lib/tenant/`: no `payload`, no `next`, no
 * DOM. Link discovery is therefore a regex over whatever the fetcher could give
 * us, which is HTML for a live fetch and readable text for a mock one — hence
 * `homeHtmlOrText`. Readability strips anchors, so a live caller must pass the
 * raw HTML (`fetchPage`'s `onHtml`) or discover nothing.
 */

import type { SitePage } from './workspaceProfile'

/** Home page plus the discovered pages. Eight bodies is roughly 16k tokens of context. */
export const MAX_SITE_PAGES = 8

/** How many pages discovery may propose: the home page takes the last slot. */
export const MAX_DISCOVERED_PAGES = MAX_SITE_PAGES - 1

/** Per-page character ceiling. The whole set lives in one json column. */
export const SITE_PAGE_TEXT_CAP = 8_000

/**
 * Paths worth reading, as a path-only test.
 *
 * The seven marketing prefixes match their sub-paths too (`/product/pricing`,
 * `/about-us`, `/solutions/retail`) because sites split that story differently.
 * A prefix only matches at a segment or hyphen boundary, so `/aboutus-blog`
 * counts and `/aboutish` does not. `/blog` is the exception: the index only,
 * never a post.
 */
export const SITE_PAGE_PATH_PATTERN =
  /^\/(?:about|product|pricing|customers|features|why|solutions)(?:[/-].*)?$|^\/blog\/?$/i

/**
 * Link-shaped tokens, in document order: a quoted `href`, an unquoted `href`,
 * or a bare absolute URL sitting in prose. The last alternative is what makes
 * discovery work against readable text, where the markup is already gone.
 */
const LINK_SOURCE =
  'href\\s*=\\s*"([^"]*)"' +
  "|href\\s*=\\s*'([^']*)'" +
  '|href\\s*=\\s*([^\\s"\'`=<>]+)' +
  '|(https?://[^\\s"\'`<>()\\[\\]]+)'

/** `Example.COM.` and `example.com` are one host. */
const hostKey = (hostname: string): string => hostname.replace(/\.+$/, '').toLowerCase()

/** `/About/` and `/about` are one page. */
const pathKey = (pathname: string): string => pathname.replace(/\/+$/, '').toLowerCase()

/**
 * Same-host URLs on `homeUrl`'s site whose path is worth reading, in the order
 * they appear, de-duplicated by path, capped at `MAX_DISCOVERED_PAGES`.
 *
 * Fragments and query strings are dropped: on these paths they are anchors and
 * tracking parameters, and keeping them would fetch one page several times.
 * Anything that is not `http`/`https`, is not on the same host, or does not
 * match the path pattern is ignored rather than reported — a home page links to
 * hundreds of things and none of them are errors.
 */
export function candidatePagePaths(homeHtmlOrText: string, homeUrl: string): string[] {
  let home: URL
  try {
    home = new URL(homeUrl)
  } catch {
    return []
  }
  if (typeof homeHtmlOrText !== 'string' || homeHtmlOrText.length === 0) return []

  const host = hostKey(home.hostname)
  // The home page is fetched on its own, so never propose it a second time.
  const seen = new Set<string>([pathKey(home.pathname)])
  const urls: string[] = []

  for (const match of homeHtmlOrText.matchAll(new RegExp(LINK_SOURCE, 'gi'))) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim()
    if (!raw) continue
    // A URL written in prose collects the sentence's punctuation.
    const cleaned = raw.replace(/[.,;:!?]+$/, '')
    if (!cleaned) continue

    let link: URL
    try {
      link = new URL(cleaned, home)
    } catch {
      continue
    }
    if (link.protocol !== 'http:' && link.protocol !== 'https:') continue
    if (hostKey(link.hostname) !== host) continue
    if (!SITE_PAGE_PATH_PATTERN.test(link.pathname)) continue

    const key = pathKey(link.pathname)
    if (seen.has(key)) continue
    seen.add(key)

    link.hash = ''
    link.search = ''
    urls.push(link.toString())
    if (urls.length >= MAX_DISCOVERED_PAGES) break
  }

  return urls
}

/** As much of a fetch result as a stored page needs. */
export interface FetchedPageLike {
  url: string
  finalUrl: string | null
  title: string | null
  text: string
  fetchedAt: string
}

/**
 * One stored page. The URL recorded is the one we actually read, so a page
 * reached through a redirect is cited by its real address rather than the guess
 * discovery made.
 */
export function toSitePage(fetched: FetchedPageLike): SitePage {
  return {
    url: fetched.finalUrl || fetched.url,
    title: fetched.title?.trim() || null,
    text: fetched.text.slice(0, SITE_PAGE_TEXT_CAP),
    fetchedAt: fetched.fetchedAt,
  }
}
