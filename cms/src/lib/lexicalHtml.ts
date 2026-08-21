import type { Article, Template } from '../payload-types'

type LexNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexNode[]
  listType?: string
  direction?: string | null
  format?: string | number
  indent?: number
  version?: number
  mode?: string
  style?: string
  detail?: number
  textFormat?: number
}

type RichText = NonNullable<Template['outline']>

function textOf(node: LexNode | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.children)) return node.children.map(textOf).join('')
  return ''
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Minimal Lexical JSON → React-safe HTML string (headings, paragraphs, lists). */
export function lexicalBodyToHtml(body: Article['body']): string {
  if (!body?.root?.children?.length) return ''
  const parts: string[] = []
  for (const child of body.root.children as LexNode[]) {
    const type = child.type
    if (type === 'heading') {
      const tag = child.tag === 'h1' || child.tag === 'h2' || child.tag === 'h3' ? child.tag : 'h2'
      parts.push(`<${tag}>${escapeHtml(textOf(child))}</${tag}>`)
    } else if (type === 'paragraph') {
      parts.push(`<p>${escapeHtml(textOf(child))}</p>`)
    } else if (type === 'list') {
      const listTag = child.listType === 'number' ? 'ol' : 'ul'
      const items = (child.children ?? [])
        .map((item) => `<li>${escapeHtml(textOf(item))}</li>`)
        .join('')
      parts.push(`<${listTag}>${items}</${listTag}>`)
    } else if (type === 'quote') {
      parts.push(`<blockquote>${escapeHtml(textOf(child))}</blockquote>`)
    } else {
      const t = textOf(child).trim()
      if (t) parts.push(`<p>${escapeHtml(t)}</p>`)
    }
  }
  return parts.join('\n')
}

/** Lexical → plain lines for config textareas (#/##/### preserved when present). */
export function lexicalToPlainText(body: RichText | null | undefined): string {
  if (!body?.root?.children?.length) return ''
  const lines: string[] = []
  for (const child of body.root.children as LexNode[]) {
    const text = textOf(child).trim()
    if (!text) continue
    if (child.type === 'heading' && typeof child.tag === 'string') {
      const level = Number(child.tag.replace('h', '')) || 2
      lines.push(`${'#'.repeat(Math.min(3, Math.max(1, level)))} ${text}`)
    } else {
      lines.push(text)
    }
  }
  return lines.join('\n')
}

/** Plain / light markdown → Lexical (matches pipeline seed shape). */
export function plainTextToLexical(markdown: string): RichText {
  const children: LexNode[] = []
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^(#{1,3})\s+(.*)$/.exec(line)
    const textNode: LexNode = {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text: match ? match[2].trim() : line,
      type: 'text',
      version: 1,
    }
    if (match) {
      children.push({
        children: [textNode],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: `h${match[1].length}`,
        type: 'heading',
        version: 1,
      })
    } else {
      children.push({
        children: [textNode],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        type: 'paragraph',
        version: 1,
      })
    }
  }
  return {
    root: {
      children: children as RichText['root']['children'],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}
