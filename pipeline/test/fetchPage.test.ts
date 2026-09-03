import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  extractReadableText,
  fetchPage,
  FETCH_MAX_BYTES,
  type LookupFn,
  MAX_REDIRECTS,
  PAGE_TEXT_CAP_CHARS,
  pinnedLookup,
  type ResolvedAddress,
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
  location?: string
  chunks?: string[]
  state?: StreamState
}): Response => {
  const status = opts.status ?? 200
  const headers = new Headers()
  if (opts.contentType !== null)
    headers.set('content-type', opts.contentType ?? 'text/html; charset=utf-8')
  if (opts.location) headers.set('location', opts.location)
  return {
    ok: status >= 200 && status < 300,
    status,
    url: opts.url ?? '',
    headers,
    body: bodyOf(opts.chunks ?? [], opts.state ?? { pulled: 0, cancelled: false }),
  } as unknown as Response
}

/** A 3xx pointing at `location`; `fetchPage` follows these itself. */
const redirectTo = (location: string, status = 302): Response =>
  responseOf({ status, location, contentType: null })

/** Every host resolves to one public address unless a test says otherwise. */
const publicLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }]

/** Resolves the hosts a test names to the given address, every other host publicly. */
const lookupWhere =
  (addresses: Record<string, string>): LookupFn =>
  async (hostname) => {
    const address = addresses[hostname] ?? '93.184.216.34'
    return [{ address, family: address.includes(':') ? 6 : 4 }]
  }

const stubFetch = (response: Response | (() => never)): typeof fetch =>
  (async () => (typeof response === 'function' ? response() : response)) as unknown as typeof fetch

/** Replays a scripted chain of responses, one per request, and records the urls. */
const scriptedFetch = (responses: Response[], seen: string[]): typeof fetch =>
  (async (url: string) => {
    seen.push(url)
    const next = responses[seen.length - 1]
    if (!next) throw new Error(`no scripted response for request ${seen.length}`)
    return next
  }) as unknown as typeof fetch

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
  it('reads a 200 html response and reports the url it read', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return responseOf({ chunks: [articleHtml(padding)] })
    }) as unknown as typeof fetch

    const page = await fetchPage('https://example.com/start', {
      mock: false,
      fetchImpl,
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'ok')
    assert.equal(page.url, 'https://example.com/start')
    assert.equal(page.finalUrl, 'https://example.com/start')
    assert.equal(page.title, 'Doc Title')
    assert.ok(page.chars > 0)
    assert.equal(page.chars, page.text.length)
    assert.equal(page.reason, null)
    assert.ok(!Number.isNaN(Date.parse(page.fetchedAt)))

    const request = seen as unknown as { url: string; init: RequestInit }
    assert.equal(request.url, 'https://example.com/start')
    // Redirects are followed by hand so every hop can be guarded first.
    assert.equal(request.init.redirect, 'manual')
    const headers = request.init.headers as Record<string, string>
    assert.equal(headers['User-Agent'], USER_AGENT)
    assert.equal(headers.Accept, 'text/html,application/xhtml+xml')
    assert.ok(request.init.signal, 'a timeout signal should be attached')
  })

  it('fails on a non-2xx response', async () => {
    const page = await fetchPage('https://example.com/missing', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ status: 404 })),
      lookupImpl: publicLookup,
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
      lookupImpl: publicLookup,
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
      lookupImpl: publicLookup,
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
      lookupImpl: publicLookup,
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
      lookupImpl: publicLookup,
      fetchImpl: stubFetch(() => {
        throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
      }),
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'timeout')
  })

  it('reports the error message for any other throw', async () => {
    const page = await fetchPage('https://example.com/boom', {
      mock: false,
      lookupImpl: publicLookup,
      fetchImpl: stubFetch(() => {
        throw new Error('socket hang up')
      }),
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'socket hang up')
  })

  it('fails a host that does not resolve', async () => {
    const page = await fetchPage('https://nowhere.example.com/x', {
      mock: false,
      fetchImpl: (() => {
        throw new Error('fetch should not have been called')
      }) as unknown as typeof fetch,
      lookupImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND nowhere.example.com')
      },
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'dns lookup failed: getaddrinfo ENOTFOUND nowhere.example.com')
  })

  it('fails when the page has no readable text', async () => {
    const page = await fetchPage('https://example.com/blank', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: ['<html><body></body></html>'] })),
      lookupImpl: publicLookup,
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
      const page = await fetchPage(url, {
        mock: false,
        fetchImpl: neverCalled,
        lookupImpl: publicLookup,
      })
      assert.equal(page.status, 'skipped')
      assert.equal(page.reason, 'unsupported protocol')
      assert.equal(page.text, '')
      assert.equal(page.chars, 0)
      assert.equal(page.finalUrl, null)
    })
  }

  it('skips a url that does not parse at all', async () => {
    const page = await fetchPage('not a url', {
      mock: false,
      fetchImpl: neverCalled,
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'unsupported protocol')
  })

  it('still fetches plain http', async () => {
    const page = await fetchPage('http://example.com/guide', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: [articleHtml(padding)] })),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'ok')
  })

  it('skips a redirect to an unsupported protocol without fetching it', async () => {
    const seen: string[] = []
    const page = await fetchPage('https://example.com/start', {
      mock: false,
      fetchImpl: scriptedFetch([redirectTo('file:///etc/passwd')], seen),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'redirected to unsupported protocol')
    assert.equal(page.finalUrl, 'file:///etc/passwd')
    assert.equal(page.text, '')
    assert.deepEqual(seen, ['https://example.com/start'], 'the file: hop must never be requested')
  })

  it('does not apply the guard in mock mode', async () => {
    const page = await fetchPage('https://competitor-one.com/blog/x', { mock: true })
    assert.equal(page.status, 'ok')
  })

  it('never resolves dns in mock mode', async () => {
    const page = await fetchPage('http://169.254.169.254/latest/meta-data/', {
      mock: true,
      lookupImpl: async () => {
        throw new Error('dns should not have been consulted in mock mode')
      },
    })
    assert.equal(page.status, 'ok')
  })
})

