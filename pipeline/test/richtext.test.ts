import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractHeadings,
  lexicalToMarkdown,
  lexicalToPlainText,
  markdownToLexical,
  type RichText,
} from '../src/richtext'

type Node = Record<string, unknown> & { children?: Node[] }
const blocks = (md: string) => markdownToLexical(md).root.children as Node[]
const texts = (node: Node) => (node.children ?? []).map((c) => [c.text, c.format])

test('headings h1..h6 become heading nodes; seven hashes stay a paragraph', () => {
  const nodes = blocks('# a\n## b\n### c\n#### d\n##### e\n###### f\n####### g')
  assert.deepEqual(
    nodes.map((n) => [n.type, n.tag]),
    [
      ['heading', 'h1'],
      ['heading', 'h2'],
      ['heading', 'h3'],
      ['heading', 'h4'],
      ['heading', 'h5'],
      ['heading', 'h6'],
      ['paragraph', undefined],
    ],
  )
})

test('consecutive bullets form one list in the node shape Payload stores', () => {
  const [list, ...rest] = blocks('- one\n* two\n+ three')
  assert.equal(rest.length, 0)
  assert.equal(list.type, 'list')
  assert.equal(list.listType, 'bullet')
  assert.equal(list.tag, 'ul')
  assert.equal(list.start, 1)
  assert.deepEqual(
    list.children?.map((i) => [i.type, i.value, (i.children?.[0] as Node).text]),
    [
      ['listitem', 1, 'one'],
      ['listitem', 2, 'two'],
      ['listitem', 3, 'three'],
    ],
  )
})

test('numbered lists keep their start; a blank line does not split a list; a kind change does', () => {
  const nodes = blocks('3. c\n\n4. d\n- x')
  assert.equal(nodes.length, 2)
  assert.equal(nodes[0].listType, 'number')
  assert.equal(nodes[0].tag, 'ol')
  assert.equal(nodes[0].start, 3)
  assert.deepEqual(nodes[0].children?.map((i) => i.value), [3, 4])
  assert.equal(nodes[1].listType, 'bullet')
})

test('a paragraph between lists ends the first list', () => {
  assert.deepEqual(
    blocks('- a\ntext\n- b').map((n) => n.type),
    ['list', 'paragraph', 'list'],
  )
})

test('lines that only look like list or heading markers stay paragraphs', () => {
  for (const line of ['-', '- ', '*italic* start', '**Bold** start', '1990. A good year', '#nospace', '---']) {
    const [node] = blocks(line)
    assert.equal(node.type, 'paragraph', line)
  }
})

test('consecutive quote lines form one quote with a line break', () => {
  const [quote, ...rest] = blocks('> first\n> second\nafter')
  assert.equal(rest.length, 1)
  assert.equal(quote.type, 'quote')
  assert.deepEqual(
    quote.children?.map((c) => c.type),
    ['text', 'linebreak', 'text'],
  )
})

test('inline bold, italic, code and nested marks use the format bit field', () => {
  const [p] = blocks('a **b** *c* _d_ `e` ***f*** **g *h* i**')
  assert.deepEqual(texts(p), [
    ['a ', 0],
    ['b', 1],
    [' ', 0],
    ['c', 2],
    [' ', 0],
    ['d', 2],
    [' ', 0],
    ['e', 16],
    [' ', 0],
    ['f', 3],
    [' ', 0],
    ['g ', 1],
    ['h', 3],
    [' i', 1],
  ])
})

test('unmatched or intraword markers stay literal', () => {
  const [p] = blocks('2 * 3 * 4, snake_case_name, **open, a_b_ and [E3] ref')
  assert.deepEqual(
    (p.children ?? []).map((c) => c.format),
    [0],
  )
  assert.equal((p.children?.[0] as Node).text, '2 * 3 * 4, snake_case_name, **open, a_b_ and [E3] ref')
})

