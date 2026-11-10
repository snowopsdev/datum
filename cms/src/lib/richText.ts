/**
 * The one Markdown <-> Lexical converter, shared by both workspaces.
 *
 * Dependency-free on purpose: the pipeline imports this file directly, and the
 * CMS public page, admin review view and template editor use it too. Keep
 * imports out of it.
 *
 * Writing direction (`markdownToLexical`) handles the subset the writer prompt
 * names: `#`..`######` headings, `-`/`*` bullets, `1.` numbered lists, `> `
 * quotes, and inline `**bold**`, `*italic*` / `_italic_`, `` `code` `` and
 * `[text](url)` links. Anything else stays literal text. Lists are flat: an
 * indented bullet becomes an item of the same list. Backslash escapes are not
 * understood.
 *
 * Reading direction (`lexicalToHtml`, `lexicalToText`, `lexicalToMarkdown`)
 * also handles what the admin editor can store that the writer cannot: nested
 * lists, underline, strikethrough, line breaks.
 *
 * Node shapes match what Payload's Lexical editor stores. Text `format` is a
 * bit field: 1 bold, 2 italic, 4 strikethrough, 8 underline, 16 code.
 */

export interface LexicalNode {
  type: string
  version: number
  [key: string]: unknown
}

export interface LexicalDoc {
  root: {
    type: 'root'
    children: LexicalNode[]
    direction: 'ltr'
    format: ''
    indent: 0
    version: 1
  }
  [key: string]: unknown
}

export interface HeadingInfo {
  level: number
  text: string
}

export const FORMAT_BOLD = 1
export const FORMAT_ITALIC = 2
export const FORMAT_STRIKETHROUGH = 4
export const FORMAT_UNDERLINE = 8
export const FORMAT_CODE = 16

// ---------------------------------------------------------------- URLs

/**
 * The URL when it is safe to put in an `href`, else `null`: `http:`, `https:`
 * or a site-relative path starting with a single `/`. Whitespace, control
 * characters and backslashes are refused, so `javascript:` tricks, `//host`
 * (protocol-relative) and `/\host` all fail.
 */
export function safeLinkUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (!url || /[\u0000- \u007f-\u009f\\]/.test(url)) return null
  if (url.startsWith('/')) return url.startsWith('//') ? null : url
  if (!/^https?:\/\/[^/?#]/i.test(url)) return null
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

// ------------------------------------------------- Markdown -> Lexical

const textNode = (text: string, format: number): LexicalNode => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const linkNode = (url: string, children: LexicalNode[]): LexicalNode => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'link',
  version: 3,
  fields: { linkType: 'custom', newTab: false, url },
})

const linebreakNode = (): LexicalNode => ({ type: 'linebreak', version: 1 })

const LINK_AT_START = /^\[([^[\]]+)\]\(([^()\s]+)\)/
const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch)
const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch)

/**
 * Index of the closing run of `n` `marker` characters at or after `from`, or -1.
 *
 * `misses` remembers, per marker and run length, the lowest `from` that found
 * nothing. Whether a position is a valid closer does not depend on `from`, so
 * a later search that starts at or after it cannot succeed either. Without it,
 * a line of n unclosed openers rescans the rest of the line n times.
 */
function findCloser(
  src: string,
  marker: string,
  n: number,
  from: number,
  misses: Map<string, number>,
): number {
  const key = marker + n
  const missedFrom = misses.get(key)
  if (missedFrom !== undefined && from >= missedFrom) return -1
  const needle = marker.repeat(n)
  for (let j = src.indexOf(needle, from); j !== -1; j = src.indexOf(needle, j + 1)) {
    if (isSpace(src[j - 1])) continue
    // A run longer than n is a different delimiter (`*` vs `**`); skip it.
    if (src[j - 1] === marker || src[j + n] === marker) continue
    if (marker === '_' && isWordChar(src[j + n])) continue
    return j
  }
  misses.set(key, Math.min(from, missedFrom ?? from))
  return -1
}

