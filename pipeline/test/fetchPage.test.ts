import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  extractReadableText,
  fetchPage,
  FETCH_MAX_BYTES,
  PAGE_TEXT_CAP_CHARS,
  USER_AGENT,
} from '../src/corpus/fetchPage'
import { mockPageText } from '../src/corpus/mockPages'

const encoder = new TextEncoder()

interface StreamState {
  pulled: number
  cancelled: boolean
}

const bodyOf = (chunks: string[], state: StreamState): ReadableStream<Uint8Array> => {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      const bytes = encoder.encode(chunks[index] ?? '')
      index += 1
      state.pulled += bytes.byteLength
      controller.enqueue(bytes)
    },
    cancel() {
      state.cancelled = true
    },
  })
}

const responseOf = (opts: {
  status?: number
  url?: string
  contentType?: string | null
  chunks?: string[]
  state?: StreamState
}): Response => {
  const status = opts.status ?? 200
  const headers = new Headers()
  if (opts.contentType !== null)
    headers.set('content-type', opts.contentType ?? 'text/html; charset=utf-8')
  return {
    ok: status >= 200 && status < 300,
    status,
    url: opts.url ?? '',
    headers,
    body: bodyOf(opts.chunks ?? [], opts.state ?? { pulled: 0, cancelled: false }),
  } as unknown as Response
}

const stubFetch = (response: Response | (() => never)): typeof fetch =>
  (async () => (typeof response === 'function' ? response() : response)) as unknown as typeof fetch

const articleHtml = (body: string, title = 'Doc Title'): string =>
  `<!doctype html><html><head><title>${title}</title></head><body>` +
  '<nav><a href="/a">Nav Link One</a><a href="/b">Nav Link Two</a></nav>' +
  `<article><h1>Real Heading</h1><p>${body}</p></article>` +
  '<aside>Sidebar promo junk</aside></body></html>'

// Readability needs a few hundred characters before it treats a node as the
// article, so the padding is load-bearing, not decoration.
const padding = 'Dial in the shot and taste it before you change anything else. '.repeat(12)

describe('extractReadableText', () => {
  it('keeps the article text and drops navigation and sidebars', () => {
    const html = articleHtml(`${padding}The grinder matters more than the machine.`)
    const { title, text } = extractReadableText(html, 'https://example.com/guide')
    assert.equal(title, 'Doc Title')
    assert.ok(text.includes('The grinder matters more than the machine.'))
    assert.ok(!text.includes('Nav Link One'), 'navigation should be dropped')
    assert.ok(!text.includes('Sidebar promo junk'), 'sidebar should be dropped')
  })

  it('collapses runs of whitespace and trims', () => {
    const html = articleHtml(`${padding}Second   paragraph\n\n\there.`)
    const { text } = extractReadableText(html, 'https://example.com/guide')
    assert.ok(text.includes('Second paragraph here.'))
    assert.equal(text, text.trim())
    assert.ok(!/\s{2}/.test(text), 'no double whitespace should survive')
  })

  it('caps the text at PAGE_TEXT_CAP_CHARS', () => {
    const long = 'Espresso needs a repeatable recipe every single morning. '.repeat(700)
    assert.ok(long.length > PAGE_TEXT_CAP_CHARS)
    const { text } = extractReadableText(articleHtml(long), 'https://example.com/long')
    assert.equal(text.length, PAGE_TEXT_CAP_CHARS)
  })

  it('falls back to the body text when Readability finds no article', () => {
    const html =
      '<html><head><title>Bare</title></head><body>  Just   loose   words  </body></html>'
    const { text } = extractReadableText(html, 'https://example.com/bare')
    assert.equal(text, 'Just loose words')
  })

  it('returns an empty string for a document with no text at all', () => {
    const { text } = extractReadableText('<html><body></body></html>', 'https://example.com/empty')
    assert.equal(text, '')
  })
})

