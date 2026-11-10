import type { Article, Template } from '../payload-types'
import {
  extractHeadings,
  lexicalToHtml,
  lexicalToMarkdown,
  lexicalToText,
  markdownToLexical,
} from './richText'

type RichText = NonNullable<Template['outline']>

/** Lexical JSON → React-safe HTML string. See `richText.ts` for the supported nodes. */
export function lexicalBodyToHtml(body: Article['body']): string {
  return lexicalToHtml(body)
}

/**
 * Trimmed text of the body's last H2 heading, or `null` when it has none.
 *
 * Used to decide whether the reader page's own "FAQ" heading would duplicate
 * one the body already ends in — templates increasingly write their own FAQ
 * section straight into the outline.
 */
export function lastH2HeadingText(body: Article['body']): string | null {
  const h2 = extractHeadings(body).filter((heading) => heading.level === 2)
  return h2.length ? h2[h2.length - 1].text : null
}

/**
 * Lexical → plain text, one line per block and per list item, no markers. For
 * anything that reads the words (reading time, phrase matching); the template
 * textareas use `lexicalToMarkdownText`.
 */
export function lexicalToPlainText(body: RichText | null | undefined): string {
  return lexicalToText(body)
}

/**
 * Lexical → markdown lines for config textareas (headings, list items, quotes
 * and inline marks are kept), one block per line, so `plainTextToLexical` reads
 * the same content back.
 */
export function lexicalToMarkdownText(body: RichText | null | undefined): string {
  return lexicalToMarkdown(body, '\n')
}

/** Plain / light markdown → Lexical (matches pipeline seed shape). */
export function plainTextToLexical(markdown: string): RichText {
  return markdownToLexical(markdown) as RichText
}
