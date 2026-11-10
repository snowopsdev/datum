import type { Article } from '../../cms/src/payload-types'
import {
  extractHeadings as extractHeadingsOf,
  lexicalToMarkdown as lexicalToMarkdownOf,
  lexicalToText,
  markdownToLexical as markdownToLexicalOf,
  type HeadingInfo,
} from '../../cms/src/lib/richText'

// The converter lives in cms/src/lib/richText.ts so the pipeline and the CMS
// read and write exactly the same Lexical shapes.
export type { HeadingInfo }

export type RichText = NonNullable<Article['body']>
export type RichTextNode = RichText['root']['children'][number]

/** Markdown (headings, lists, quotes, bold/italic/code, links) -> Lexical. */
export function markdownToLexical(markdown: string): RichText {
  return markdownToLexicalOf(markdown) as RichText
}

export function extractHeadings(body: RichText): HeadingInfo[] {
  return extractHeadingsOf(body)
}

/** Flatten rich text to markdown, keeping headings, list markers and links (used for prompts). */
export function lexicalToMarkdown(body: RichText): string {
  return lexicalToMarkdownOf(body)
}

/** Plain text, one line per block and per list item, no markers. */
export function lexicalToPlainText(body: RichText): string {
  return lexicalToText(body)
}