describe('fetchPage (mock branch)', () => {
  it('returns the mock text for the requested host', async () => {
    const url = 'https://competitor-one.com/blog/home-espresso-station'
    const page = await fetchPage(url, {
      mock: true,
      now: () => new Date('2026-08-25T10:00:00.000Z'),
    })
    const expected = mockPageText(url)
    assert.equal(page.status, 'ok')
    assert.equal(page.url, url)
    assert.equal(page.finalUrl, url)
    assert.equal(page.title, expected.title)
    assert.equal(page.text, expected.text)
    assert.equal(page.chars, expected.text.length)
    assert.equal(page.reason, null)
    assert.equal(page.fetchedAt, '2026-08-25T10:00:00.000Z')
  })

  it('varies the text by host and shares the five facet sentences', async () => {
    const urls = [
      'https://competitor-one.com/blog/x',
      'https://competitor-two.com/x',
      'https://industry-mag.example.com/lessons',
      'https://somewhere-else.example.org/x',
    ]
    const pages = await Promise.all(urls.map((url) => fetchPage(url, { mock: true })))
    const texts = pages.map((p) => p.text)
    assert.equal(new Set(texts).size, urls.length, 'each host should render its own text')
    for (const text of texts) {
      const words = text.split(/\s+/).filter(Boolean).length
      assert.ok(words >= 300 && words <= 500, `expected 300-500 words, got ${words}`)
      for (const sentence of [
        'Most beginners spend between $500 and $1,500 on a first espresso setup.',
        'The grinder matters more than the machine.',
        'Start with 18 grams in and 36 grams out in 25 to 30 seconds.',
        'Stale beans are the most common cause of bad espresso; use beans within a month of roasting.',
        'Purge the steam wand before and after each use and backflush weekly.',
      ]) {
        assert.ok(text.includes(sentence), `missing verbatim sentence: ${sentence}`)
      }
    }
  })
})

describe('fetchPage (live branch)', () => {
  it('reads a 200 html response and reports the final url', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return responseOf({ url: 'https://example.com/final', chunks: [articleHtml(padding)] })
    }) as unknown as typeof fetch

    const page = await fetchPage('https://example.com/start', { mock: false, fetchImpl })
    assert.equal(page.status, 'ok')
    assert.equal(page.url, 'https://example.com/start')
    assert.equal(page.finalUrl, 'https://example.com/final')
    assert.equal(page.title, 'Doc Title')
    assert.ok(page.chars > 0)
    assert.equal(page.chars, page.text.length)
    assert.equal(page.reason, null)
    assert.ok(!Number.isNaN(Date.parse(page.fetchedAt)))

    const request = seen as unknown as { url: string; init: RequestInit }
    assert.equal(request.url, 'https://example.com/start')
    assert.equal(request.init.redirect, 'follow')
    const headers = request.init.headers as Record<string, string>
    assert.equal(headers['User-Agent'], USER_AGENT)
    assert.equal(headers.Accept, 'text/html,application/xhtml+xml')
    assert.ok(request.init.signal, 'a timeout signal should be attached')
  })

  it('fails on a non-2xx response', async () => {
    const page = await fetchPage('https://example.com/missing', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ status: 404 })),
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'http 404')
    assert.equal(page.text, '')
    assert.equal(page.chars, 0)
  })

  it('skips a non-html content type', async () => {
    const page = await fetchPage('https://example.com/paper.pdf', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ contentType: 'application/pdf' })),
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'content-type application/pdf')
    assert.equal(page.text, '')
  })

  it('accepts application/xhtml+xml', async () => {
    const page = await fetchPage('https://example.com/x', {
      mock: false,
      fetchImpl: stubFetch(
        responseOf({ contentType: 'application/xhtml+xml', chunks: [articleHtml(padding)] }),
      ),
    })
    assert.equal(page.status, 'ok')
  })

  it('stops reading after FETCH_MAX_BYTES and caps the extracted text', async () => {
    const state: StreamState = { pulled: 0, cancelled: false }
    const chunk = 'Espresso needs a repeatable recipe every single morning. '.repeat(200)
    const chunks = [
      '<!doctype html><html><head><title>Huge</title></head><body><article><p>',
      ...Array.from({ length: 60 }, () => chunk),
      '</p></article></body></html>',
    ]
    const totalBytes = chunks.reduce((sum, c) => sum + encoder.encode(c).byteLength, 0)
    assert.ok(totalBytes > FETCH_MAX_BYTES * 2, 'test body must comfortably exceed the byte cap')

    const page = await fetchPage('https://example.com/huge', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks, state })),
    })
    assert.equal(page.status, 'ok')
    assert.ok(state.cancelled, 'the reader should be cancelled once the byte cap is reached')
    // Slack of two chunks: one is the chunk that crosses the cap, the other is
    // the chunk a default-strategy ReadableStream has already queued behind it.
    assert.ok(
      state.pulled <= FETCH_MAX_BYTES + encoder.encode(chunk).byteLength * 2,
      `pulled ${state.pulled} bytes, expected to stop near ${FETCH_MAX_BYTES}`,
    )
    assert.equal(page.chars, PAGE_TEXT_CAP_CHARS)
  })

  it('reports a timeout when the fetch aborts', async () => {
    const page = await fetchPage('https://example.com/slow', {
      mock: false,
      fetchImpl: stubFetch(() => {
        throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
      }),
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'timeout')
  })

  it('reports the error message for any other throw', async () => {
    const page = await fetchPage('https://example.com/dns', {
      mock: false,
      fetchImpl: stubFetch(() => {
        throw new Error('getaddrinfo ENOTFOUND example.com')
      }),
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'getaddrinfo ENOTFOUND example.com')
  })

  it('fails when the page has no readable text', async () => {
    const page = await fetchPage('https://example.com/blank', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: ['<html><body></body></html>'] })),
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'no readable text')
    assert.equal(page.chars, 0)
  })
})