function parseInline(src: string, format = 0, inLink = false): LexicalNode[] {
  const out: LexicalNode[] = []
  const misses = new Map<string, number>()
  let buf = ''
  const flush = () => {
    if (buf) out.push(textNode(buf, format))
    buf = ''
  }
  let i = 0
  while (i < src.length) {
    const ch = src[i]

    if (ch === '`') {
      const end = src.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push(textNode(src.slice(i + 1, end), format | FORMAT_CODE))
        i = end + 1
        continue
      }
    }

    if (ch === '[' && !inLink) {
      const match = LINK_AT_START.exec(src.slice(i))
      if (match) {
        const url = safeLinkUrl(match[2])
        if (url) {
          flush()
          out.push(linkNode(url, parseInline(match[1], format, true)))
        } else {
          buf += match[0] // unsafe scheme: keep the markdown as literal text
        }
        i += match[0].length
        continue
      }
    }

    if (ch === '*' || ch === '_') {
      let run = 1
      while (src[i + run] === ch) run++
      const n = Math.min(run, 3)
      const opens = !isSpace(src[i + n]) && (ch === '*' || !isWordChar(src[i - 1]))
      const close = opens ? findCloser(src, ch, n, i + n, misses) : -1
      if (close > i + n) {
        flush()
        const bits = n === 1 ? FORMAT_ITALIC : n === 2 ? FORMAT_BOLD : FORMAT_BOLD | FORMAT_ITALIC
        out.push(...parseInline(src.slice(i + n, close), format | bits, inLink))
        i = close + n
      } else {
        buf += ch.repeat(run) // no closer: literal, and do not retry inside the run
        i += run
      }
      continue
    }

    buf += ch
    i++
  }
  flush()
  return out
}

const block = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}) =>
  ({
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    ...extra,
    type,
    version: 1,
  }) as LexicalNode

const HEADING = /^(#{1,6})\s+(.+)$/
const BULLET = /^[-*+]\s+(.+)$/
// Up to three digits, so a line that opens with a year ("1990. The ...") stays a paragraph.
const NUMBERED = /^(\d{1,3})[.)]\s+(.+)$/
const QUOTE = /^>\s*(.+)$/

/**
 * Markdown (the subset described at the top of this file) -> Lexical.
 * Each non-blank line is its own block, except that consecutive list lines of
 * one kind form one list and consecutive `> ` lines form one quote.
 */
export function markdownToLexical(markdown: string): LexicalDoc {
  const children: LexicalNode[] = []
  let list: { listType: 'bullet' | 'number'; start: number; items: LexicalNode[] } | null = null
  let quote: LexicalNode[] | null = null

  const closeList = () => {
    if (!list) return
    children.push(
      block('list', list.items, {
        listType: list.listType,
        start: list.start,
        tag: list.listType === 'number' ? 'ol' : 'ul',
      }),
    )
    list = null
  }
  const closeQuote = () => {
    if (quote) children.push(block('quote', quote))
    quote = null
  }
  const addItem = (listType: 'bullet' | 'number', start: number, text: string) => {
    if (list && list.listType !== listType) closeList()
    if (!list) list = { listType, start, items: [] }
    list.items.push(block('listitem', parseInline(text), { value: list.start + list.items.length }))
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue // a blank line does not end a list: "- a", "", "- b" is one list

    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const quoted = bullet || numbered ? null : QUOTE.exec(line)

    if (!bullet && !numbered) closeList()
    if (!quoted) closeQuote()

    if (bullet) {
      addItem('bullet', 1, bullet[1])
    } else if (numbered) {
      addItem('number', Math.max(1, Number.parseInt(numbered[1], 10)), numbered[2])
    } else if (quoted) {
      const inline = parseInline(quoted[1])
      if (quote) quote.push(linebreakNode(), ...inline)
      else quote = inline
    } else {
      const heading = HEADING.exec(line)
      if (heading) {
        children.push(
          block('heading', parseInline(heading[2].trim()), { tag: `h${heading[1].length}` }),
        )
      } else {
        children.push(block('paragraph', parseInline(line), { textFormat: 0 }))
      }
    }
  }
  closeList()
  closeQuote()

  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

// ------------------------------------------------- Lexical readers

type Loose = Record<string, unknown>

const asNode = (value: unknown): Loose | null =>
  typeof value === 'object' && value !== null ? (value as Loose) : null

const childrenOf = (node: Loose): Loose[] =>
  Array.isArray(node.children)
    ? node.children.map(asNode).filter((n): n is Loose => n !== null)
    : []

/** The root's block nodes; `[]` for a missing or malformed body. */
export function rootChildren(body: unknown): Loose[] {
  const root = asNode(asNode(body)?.root)
  return root ? childrenOf(root) : []
}

const formatOf = (node: Loose): number => (typeof node.format === 'number' ? node.format : 0)

/** The URL of a `link` / `autolink` node when it has a safe one. */
function linkUrlOf(node: Loose): string | null {
  const fields = asNode(node.fields)
  if (fields?.linkType === 'internal') return null
  return safeLinkUrl(fields?.url ?? node.url)
}

/** All text under a node. A `linebreak` is a newline; no markers. */
export function inlineText(node: unknown): string {
  const n = asNode(node)
  if (!n) return ''
  if (n.type === 'linebreak') return '\n'
  if (n.type === 'tab') return '\t'
  if (typeof n.text === 'string') return n.text
  return childrenOf(n).map(inlineText).join('')
}

function inlineMarkdown(node: Loose, italic = '*'): string {
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'tab') return '\t'
  if (typeof node.text === 'string') {
    const format = formatOf(node)
    const [, lead = '', core = '', trail = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.text) ?? []
    if (!core) return node.text
    let marked = core
    if (format & FORMAT_CODE) marked = `\`${marked}\``
    if (format & FORMAT_BOLD) marked = `**${marked}**`
    if (format & FORMAT_ITALIC) marked = `${italic}${marked}${italic}`
    return lead + marked + trail
  }
  const inner = inlineRunMarkdown(childrenOf(node))
  if (node.type === 'link' || node.type === 'autolink') {
    const url = linkUrlOf(node)
    return url && inner.trim() ? `[${inner}](${url})` : inner
  }
  return inner
}

