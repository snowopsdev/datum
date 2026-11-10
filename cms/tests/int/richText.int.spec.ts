import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { lexicalBodyToHtml, lexicalToPlainText, plainTextToLexical } from '@/lib/lexicalHtml'
import { lexicalToHtml, lexicalToMarkdown, markdownToLexical, safeLinkUrl } from '@/lib/richText'

const html = (md: string) => lexicalToHtml(markdownToLexical(md))

describe('lexicalToHtml', () => {
  it('renders every construct the writer can produce', () => {
    const out = html(
      [
        '## Section',
        '#### Deep',
        'Plain **bold** *it* `code` [guide](https://example.com/a?x=1&y=2).',
        '- one',
        '- two',
        '3. three',
        '4. four',
        '> quoted',
      ].join('\n'),
    )
    expect(out).toBe(
      [
        '<h2>Section</h2>',
        '<h4>Deep</h4>',
        '<p>Plain <strong>bold</strong> <em>it</em> <code>code</code> <a href="https://example.com/a?x=1&amp;y=2">guide</a>.</p>',
        '<ul><li>one</li><li>two</li></ul>',
        '<ol start="3"><li>three</li><li>four</li></ol>',
        '<blockquote>quoted</blockquote>',
      ].join('\n'),
    )
  })

  it('renders editor-authored formats, line breaks and nested lists', () => {
    const t = (text: string, format = 0) => ({ type: 'text', version: 1, text, format })
    const body = {
      root: {
        type: 'root',
        version: 1,
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [t('a', 8), t('b', 4), t('c', 1 | 2), { type: 'linebreak', version: 1 }, t('d')],
          },
          {
            type: 'list',
            version: 1,
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                version: 1,
                children: [
                  t('outer'),
                  {
                    type: 'list',
                    version: 1,
                    listType: 'number',
                    children: [{ type: 'listitem', version: 1, children: [t('inner')] }],
                  },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            version: 1,
            children: [
              {
                type: 'link',
                version: 3,
                fields: { linkType: 'custom', newTab: true, url: 'https://example.com' },
                children: [t('out')],
              },
            ],
          },
        ],
      },
    }
    expect(lexicalToHtml(body)).toBe(
      [
        '<p><u>a</u><s>b</s><strong><em>c</em></strong><br>d</p>',
        '<ul><li>outer<ol><li>inner</li></ol></li></ul>',
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">out</a></p>',
      ].join('\n'),
    )
  })

  it('keeps old paragraph-only bodies and the lexicalBodyToHtml signature as before', () => {
    expect(lexicalBodyToHtml(plainTextToLexical('## Intro\nSome <text> & "more".'))).toBe(
      '<h2>Intro</h2>\n<p>Some &lt;text&gt; &amp; &quot;more&quot;.</p>',
    )
    expect(lexicalBodyToHtml(null)).toBe('')
    expect(lexicalBodyToHtml({ root: { children: [] } } as never)).toBe('')
  })

  it('escapes hostile text everywhere', () => {
    const out = html(
      '## <script>alert(1)</script>\n<img src=x onerror=alert(1)> **<b>x</b>**\n- <script>y</script>\n> "q" & <i>',
    )
    expect(out).not.toMatch(/<script|<img|<b>|<i>/)
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(out).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>')
    expect(out).toContain('<blockquote>&quot;q&quot; &amp; &lt;i&gt;</blockquote>')
  })

  it('never emits a link for an unsafe URL, however it got into the body', () => {
    const hostile = [
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html;base64,AAAA',
      'vbscript:x',
      '//evil.example',
      '/\\evil.example',
      "https://ok.example/ onclick=alert(1)",
    ]
    for (const url of hostile) {
      const body = {
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'link',
                  version: 3,
                  fields: { linkType: 'custom', newTab: false, url },
                  children: [{ type: 'text', version: 1, text: 'label', format: 0 }],
                },
              ],
            },
          ],
        },
      }
      expect(lexicalToHtml(body), url).toBe('<p>label</p>')
      expect(safeLinkUrl(url), url).toBeNull()
    }
  })

  it('escapes a double quote that parses as part of a safe URL', () => {
    const out = html('[x](https://ok.example/"onmouseover="alert)')
    expect(out).toBe('<p><a href="https://ok.example/&quot;onmouseover=&quot;alert">x</a></p>')
    expect(html('[x](https://ok.example/a"b)')).toBe(
      '<p><a href="https://ok.example/a&quot;b">x</a></p>',
    )
  })

  it('renders an internal (document) link as its text', () => {
    const body = {
      root: {
        type: 'root',
        version: 1,
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [
              {
                type: 'link',
                version: 3,
                fields: { linkType: 'internal', url: '/should-not-be-used', doc: { value: 1 } },
                children: [{ type: 'text', version: 1, text: 'doc', format: 0 }],
              },
            ],
          },
        ],
      },
    }
    expect(lexicalToHtml(body)).toBe('<p>doc</p>')
  })
})

describe('template textarea round trip', () => {
  it('keeps lists, marks and links when a template outline is read and saved again', () => {
    const text = '## Intro\n- one\n- **two**\n1. a\n2. [b](/x)\nAfter.'
    const body = plainTextToLexical(text)
    expect(lexicalToPlainText(body)).toBe(text)
    expect(plainTextToLexical(lexicalToPlainText(body))).toEqual(body)
    expect(lexicalToMarkdown(body, '\n')).toBe(text)
  })
})

describe('payload round trip', () => {
  it('saves a converted body through payload.update and reads it back unchanged', async () => {
    const payload = await getPayload({ config: await config })
    const body = markdownToLexical(
      [
        '## Section',
        '#### Deep',
        'Text with **bold**, *italic*, `code` and a [link](https://example.com/page).',
        '- first',
        '- second **b**',
        '1. one',
        '2. two',
        '> a quote',
        '> second line',
      ].join('\n'),
    )
    const article = await payload.create({
      collection: 'articles',
      data: { keyword: `rich text ${randomUUID()}`, title: 'Rich text' },
    })
    // Articles are not deleted: their audit rows are append-only.
    {
      await payload.update({
        collection: 'articles',
        id: article.id,
        data: { body: body as never },
      })
      const read = await payload.findByID({ collection: 'articles', id: article.id })
      const stored = read.body as typeof body
      expect(lexicalToHtml(stored)).toBe(lexicalToHtml(body))
      expect(lexicalToMarkdown(stored)).toBe(lexicalToMarkdown(body))
      const types = stored.root.children.map((c) => c.type)
      expect(types).toEqual(['heading', 'heading', 'paragraph', 'list', 'list', 'quote'])
      const list = stored.root.children[3] as Record<string, unknown>
      expect(list).toMatchObject({ listType: 'bullet', tag: 'ul', start: 1 })
      expect(lexicalToHtml(stored)).toContain('<a href="https://example.com/page">link</a>')
    }
  })
})