describe('fetchPage (address guard)', () => {
  const neverCalled = (() => {
    throw new Error('fetch should not have been called')
  }) as unknown as typeof fetch

  it('skips a direct link-local target before fetching it', async () => {
    const page = await fetchPage('http://169.254.169.254/latest/meta-data/', {
      mock: false,
      fetchImpl: neverCalled,
      lookupImpl: lookupWhere({ '169.254.169.254': '169.254.169.254' }),
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'private address')
    assert.equal(page.finalUrl, null)
    assert.equal(page.text, '')
  })

  it('skips a public hostname that resolves to a private address', async () => {
    const page = await fetchPage('https://sneaky.example.com/x', {
      mock: false,
      fetchImpl: neverCalled,
      lookupImpl: lookupWhere({ 'sneaky.example.com': '10.0.0.7' }),
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'private address')
  })

  it('skips a host whose address set mixes public and private answers', async () => {
    const page = await fetchPage('https://mixed.example.com/x', {
      mock: false,
      fetchImpl: neverCalled,
      lookupImpl: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '::1', family: 6 },
      ],
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'private address')
  })

  it('skips localhost by name without consulting dns', async () => {
    const page = await fetchPage('http://localhost:8080/admin', {
      mock: false,
      fetchImpl: neverCalled,
      lookupImpl: async () => {
        throw new Error('dns should not have been consulted for localhost')
      },
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'private address')
  })

  it('skips a public page that redirects to a private one, before the second request', async () => {
    const seen: string[] = []
    const page = await fetchPage('https://ranking.example.com/post', {
      mock: false,
      fetchImpl: scriptedFetch([redirectTo('http://169.254.169.254/latest/meta-data/')], seen),
      lookupImpl: lookupWhere({ '169.254.169.254': '169.254.169.254' }),
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'redirected to private address')
    assert.equal(page.finalUrl, 'http://169.254.169.254/latest/meta-data/')
    assert.deepEqual(
      seen,
      ['https://ranking.example.com/post'],
      'only the first, public hop should have been requested',
    )
  })

  it('follows a redirect chain within the cap and reads the final page', async () => {
    const seen: string[] = []
    const page = await fetchPage('https://example.com/1', {
      mock: false,
      fetchImpl: scriptedFetch(
        [
          redirectTo('https://example.com/2'),
          redirectTo('/3'),
          responseOf({ chunks: [articleHtml(padding)] }),
        ],
        seen,
      ),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'ok')
    assert.equal(page.finalUrl, 'https://example.com/3')
    assert.deepEqual(seen, [
      'https://example.com/1',
      'https://example.com/2',
      'https://example.com/3',
    ])
  })

  it('gives up on a redirect chain longer than MAX_REDIRECTS', async () => {
    const seen: string[] = []
    const responses = Array.from({ length: MAX_REDIRECTS + 2 }, (_, index) =>
      redirectTo(`https://example.com/hop-${index + 1}`),
    )
    const page = await fetchPage('https://example.com/hop-0', {
      mock: false,
      fetchImpl: scriptedFetch(responses, seen),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'too many redirects')
    assert.equal(seen.length, MAX_REDIRECTS + 1, 'one request per hop, then it stops')
    assert.equal(page.finalUrl, `https://example.com/hop-${MAX_REDIRECTS}`)
  })
})

describe('fetchPage (response bodies)', () => {
  /** Fetches `url` with the given response and reports whether its body was released. */
  const cancelledFor = async (
    url: string,
    make: (state: StreamState) => Response,
  ): Promise<{ page: Awaited<ReturnType<typeof fetchPage>>; state: StreamState }> => {
    const state: StreamState = { pulled: 0, cancelled: false }
    const page = await fetchPage(url, {
      mock: false,
      fetchImpl: stubFetch(make(state)),
      lookupImpl: publicLookup,
    })
    return { page, state }
  }

  it('cancels the body of an http-error response', async () => {
    const { page, state } = await cancelledFor('https://example.com/missing', (state) =>
      responseOf({ status: 500, chunks: ['<html><body>error page</body></html>'], state }),
    )
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'http 500')
    assert.ok(state.cancelled, 'an error response body must not be left holding the socket')
  })

  it('cancels the body of a non-html response', async () => {
    const { page, state } = await cancelledFor('https://example.com/paper.pdf', (state) =>
      responseOf({ contentType: 'application/pdf', chunks: ['%PDF-1.7 ...'], state }),
    )
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'content-type application/pdf')
    assert.ok(state.cancelled, 'a non-html body must not be left holding the socket')
  })

  it('cancels the body of a response with no content-type at all', async () => {
    const { page, state } = await cancelledFor('https://example.com/mystery', (state) =>
      responseOf({ contentType: null, chunks: ['something'], state }),
    )
    assert.equal(page.status, 'skipped')
    assert.equal(page.reason, 'content-type unknown')
    assert.ok(state.cancelled)
  })

  it('cancels a redirect body before following the hop', async () => {
    const state: StreamState = { pulled: 0, cancelled: false }
    const seen: string[] = []
    const page = await fetchPage('https://example.com/1', {
      mock: false,
      fetchImpl: scriptedFetch(
        [
          responseOf({
            status: 302,
            location: 'https://example.com/2',
            contentType: null,
            chunks: ['<html>moved</html>'],
            state,
          }),
          responseOf({ chunks: [articleHtml(padding)] }),
        ],
        seen,
      ),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'ok')
    assert.ok(state.cancelled, 'a redirect body carries no evidence and must be released')
  })

  it('cancels the body when the redirect cap is reached', async () => {
    const state: StreamState = { pulled: 0, cancelled: false }
    const seen: string[] = []
    const responses = Array.from({ length: MAX_REDIRECTS + 1 }, (_, index) =>
      index === MAX_REDIRECTS
        ? responseOf({
            status: 302,
            location: `https://example.com/hop-${index + 1}`,
            contentType: null,
            chunks: ['<html>moved</html>'],
            state,
          })
        : redirectTo(`https://example.com/hop-${index + 1}`),
    )
    const page = await fetchPage('https://example.com/hop-0', {
      mock: false,
      fetchImpl: scriptedFetch(responses, seen),
      lookupImpl: publicLookup,
    })
    assert.equal(page.reason, 'too many redirects')
    assert.ok(state.cancelled, 'the last hop we refuse to follow still owes its body')
  })

  it('survives a response that has no body at all', async () => {
    const page = await fetchPage('https://example.com/empty', {
      mock: false,
      fetchImpl: stubFetch({
        ok: false,
        status: 204,
        url: '',
        headers: new Headers(),
        body: null,
      } as unknown as Response),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'http 204')
  })

  it('survives a body whose cancel() rejects', async () => {
    const page = await fetchPage('https://example.com/stubborn', {
      mock: false,
      fetchImpl: stubFetch({
        ok: false,
        status: 503,
        url: '',
        headers: new Headers(),
        body: { cancel: async () => Promise.reject(new Error('already locked')) },
      } as unknown as Response),
      lookupImpl: publicLookup,
    })
    assert.equal(page.status, 'failed')
    assert.equal(page.reason, 'http 503', 'a failed cancel must not become the reported reason')
  })
})

describe('pinnedLookup', () => {
  /** Calls the lookup and returns whatever it passed to its callback. */
  const resolve = (
    host: string,
    addresses: ResolvedAddress[],
    asked: string,
    all: boolean,
  ): { error: Error | null; address: string | ResolvedAddress[]; family?: number } => {
    let seen: { error: Error | null; address: string | ResolvedAddress[]; family?: number } | null =
      null
    pinnedLookup(host, addresses)(asked, { all }, (error, address, family) => {
      seen = { error, address, family }
    })
    assert.ok(seen, 'the lookup must answer synchronously')
    return seen as unknown as {
      error: Error | null
      address: string | ResolvedAddress[]
      family?: number
    }
  }

  const publicV4: ResolvedAddress[] = [{ address: '93.184.216.34', family: 4 }]

  it('hands back the validated address when asked for all', () => {
    const { error, address } = resolve('example.com', publicV4, 'example.com', true)
    assert.equal(error, null)
    assert.deepEqual(address, [{ address: '93.184.216.34', family: 4 }])
  })

  it('hands back a single validated address and family when all is not set', () => {
    const { error, address, family } = resolve('example.com', publicV4, 'example.com', false)
    assert.equal(error, null)
    assert.equal(address, '93.184.216.34')
    assert.equal(family, 4)
  })

  it('keeps every validated address, in order, so happy-eyeballs still works', () => {
    const both: ResolvedAddress[] = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]
    const { address } = resolve('example.com', both, 'example.com', true)
    assert.deepEqual(address, both)
  })

  it('refuses a blocked address even if the caller passed one in', () => {
    for (const blocked of ['169.254.169.254', '10.0.0.7', '127.0.0.1', '::1', 'nonsense']) {
      const { error } = resolve(
        'sneaky.example.com',
        [{ address: blocked, family: blocked.includes(':') ? 6 : 4 }],
        'sneaky.example.com',
        true,
      )
      assert.ok(error, `${blocked} should not survive pinning`)
      assert.match(error.message, /no allowed address/)
    }
  })

  it('drops a blocked address from a mixed set rather than serving it', () => {
    const mixed: ResolvedAddress[] = [
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]
    const { error, address } = resolve('example.com', mixed, 'example.com', true)
    assert.equal(error, null)
    assert.deepEqual(address, [{ address: '93.184.216.34', family: 4 }])
  })

  it('refuses any hostname other than the one that was validated', () => {
    const { error } = resolve('example.com', publicV4, 'metadata.google.internal', true)
    assert.ok(error)
    assert.match(error.message, /is not the validated host example\.com/)
  })

  it('matches the validated host case- and trailing-dot-insensitively', () => {
    assert.equal(resolve('example.com', publicV4, 'EXAMPLE.COM.', true).error, null)
  })

  it('never falls back to real dns: an empty address set is an error', () => {
    const { error } = resolve('example.com', [], 'example.com', true)
    assert.ok(error)
    assert.match(error.message, /no allowed address/)
  })
})

describe('USER_AGENT', () => {
  it('identifies the crawler and never dangles an empty url', () => {
    assert.ok(USER_AGENT.startsWith('DatumBot/1.0'))
    assert.ok(!USER_AGENT.includes('(+https://)'), 'an unset TARGET_DOMAIN must not leak through')
  })

  it('sends the caller\'s identity when the run knows its workspace', async () => {
    let seen: unknown = null
    const stub: typeof fetch = async (url, init) => {
      seen = { url: String(url), init }
      return responseOf({ chunks: ['<html><body><article><p>Text here.</p></article></body></html>'] })
    }

    await fetchPage('https://example.com/page', {
      mock: false,
      fetchImpl: stub,
      lookupImpl: publicLookup,
      userAgent: 'DatumBot/1.0 (+https://acme.example)',
    })

    const headers = (seen as { init: RequestInit }).init.headers as Record<string, string>
    assert.equal(headers['User-Agent'], 'DatumBot/1.0 (+https://acme.example)')
  })

  it('falls back to the module default when none is passed', async () => {
    let seen: unknown = null
    const stub: typeof fetch = async (url, init) => {
      seen = { url: String(url), init }
      return responseOf({ chunks: ['<html><body><article><p>Text here.</p></article></body></html>'] })
    }

    // A blank one is not an identity either, so it falls back too.
    await fetchPage('https://example.com/page', {
      mock: false,
      fetchImpl: stub,
      lookupImpl: publicLookup,
      userAgent: '   ',
    })

    const headers = (seen as { init: RequestInit }).init.headers as Record<string, string>
    assert.equal(headers['User-Agent'], USER_AGENT)
  })
})

describe('fetchPage onHtml', () => {
  const page = articleHtml(`${padding}The grinder matters more than the machine.`)

  it('hands the raw markup over, links and all, before Readability strips them', async () => {
    let seen: string | null = null
    const result = await fetchPage('https://example.com/page', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: [page] })),
      lookupImpl: publicLookup,
      onHtml: (html) => {
        seen = html
      },
    })

    assert.equal(result.status, 'ok')
    assert.equal(seen, page)
    // The point of the callback: the anchors are gone from the text.
    assert.ok(!result.text.includes('Nav Link One'))
  })

  it('offers the markup even when there is no readable text to extract', async () => {
    let seen: string | null = null
    const result = await fetchPage('https://example.com/empty', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: ['<html><body><a href="/about"></a></body></html>'] })),
      lookupImpl: publicLookup,
      onHtml: (html) => {
        seen = html
      },
    })

    assert.equal(result.status, 'failed')
    assert.equal(result.reason, 'no readable text')
    assert.ok(seen !== null && (seen as string).includes('href="/about"'))
  })

  it('is not called in mock mode, where there is no markup', async () => {
    let calls = 0
    const result = await fetchPage('https://competitor-one.com/x', {
      mock: true,
      onHtml: () => {
        calls += 1
      },
    })

    assert.equal(result.status, 'ok')
    assert.equal(calls, 0)
  })

  it('does not let a throwing callback sink the fetch', async () => {
    const result = await fetchPage('https://example.com/page', {
      mock: false,
      fetchImpl: stubFetch(responseOf({ chunks: [page] })),
      lookupImpl: publicLookup,
      onHtml: () => {
        throw new Error('caller exploded')
      },
    })

    assert.equal(result.status, 'ok')
    assert.ok(result.text.includes('The grinder matters more than the machine.'))
  })
})
