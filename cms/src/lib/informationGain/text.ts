/**
 * Information gain — tokenising, excerpt matching, and internal-corpus picking.
 *
 * Small deterministic string helpers the parsers and the scorer share: they
 * decide which of our own articles form the internal comparison corpus, whether
 * a model's quoted excerpt really appears in the draft, and how close two texts
 * are. Nothing here is a semantic measure — the overlap and Jaccard numbers are
 * cheap lexical proxies used to shortlist candidates before an LLM looks at
 * them. Like the rest of `cms/src/lib/informationGain/`, this file stays free of
 * `next`, `react`, `payload`, `@/` aliases, `process.env`, and `node:*` imports.
 */

/**
 * Words too common to carry topical signal, plus the recent years that show up
 * in nearly every SEO keyword ("best crm 2026") and would otherwise make two
 * unrelated articles look related.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'how',
  'what',
  'why',
  'is',
  'are',
  'do',
  'does',
  'best',
  'guide',
  'vs',
  'your',
  'you',
  'my',
  'at',
  'by',
  'from',
  'it',
  'its',
  'this',
  'that',
  'can',
  'should',
  'when',
  'where',
  'which',
  'who',
  'will',
  'be',
  'as',
  'into',
  'about',
  'top',
  'tips',
  'ways',
  '2024',
  '2025',
  '2026',
])

/** Lower-cased alphanumeric tokens, stopwords and one/two-letter tokens dropped, deduped. */
export function keywordTokens(s: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const token of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (token.length < 3 || STOPWORDS.has(token) || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens
}

/** How many meaningful tokens two strings share. */
export function tokenOverlap(a: string, b: string): number {
  const first = new Set(keywordTokens(a))
  return keywordTokens(b).filter((token) => first.has(token)).length
}

/**
 * The handful of our own articles worth comparing a draft against: those sharing
 * at least one token with the keyword, most overlapping first, most recently
 * updated breaking ties. Capped because every candidate costs prompt tokens.
 */
export function selectInternalCorpus<T extends { id: number; keyword: string; updatedAt: string }>(
  keyword: string,
  candidates: T[],
  cap = 5,
): T[] {
  return candidates
    .map((candidate) => ({ candidate, overlap: tokenOverlap(keyword, candidate.keyword) }))
    .filter((scored) => scored.overlap >= 1)
    .sort(
      (a, b) => b.overlap - a.overlap || b.candidate.updatedAt.localeCompare(a.candidate.updatedAt),
    )
    .slice(0, Math.max(0, cap))
    .map((scored) => scored.candidate)
}

/** Collapses every run of whitespace to a single space and trims. */
export function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Whether a model's quoted excerpt actually appears in the text it claims to
 * quote. Whitespace-insensitive and case-insensitive, because markdown wrapping
 * and title casing are not fabrication; anything beyond that is. An empty
 * excerpt is never "found" — it would otherwise vacuously verify every claim.
 */
export function excerptFoundIn(excerpt: string, text: string): boolean {
  const needle = normaliseWhitespace(excerpt).toLowerCase()
  if (needle.length === 0) return false
  return normaliseWhitespace(text).toLowerCase().includes(needle)
}

/** Jaccard index over keyword tokens; 0 when either side tokenises to nothing. */
export function nearDuplicateJaccard(a: string, b: string): number {
  const first = new Set(keywordTokens(a))
  const second = new Set(keywordTokens(b))
  if (first.size === 0 || second.size === 0) return 0
  let shared = 0
  for (const token of first) if (second.has(token)) shared += 1
  return shared / (first.size + second.size - shared)
}
