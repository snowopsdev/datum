import type { Article } from '../../cms/src/payload-types'

export type RichText = NonNullable<Article['body']>
export type RichTextNode = RichText['root']['children'][number]

export interface HeadingInfo {
  level: number
  text: string
}

const textNode = (text: string): RichTextNode => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const headingNode = (tag: 'h1' | 'h2' | 'h3', text: string): RichTextNode => ({
  children: [textNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  type: 'heading',
  version: 1,
})

const paragraphNode = (text: string): RichTextNode => ({
  children: [textNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  type: 'paragraph',
  version: 1,
})

/** Minimal markdown -> Lexical: #/##/### become heading nodes, everything else paragraphs. */
export function markdownToLexical(markdown: string): RichText {
  const children: RichTextNode[] = []
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^(#{1,3})\s+(.*)$/.exec(line)
    if (match) {
      const tag = `h${match[1].length}` as 'h1' | 'h2' | 'h3'
      children.push(headingNode(tag, match[2].trim()))
    } else {
      children.push(paragraphNode(line))
    }
  }
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

function nodeText(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  const record = node as Record<string, unknown>
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.children)) {
    return record.children.map(nodeText).join('')
  }
  return ''
}

export function extractHeadings(body: RichText): HeadingInfo[] {
  const headings: HeadingInfo[] = []
  for (const child of body.root.children) {
    if (child.type === 'heading' && typeof child.tag === 'string') {
      const level = Number.parseInt(child.tag.replace(/^h/, ''), 10)
      if (!Number.isNaN(level)) headings.push({ level, text: nodeText(child).trim() })
    }
  }
  return headings
}

/** Flatten rich text to markdown-ish lines, keeping heading markers (used for prompts). */
export function lexicalToMarkdown(body: RichText): string {
  return body.root.children
    .map((child) => {
      const text = nodeText(child).trim()
      if (!text) return ''
      if (child.type === 'heading' && typeof child.tag === 'string') {
        const level = Number.parseInt(child.tag.replace(/^h/, ''), 10) || 2
        return `${'#'.repeat(level)} ${text}`
      }
      return text
    })
    .filter((line) => line.length > 0)
    .join('\n\n')
}

export function lexicalToPlainText(body: RichText): string {
  return body.root.children
    .map((child) => nodeText(child).trim())
    .filter((t) => t.length > 0)
    .join('\n')
}