test('links keep http, https and site-relative URLs in a custom link node', () => {
  const [p] = blocks('See [the guide](https://example.com/a?b=1) and [home](/articles/x) now')
  const link = (p.children ?? []).filter((c) => c.type === 'link')
  assert.equal(link.length, 2)
  assert.equal(link[0].version, 3)
  assert.deepEqual(link[0].fields, { linkType: 'custom', newTab: false, url: 'https://example.com/a?b=1' })
  assert.deepEqual((link[1].fields as Node).url, '/articles/x')
  assert.equal((link[0].children?.[0] as Node).text, 'the guide')
})

test('links with any other URL stay literal text', () => {
  for (const url of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,hi',
    'mailto:a@b.co',
    '//evil.example/x',
    '/\\evil.example',
    'ftp://example.com',
    'example.com',
    'https://',
  ]) {
    const [p] = blocks(`go [here](${url}) now`)
    assert.ok(!(p.children ?? []).some((c) => c.type === 'link'), url)
    assert.equal((p.children?.[0] as Node).text, `go [here](${url}) now`, url)
  }
})

test('bold and code inside link text and headings are kept', () => {
  const [h, p] = blocks('## A **bold** heading\n[**x** and `y`](/z)')
  assert.deepEqual(texts(h), [['A ', 0], ['bold', 1], [' heading', 0]])
  const link = p.children?.[0] as Node
  assert.deepEqual(texts(link), [['x', 1], [' and ', 0], ['y', 16]])
})

test('headings read back with plain text, ignoring inline marks', () => {
  const body = markdownToLexical('## A **bold** [link](/x)\n#### Deep')
  assert.deepEqual(extractHeadings(body as RichText), [
    { level: 2, text: 'A bold link' },
    { level: 4, text: 'Deep' },
  ])
})

test('a skipped level from an h4 is now visible to the heading checks', () => {
  const body = markdownToLexical('## A\n#### B') as RichText
  assert.deepEqual(extractHeadings(body).map((h) => h.level), [2, 4])
})

test('lexicalToMarkdown writes lists, quotes, marks and links back', () => {
  const md = [
    '## Heading',
    'A **bold** and *it* with `code` and [a link](https://example.com/x).',
    '- one',
    '- two **b**',
    '> quoted',
    '1. first',
    '2. second',
  ].join('\n')
  const out = lexicalToMarkdown(markdownToLexical(md) as RichText)
  assert.equal(out, md.split('\n').join('\n\n').replace('- one\n\n- two', '- one\n- two').replace('1. first\n\n2.', '1. first\n2.'))
  // Round trip: reading the markdown again yields the same document.
  assert.deepEqual(markdownToLexical(out), markdownToLexical(md))
})

test('lexicalToPlainText puts each list item and line break on its own line, with no markers', () => {
  const body = markdownToLexical('Intro\n- alpha **beta**\n- gamma\n> q1\n> q2\n1. one\n2. two') as RichText
  assert.equal(lexicalToPlainText(body), 'Intro\nalpha beta\ngamma\nq1\nq2\none\ntwo')
})

test('editor-authored lists, nesting and line breaks do not run words together', () => {
  const t = (text: string, format = 0) => ({ type: 'text', version: 1, text, format })
  const item = (...children: unknown[]) => ({ type: 'listitem', version: 1, children })
  const body = {
    root: {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'list',
          version: 1,
          listType: 'number',
          start: 1,
          children: [
            item(t('alpha')),
            item({ type: 'list', version: 1, listType: 'bullet', children: [item(t('nested'))] }),
            item(t('beta')),
          ],
        },
        { type: 'paragraph', version: 1, children: [t('line one'), { type: 'linebreak', version: 1 }, t('line two')] },
      ],
    },
  } as unknown as RichText
  assert.equal(lexicalToPlainText(body), 'alpha\nnested\nbeta\nline one\nline two')
  assert.equal(lexicalToMarkdown(body), '1. alpha\n  - nested\n2. beta\n\nline one\nline two')
})

test('old bodies (one paragraph per line, raw text) read exactly as before', () => {
  const body = markdownToLexical('## Intro\nPlain text here.\nMore text.') as RichText
  assert.equal(lexicalToMarkdown(body), '## Intro\n\nPlain text here.\n\nMore text.')
  assert.equal(lexicalToPlainText(body), 'Intro\nPlain text here.\nMore text.')
})
