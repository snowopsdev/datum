import config from '@/payload.config'
import { MAX_SITE_PAGES, SITE_PAGE_TEXT_CAP } from '@/lib/tenant/sitePages'
import type { SitePage, WorkspaceProfileDoc } from '@/lib/tenant/workspaceProfile'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const FETCH_PAGE_MODULE = '../../../pipeline/src/corpus/fetchPage'

type FetchPageModule = typeof import('../../../pipeline/src/corpus/fetchPage')
type FetchedPage = Awaited<ReturnType<FetchPageModule['fetchPage']>>

/**
 * The real fetcher by default — mock mode makes it hermetic — swapped per test
 * for the cases the canned pages cannot produce: a refused host, an oversized
 * body, and more links than the ceiling allows.
 */
const fetchPageMock = vi.fn()

const authMock = vi.fn(async () => ({ user: { id: 1, email: 'setup@example.com' } }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('../../../pipeline/src/corpus/fetchPage', async (importOriginal) => {
  const actual = await importOriginal<FetchPageModule>()
  return { ...actual, fetchPage: (...args: unknown[]) => fetchPageMock(...args) }
})

// The action authenticates through `getPayload`, and there is no Next request
// scope here to authenticate against. Everything else is the real instance, so
// the audit row this writes is a real row in a real table.
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async (args: Parameters<typeof actual.getPayload>[0]) => {
      const real = await actual.getPayload(args)
      return new Proxy(real, {
        get(target, property) {
          if (property === 'auth') return authMock
          const value = Reflect.get(target, property)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }),
  }
})

const { fetchPage: realFetchPage } = await vi.importActual<FetchPageModule>(FETCH_PAGE_MODULE)
const { refreshSitePagesAction } = await import('@/components/ops/setupActions')

const DOMAIN = 'datum.example.com'
const HOME = `https://${DOMAIN}/`

let payload: Payload
let original: WorkspaceProfileDoc

const readGlobal = () =>
  payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true })

const okPage = (url: string, text: string, title = 'A page'): FetchedPage => ({
  url,
  finalUrl: url,
  status: 'ok',
  title,
  text,
  chars: text.length,
  reason: null,
  fetchedAt: '2026-09-02T00:00:00.000Z',
})

const refusedPage = (url: string, reason: string): FetchedPage => ({
  url,
  finalUrl: null,
  status: 'skipped',
  title: null,
  text: '',
  chars: 0,
  reason,
  fetchedAt: '2026-09-02T00:00:00.000Z',
})

/** A home page whose readable text names the links we want discovered. */
const homeLinking = (...paths: string[]): string =>
  `Datum builds content. ${paths.map((path) => `https://${DOMAIN}${path}`).join(' and ')}.`

const latestAuditRow = async (createdAfter: string) => {
  const { docs } = await payload.find({
    collection: 'governance-audit',
    where: {
      and: [
        { subjectGlobal: { equals: 'workspace-profile' } },
        { createdAt: { greater_than_equal: createdAfter } },
      ],
    },
    sort: '-createdAt',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return docs[0]
}

const setDomain = (targetDomain: string | null) =>
  payload.updateGlobal({
    slug: 'workspace-profile',
    overrideAccess: true,
    data: { targetDomain },
  })

describe('refreshSitePagesAction', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    original = (await readGlobal()) as WorkspaceProfileDoc
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'workspace-profile',
      overrideAccess: true,
      data: {
        targetDomain: original.targetDomain ?? null,
        sitePages: original.sitePages ?? null,
        sitePagesFetchedAt: original.sitePagesFetchedAt ?? null,
      },
    })
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    vi.unstubAllEnvs()
    fetchPageMock.mockReset()
    fetchPageMock.mockImplementation(realFetchPage)
    await setDomain(DOMAIN)
  })

  it('stores the mock workspace pages and records who fetched them', async () => {
    const startedAt = new Date().toISOString()
    const result = await refreshSitePagesAction()

    expect(result).toEqual({ ok: true, pages: 4, warnings: [] })

    const doc = (await readGlobal()) as WorkspaceProfileDoc
    const pages = doc.sitePages as SitePage[]
    expect(pages.map((page) => page.url)).toEqual([
      HOME,
      `${HOME}about`,
      `${HOME}product`,
      `${HOME}pricing`,
    ])
    expect(pages.every((page) => page.text.length > 0)).toBe(true)
    expect(doc.sitePagesFetchedAt).toBeTruthy()

    const row = await latestAuditRow(startedAt)
    expect(row?.event).toBe('site_pages_refreshed')
    expect(row?.summary).toBe(`Fetched 4 pages from ${DOMAIN}`)
    expect(row?.actor).toBe('setup@example.com')
    expect((row?.details as { urls: string[] }).urls).toHaveLength(4)
  })

  it('caps the stored set at eight pages and each body at the text ceiling', async () => {
    const paths = [
      '/about',
      '/product',
      '/pricing',
      '/customers',
      '/features',
      '/why',
      '/solutions',
      '/blog',
      '/about/team',
      '/product/api',
    ]
    fetchPageMock.mockImplementation(async (url: string) =>
      url === HOME
        ? okPage(url, homeLinking(...paths))
        : okPage(url, 'x'.repeat(SITE_PAGE_TEXT_CAP + 2_000)),
    )

    const result = await refreshSitePagesAction()
    expect(result).toEqual({ ok: true, pages: MAX_SITE_PAGES, warnings: [] })

    const pages = ((await readGlobal()) as WorkspaceProfileDoc).sitePages as SitePage[]
    expect(pages).toHaveLength(MAX_SITE_PAGES)
    for (const page of pages.slice(1)) expect(page.text.length).toBe(SITE_PAGE_TEXT_CAP)
  })

  it('reports a refused host as a warning and keeps the pages that loaded', async () => {
    fetchPageMock.mockImplementation(async (url: string) => {
      if (url === HOME) return okPage(url, homeLinking('/about', '/pricing'))
      if (url === `${HOME}pricing`) return refusedPage(url, 'private address')
      return okPage(url, 'About us.')
    })

    const result = await refreshSitePagesAction()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pages).toBe(2)
    expect(result.warnings).toEqual([`${HOME}pricing: private address`])
  })

  it('fails without writing anything when the home page cannot be read', async () => {
    fetchPageMock.mockImplementation(async (url: string) => refusedPage(url, 'private address'))

    const result = await refreshSitePagesAction()

    expect(result).toEqual({ ok: false, error: `Could not read ${HOME} — private address.` })
    expect(fetchPageMock).toHaveBeenCalledTimes(1)
  })

  it('refuses when the workspace has no target domain anywhere', async () => {
    await setDomain(null)
    // Only a live run has no domain: mock mode always falls back to the demo
    // workspace. Nothing is fetched, so no live call is made either.
    vi.stubEnv('MOCK_MODE', 'false')
    vi.stubEnv('TARGET_DOMAIN', '')
    fetchPageMock.mockImplementation(async () => {
      throw new Error('the action must not fetch without a domain')
    })

    const result = await refreshSitePagesAction()

    expect(result).toEqual({
      ok: false,
      error: 'Set the target domain on the workspace before fetching its pages.',
    })
    expect(fetchPageMock).not.toHaveBeenCalled()
  })
})
