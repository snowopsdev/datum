import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  candidatePagePaths,
  isSameSite,
  MAX_DISCOVERED_PAGES,
  MAX_SITE_PAGES,
  SITE_PAGE_PATH_PATTERN,
  SITE_PAGE_TEXT_CAP,
  toSitePage,
} from '../../cms/src/lib/tenant/sitePages'
import { mockPageText } from '../src/corpus/mockPages'

const HOME = 'https://acme.example/'

const html = (...hrefs: string[]): string =>
  `<html><body><nav>${hrefs.map((href) => `<a href="${href}">link</a>`).join('')}</nav></body></html>`

describe('SITE_PAGE_PATH_PATTERN', () => {
  it('accepts the marketing paths and their sub-paths', () => {
    for (const path of [
      '/about',
      '/about/',
      '/about-us',
      '/about/team',
      '/product',
      '/product/analytics',
      '/pricing',
      '/customers',
      '/customers/acme',
      '/features',
      '/why',
      '/why-datum',
      '/solutions/retail',
    ]) {
      assert.equal(SITE_PAGE_PATH_PATTERN.test(path), true, path)
    }
  })

  it('takes the blog index but never a post', () => {
    assert.equal(SITE_PAGE_PATH_PATTERN.test('/blog'), true)
    assert.equal(SITE_PAGE_PATH_PATTERN.test('/blog/'), true)
    assert.equal(SITE_PAGE_PATH_PATTERN.test('/blog/how-to-rank'), false)
  })

  it('rejects the home page, unrelated paths, and prefixes that only look right', () => {
    for (const path of ['/', '/careers', '/legal/privacy', '/aboutish', '/productive', '/whymper']) {
      assert.equal(SITE_PAGE_PATH_PATTERN.test(path), false, path)
    }
  })
})

describe('candidatePagePaths', () => {
  it('resolves relative links against the home URL', () => {
    assert.deepEqual(candidatePagePaths(html('/about', 'pricing', './features'), HOME), [
      'https://acme.example/about',
      'https://acme.example/pricing',
      'https://acme.example/features',
    ])
  })

  it('keeps only the same host', () => {
    const page = html(
      'https://acme.example/about',
      'https://other.example/pricing',
      '//cdn.acme.example/features',
      'https://ACME.EXAMPLE/product',
    )
    assert.deepEqual(candidatePagePaths(page, HOME), [
      'https://acme.example/about',
      'https://acme.example/product',
    ])
  })

  it('ignores schemes that are not http or https', () => {
    const page = html('mailto:hi@acme.example', 'javascript:void(0)', '/about')
    assert.deepEqual(candidatePagePaths(page, HOME), ['https://acme.example/about'])
  })

  it('keeps document order and de-duplicates by path', () => {
    const page = html(
      '/pricing',
      '/about',
      '/pricing/',
      '/About',
      '/pricing#plans',
      '/about?utm_source=nav',
    )
    assert.deepEqual(candidatePagePaths(page, HOME), [
      'https://acme.example/pricing',
      'https://acme.example/about',
    ])
  })

  it('drops the fragment and the query from what it returns', () => {
    assert.deepEqual(candidatePagePaths(html('/pricing?utm_source=nav#plans'), HOME), [
      'https://acme.example/pricing',
    ])
  })

  it('never proposes the home page it was given', () => {
    assert.deepEqual(candidatePagePaths(html('/', 'https://acme.example/', '#top'), HOME), [])
  })

  it('caps at seven so the home page still fits under the ceiling', () => {
    const page = html(
      '/about',
      '/product',
      '/pricing',
      '/customers',
      '/features',
      '/why',
      '/solutions',
      '/blog',
    )
    const found = candidatePagePaths(page, HOME)
    assert.equal(found.length, MAX_DISCOVERED_PAGES)
    assert.equal(MAX_DISCOVERED_PAGES + 1, MAX_SITE_PAGES)
    assert.ok(found.every((url) => url !== 'https://acme.example/blog'))
  })

  it('reads unquoted and single-quoted href attributes', () => {
    const page = "<a href='/about'>a</a><a href=/pricing class=nav>b</a>"
    assert.deepEqual(candidatePagePaths(page, HOME), [
      'https://acme.example/about',
      'https://acme.example/pricing',
    ])
  })

  it('finds absolute URLs written in plain prose, punctuation and all', () => {
    const text =
      'Read more at https://acme.example/about, or see https://acme.example/pricing. ' +
      'We also blog at https://acme.example/blog/how-we-work.'
    assert.deepEqual(candidatePagePaths(text, HOME), [
      'https://acme.example/about',
      'https://acme.example/pricing',
    ])
  })

  it('returns nothing for an unusable home URL or an empty page', () => {
    assert.deepEqual(candidatePagePaths(html('/about'), 'not a url'), [])
    assert.deepEqual(candidatePagePaths('', HOME), [])
  })
})