describe('fetchPage (protocol guard)', () => {
  const neverCalled = (() => {
    throw new Error('fetch should not have been called')
  }) as unknown as typeof fetch

  for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'data:text/html,<p>hi</p>']) {
    it(`skips ${new URL(url).protocol} before fetching`, async () => {
      const page = await fetchPage(url, { mock: false, fetchImpl: neverCalled })
      assert.equal(page.status, 'skipped')
      assert.equal(page.reason, 'unsupported protocol')
      assert.equal(page.text, '')
      assert.equal(page.chars, 0)
      assert.equal(page.finalUrl, null)
    })
  }

  it('skips a url that does not parse at all', async () => {
    const page = await fetchPage('not a url', { mock: false, fetchImpl: neverCalled })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'unsupported protocol')
  })

  it('still fetches plain http', async () => {
    const page = await fetchPage('http://example.com/guide', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: [articleHtml(padding)] })),
    })
    assert.equal(page.status, 'ok')
  })

  it('skips a response that redirected to an unsupported protocol', async () => {
    const page = await fetchPage('https://example.com/start', {
      mock: false,
      fetchImpl: stubFetch(
        responseOf({ url: 'file:///etc/passwd', chunks: [articleHtml(padding)] }),
      ),
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'redirected to unsupported protocol')
    assert.equal(page.finalUrl, 'file:///etc/passwd')
    assert.equal(page.text, '')
  })

  it('accepts a redirect that stays on http(s)', async () => {
    const page = await fetchPage('http://example.com/start', {
      mock: false,
      fetchImpl: stubFetch(
        responseOf({ url: 'https://example.com/final', chunks: [articleHtml(padding)] }),
      ),
    })
    assert.equal(page.status, 'ok')
    assert.equal(page.finalUrl, 'https://example.com/final')
  })

  it('does not apply the guard in mock mode', async () => {
    const page = await fetchPage('https://competitor-one.com/blog/x', { mock: true })
    assert.equal(page.status, 'ok')
  })
})

describe('USER_AGENT', () => {
  it('identifies the crawler and never dangles an empty url', () => {
    assert.ok(USER_AGENT.startsWith('DatumBot/1.0'))
    assert.ok(!USER_AGENT.includes('(+https://)'), 'an unset TARGET_DOMAIN must not leak through')
  })
})