/**
 * Markdown for a run of sibling inline nodes. Neighbours with the same marks are
 * joined first. Where two `*` delimiters would still touch (`**Bold***italic*`
 * reads back as literal asterisks), the italic side is written with `_`.
 */
function inlineRunMarkdown(nodes: Loose[]): string {
  const merged: Loose[] = []
  for (const node of nodes) {
    const prev = merged[merged.length - 1]
    const sameMarks =
      prev !== undefined &&
      typeof prev.text === 'string' &&
      typeof node.text === 'string' &&
      prev.type === node.type &&
      formatOf(prev) === formatOf(node)
    if (sameMarks) merged[merged.length - 1] = { ...prev, text: `${prev.text}${node.text}` }
    else merged.push(node)
  }
  const pieces = merged.map((node) => inlineMarkdown(node))
  for (let k = 1; k < pieces.length; k++) {
    if (!pieces[k - 1].endsWith('*') || !pieces[k].startsWith('*')) continue
    for (const side of [k, k - 1]) {
      const alt = inlineMarkdown(merged[side], '_')
      // `_` only opens and closes away from letters and digits.
      if (alt === pieces[side]) continue
      if (isWordChar(pieces[side - 1]?.slice(-1)) || isWordChar(pieces[side + 1]?.[0])) continue
      pieces[side] = alt
      break
    }
  }
  return pieces.join('')
}

const levelOf = (tag: unknown, fallback: number): number => {
  const level = typeof tag === 'string' ? Number.parseInt(tag.replace(/^h/, ''), 10) : Number.NaN
  return level >= 1 && level <= 6 ? level : fallback
}

/** Headings in document order, with the level taken from the tag. */
export function extractHeadings(body: unknown): HeadingInfo[] {
  const headings: HeadingInfo[] = []
  for (const child of rootChildren(body)) {
    if (child.type !== 'heading' || typeof child.tag !== 'string') continue
    const level = Number.parseInt(child.tag.replace(/^h/, ''), 10)
    if (!Number.isNaN(level)) headings.push({ level, text: inlineText(child).trim() })
  }
  return headings
}

/** One line per list item, nested items flattened (markdown: indented, prefixed). */
function listLines(list: Loose, depth: number, markdown: boolean): string[] {
  const ordered = list.listType === 'number'
  const start = typeof list.start === 'number' && list.start >= 1 ? list.start : 1
  const lines: string[] = []
  let index = 0
  for (const item of childrenOf(list)) {
    if (item.type === 'list') {
      lines.push(...listLines(item, depth + 1, markdown))
      continue
    }
    const kids = childrenOf(item)
    const inline = kids.filter((kid) => kid.type !== 'list')
    const text = (markdown ? inlineRunMarkdown(inline) : inline.map(inlineText).join(''))
      .replace(/\s*\n\s*/g, ' ')
      .trim()
    if (text) {
      const marker = ordered ? `${start + index}. ` : '- '
      lines.push(markdown ? `${'  '.repeat(depth)}${marker}${text}` : text)
      index++
    }
    for (const nested of kids) {
      if (nested.type === 'list') lines.push(...listLines(nested, depth + 1, markdown))
    }
  }
  return lines
}

