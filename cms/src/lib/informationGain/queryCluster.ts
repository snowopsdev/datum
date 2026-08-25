/**
 * Information gain — the query cluster a draft is scored against.
 *
 * Relevance is not measured against the target keyword alone: the related
 * questions the keyword's SERP surfaces carry weight too, just less of it.
 * `buildQueryCluster` is the one place that ratio is decided, so the judge
 * prompt, the scorer, and the admin view all see the same weights. Like the
 * rest of `cms/src/lib/informationGain/`, this file stays free of `next`,
 * `react`, `payload`, `@/` aliases, `process.env`, and `node:*` imports.
 */

import type { QueryClusterEntry } from './types'

/** The target keyword carries the full share of intent. */
export const KEYWORD_WEIGHT = 1

/** A related question is worth a fraction of the keyword, not nothing. */
export const RELATED_QUESTION_WEIGHT = 0.3

/**
 * The keyword becomes `q0`, surviving related questions `q1…`. Blank entries and
 * anything that repeats an earlier query (compared trimmed and lower-cased, the
 * keyword included) are dropped, then the weights are normalised to sum to 1 so
 * a long question list cannot inflate a draft's relevance. The stored `text`
 * keeps its original casing; only the dedupe key is folded.
 */
export function buildQueryCluster(
  keyword: string,
  relatedQuestions: string[],
): QueryClusterEntry[] {
  const seen = new Set<string>()
  const entries: { id: string; text: string; kind: QueryClusterEntry['kind']; raw: number }[] = []

  const trimmedKeyword = keyword.trim()
  if (trimmedKeyword.length > 0) {
    seen.add(trimmedKeyword.toLowerCase())
    entries.push({ id: 'q0', text: trimmedKeyword, kind: 'keyword', raw: KEYWORD_WEIGHT })
  }

  let index = 1
  for (const question of relatedQuestions) {
    const text = question.trim()
    if (text.length === 0) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      id: `q${index}`,
      text,
      kind: 'related_question',
      raw: RELATED_QUESTION_WEIGHT,
    })
    index += 1
  }

  const total = entries.reduce((sum, entry) => sum + entry.raw, 0)
  if (total <= 0) return []

  return entries.map(({ id, text, kind, raw }) => ({ id, text, kind, weight: raw / total }))
}