describe('toSitePage', () => {
  const base = {
    url: 'https://acme.example/about',
    finalUrl: 'https://acme.example/about-us',
    title: '  About Acme  ',
    text: 'x'.repeat(SITE_PAGE_TEXT_CAP + 500),
    fetchedAt: '2026-09-02T00:00:00.000Z',
  }

  it('records the URL actually read and caps the text', () => {
    const page = toSitePage(base)
    assert.equal(page.url, 'https://acme.example/about-us')
    assert.equal(page.title, 'About Acme')
    assert.equal(page.text.length, SITE_PAGE_TEXT_CAP)
    assert.equal(page.fetchedAt, base.fetchedAt)
  })

  it('falls back to the requested URL and a null title', () => {
    const page = toSitePage({ ...base, finalUrl: null, title: '   ', text: 'short' })
    assert.equal(page.url, 'https://acme.example/about')
    assert.equal(page.title, null)
    assert.equal(page.text, 'short')
  })
})

describe('isSameSite', () => {
  it('accepts the domain itself, either scheme, and the www variant either way', () => {
    for (const [url, domain] of [
      ['https://acme.example/', 'acme.example'],
      ['http://acme.example/about', 'acme.example'],
      ['https://www.acme.example/about', 'acme.example'],
      ['https://acme.example/about', 'www.acme.example'],
      ['https://ACME.example./about', 'acme.example'],
      // The workspace stores a bare domain, but somebody will paste a URL.
      ['https://acme.example/', 'https://acme.example/pricing'],
    ] as const) {
      assert.equal(isSameSite(url, domain), true, `${url} vs ${domain}`)
    }
  })

  it('refuses another company, a sub-domain, and anything unreadable', () => {
    for (const [url, domain] of [
      ['https://parked-domains.example/for-sale', 'acme.example'],
      ['https://acme.example.evil.test/', 'acme.example'],
      // A sub-domain is a different site: `blog.acme.example` may be a hosted
      // service the company does not write, and its copy is not theirs.
      ['https://blog.acme.example/about', 'acme.example'],
      ['ftp://acme.example/about', 'acme.example'],
      ['not a url', 'acme.example'],
      ['', 'acme.example'],
      ['https://acme.example/', ''],
    ] as const) {
      assert.equal(isSameSite(url, domain), false, `${url} vs ${domain}`)
    }
    assert.equal(isSameSite(null, 'acme.example'), false)
    assert.equal(isSameSite(undefined, 'acme.example'), false)
  })
})

describe('mock workspace pages', () => {
  it('serves a different page per path on the demo domain', () => {
    const titles = [
      'https://datum.example.com/',
      'https://datum.example.com/about',
      'https://datum.example.com/product',
      'https://datum.example.com/pricing',
    ].map((url) => mockPageText(url).title)
    assert.equal(new Set(titles).size, 4)
  })

  it('treats a trailing slash and a different case as the same page', () => {
    const home = mockPageText('https://datum.example.com/').title
    assert.equal(mockPageText('https://datum.example.com/About/').title, mockPageText('https://datum.example.com/about').title)
    assert.equal(mockPageText('https://datum.example.com/careers').title, home)
  })

  it('gives the home page links the setup fetch can discover', () => {
    const home = mockPageText('https://datum.example.com/')
    assert.deepEqual(candidatePagePaths(home.text, 'https://datum.example.com/'), [
      'https://datum.example.com/about',
      'https://datum.example.com/product',
      'https://datum.example.com/pricing',
    ])
  })

  it('leaves the competitor and generic pages alone', () => {
    assert.equal(
      mockPageText('https://competitor-one.com/guide').title,
      'The complete guide to setting up a home espresso station',
    )
    assert.equal(mockPageText('https://somewhere-else.example/x').title, 'Home espresso station basics')
  })
})