function blockLines(node: Loose, markdown: boolean): string[] {
  if (node.type === 'list') return listLines(node, 0, markdown)
  const text = (markdown ? inlineRunMarkdown(childrenOf(node)) : inlineText(node)).trim()
  if (!text) return []
  if (node.type === 'heading' && markdown) {
    return [`${'#'.repeat(levelOf(node.tag, 2))} ${text.replace(/\s*\n\s*/g, ' ')}`]
  }
  if (node.type === 'quote' && markdown) return text.split('\n').map((line) => `> ${line}`)
  return [text]
}

/**
 * Plain text for QA, reading grade, banned-phrase scans and similarity: no
 * markers, one line per block, one line per list item, a newline for a line
 * break. Blocks are joined with a single newline.
 */
export function lexicalToText(body: unknown): string {
  return rootChildren(body)
    .flatMap((child) => blockLines(child, false))
    .join('\n')
}

/**
 * Markdown for prompts and config textareas: `#` headings, `- ` / `1. `
 * list items, `> ` quotes, `**bold**`, `*italic*`, `` `code` `` and
 * `[text](url)`. Blocks are joined with `separator` (a blank line by default).
 */
export function lexicalToMarkdown(body: unknown, separator = '\n\n'): string {
  const blocks = rootChildren(body).map((child) => blockLines(child, true).join('\n'))
  return blocks.filter((text) => text.length > 0).join(separator)
}

// ------------------------------------------------- Lexical -> HTML

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textHtml(node: Loose): string {
  const format = formatOf(node)
  let html = escapeHtml(String(node.text))
  if (format & FORMAT_CODE) html = `<code>${html}</code>`
  if (format & FORMAT_STRIKETHROUGH) html = `<s>${html}</s>`
  if (format & FORMAT_UNDERLINE) html = `<u>${html}</u>`
  if (format & FORMAT_ITALIC) html = `<em>${html}</em>`
  if (format & FORMAT_BOLD) html = `<strong>${html}</strong>`
  return html
}

function inlineHtml(node: Loose): string {
  if (node.type === 'linebreak') return '<br>'
  if (node.type === 'tab') return '\t'
  if (typeof node.text === 'string') return textHtml(node)
  const inner = childrenOf(node).map(inlineHtml).join('')
  if (node.type === 'link' || node.type === 'autolink') {
    const url = linkUrlOf(node)
    if (!url) return inner
    const fields = asNode(node.fields)
    const target = fields?.newTab === true ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${escapeHtml(url)}"${target}>${inner}</a>`
  }
  return inner
}

function listHtml(list: Loose): string {
  const tag = list.listType === 'number' ? 'ol' : 'ul'
  const start = typeof list.start === 'number' && list.start > 1 ? Math.floor(list.start) : 1
  const startAttr = tag === 'ol' && start > 1 ? ` start="${start}"` : ''
  const items = childrenOf(list)
    .map((item) => {
      // A nested list can sit in its own item (the editor) or beside it.
      if (item.type === 'list') return `<li>${listHtml(item)}</li>`
      const kids = childrenOf(item)
      const text = kids
        .filter((kid) => kid.type !== 'list')
        .map(inlineHtml)
        .join('')
      const nested = kids
        .filter((kid) => kid.type === 'list')
        .map(listHtml)
        .join('')
      return `<li>${text}${nested}</li>`
    })
    .join('')
  return `<${tag}${startAttr}>${items}</${tag}>`
}

/** Lexical JSON -> HTML string. Every text and attribute value is escaped. */
export function lexicalToHtml(body: unknown): string {
  const parts: string[] = []
  for (const child of rootChildren(body)) {
    switch (child.type) {
      case 'heading': {
        const tag = `h${levelOf(child.tag, 2)}`
        parts.push(`<${tag}>${childrenOf(child).map(inlineHtml).join('')}</${tag}>`)
        break
      }
      case 'paragraph':
        parts.push(`<p>${childrenOf(child).map(inlineHtml).join('')}</p>`)
        break
      case 'list':
        parts.push(listHtml(child))
        break
      case 'quote':
        parts.push(`<blockquote>${childrenOf(child).map(inlineHtml).join('')}</blockquote>`)
        break
      default: {
        const text = inlineText(child).trim()
        if (text) parts.push(`<p>${escapeHtml(text)}</p>`)
      }
    }
  }
  return parts.join('\n')
}
