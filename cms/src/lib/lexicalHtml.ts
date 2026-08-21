import type { Article } from '../payload-types'

type LexNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexNode[]
  listType?: string
}

function textOf(node: LexNode | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.children)) return node.children.map(textOf).join('')
  return ''
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
