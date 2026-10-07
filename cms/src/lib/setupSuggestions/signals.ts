import { phraseNgrams, meaningfulTokens, wordsOf } from './ngrams'
import { claimSignature } from './signature'
import {
  THRESHOLDS,
  type PublishedComparison,
  type QaObservation,
  type SuggestionCandidate,
  type Occurrence,
} from './types'
export { THRESHOLDS } from './types'
const distinct = (rows: Occurrence[]): Occurrence[] => [
  ...new Map(rows.map((r) => [r.articleId, r])).values(),
]
const candidate = (
  kind: SuggestionCandidate['kind'],
  signature: string,
  proposal: Record<string, unknown>,
  occurrences: Occurrence[],
): SuggestionCandidate => ({
  kind,
  signature,
  proposal,
  occurrences: distinct(occurrences),
  target: kind === 'banned_word' || kind === 'not_trait' ? 'brand-voice' : 'evidence-bank',
})
export function removedPhrases(
  articles: PublishedComparison[],
  banned: readonly string[] = [],
): SuggestionCandidate[] {
  const grouped = new Map<string, { removed: Occurrence[]; kept: boolean }>()
  for (const article of articles) {
    const generated = phraseNgrams(article.generatedText, [article.keyword, ...banned])
    const published = new Set(phraseNgrams(article.publishedText).keys())
    for (const [phrase, excerpt] of generated) {
      const group = grouped.get(phrase) ?? { removed: [], kept: false }
      if (published.has(phrase)) group.kept = true
      else group.removed.push({ articleId: article.articleId, excerpt, at: article.at })
      grouped.set(phrase, group)
    }
  }
  const qualifying = [...grouped].flatMap(([phrase, g]) =>
    !g.kept && distinct(g.removed).length >= THRESHOLDS.removedPhrase
      ? [{ words: phrase.split(' '), occurrences: distinct(g.removed) }]
      : [],
  )
  return collapseFragments(qualifying).map(({ words, occurrences }) => {
    const phrase = words.join(' ')
    return candidate('banned_word', `banned_word:${phrase}`, { phrase }, occurrences)
  })
}

interface Fragment {
  words: string[]
  occurrences: Occurrence[]
}

const articleSet = (f: Fragment): Set<number> => new Set(f.occurrences.map((o) => o.articleId))

const sameArticles = (a: Fragment, b: Fragment): boolean => {
  const left = articleSet(a)
  const right = articleSet(b)
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/** True when `inner` appears as a contiguous run inside `outer`. */
const containsRun = (outer: string[], inner: string[]): boolean =>
  outer.some((_, i) => inner.every((word, j) => outer[i + j] === word))

/**
 * One removed phrase, not one suggestion per fragment of it.
 *
 * N-grams stop at three words, so deleting "looks like warm honey" from three
 * articles qualifies "looks", "like", "warm honey", "looks like warm", and
 * every other piece of it. Offered separately, an operator would be one click
 * from banning "like" and failing QA on nearly every future draft.
 *
 * Three passes. Fragments removed from exactly the same articles that overlap
 * by all but one word are chained back into the longer wording. A chain is
 * trimmed of edge words the reviewer kept: "crema looks" is a removed pair even
 * when "crema" survives, and the suggestion should be the words that went.
 * Then a fragment is dropped when a longer suggestion contains it and covers
 * every article it was removed from; one removed from more articles than that
 * is a separate habit and stays.
 */
function collapseFragments(fragments: Fragment[]): Fragment[] {
  const removedWords = new Set(fragments.filter((f) => f.words.length === 1).map((f) => f.words[0]))
  const trimmed = (f: Fragment): Fragment => {
    let words = f.words
    while (words.length > 1 && !removedWords.has(words[0])) words = words.slice(1)
    while (words.length > 1 && !removedWords.has(words[words.length - 1])) words = words.slice(0, -1)
    return { ...f, words }
  }
  let rows = [...fragments]
  for (let merged = true; merged; ) {
    merged = false
    outer: for (const a of rows) {
      for (const b of rows) {
        if (a === b || b.words.length < 2 || !sameArticles(a, b)) continue
        const overlap = b.words.length - 1
        if (a.words.length < overlap) continue
        if (a.words.slice(-overlap).join(' ') !== b.words.slice(0, overlap).join(' ')) continue
        const next = { words: [...a.words, b.words[b.words.length - 1]], occurrences: a.occurrences }
        if (rows.some((r) => r.words.join(' ') === next.words.join(' '))) continue
        rows = [...rows.filter((r) => r !== a && r !== b), next]
        merged = true
        break outer
      }
    }
  }
  const byPhrase = new Map<string, Fragment>()
  for (const row of rows.map(trimmed)) {
    const phrase = row.words.join(' ')
    if (!byPhrase.has(phrase) && (row.words.length > 1 || removedWords.has(row.words[0]))) {
      byPhrase.set(phrase, row)
    }
  }
  rows = [...byPhrase.values()]
  return rows.filter(
    (inner) =>
      !rows.some(
        (outer) =>
          outer !== inner &&
          outer.words.length > inner.words.length &&
          containsRun(outer.words, inner.words) &&
          [...articleSet(inner)].every((id) => articleSet(outer).has(id)),
      ),
  )
}
export function recurringNotTraits(rows: QaObservation[]): SuggestionCandidate[] {
  const groups = new Map<string, { trait: string; occurrences: Occurrence[] }>()
  for (const row of rows)
    for (const finding of row.qualitativeReview?.notTraitViolations ?? []) {
      if (!finding.trait?.trim() || !finding.excerpt?.trim()) continue
      const key = finding.trait.trim().toLowerCase()
      const g = groups.get(key) ?? { trait: finding.trait.trim(), occurrences: [] }
      g.occurrences.push({ articleId: row.articleId, excerpt: finding.excerpt, at: row.at })
      groups.set(key, g)
    }
  return [...groups].flatMap(([key, g]) =>
    distinct(g.occurrences).length >= THRESHOLDS.notTrait
      ? [candidate('not_trait', `not_trait:${key}`, { trait: g.trait }, g.occurrences)]
      : [],
  )
}
export function recurringUnbackedClaims(rows: QaObservation[]): SuggestionCandidate[] {
  const groups: {
    tokens: Set<string>
    numbers: string
    excerpt: string
    occurrences: Occurrence[]
  }[] = []
  for (const row of rows)
    for (const claim of row.evidenceCheck?.claims ?? []) {
      if (claim.kind !== 'first_party' || claim.status !== 'unbacked' || !claim.excerpt?.trim())
        continue
      const tokens = new Set(meaningfulTokens(claim.excerpt))
      if (!tokens.size) continue
      const numbers = wordsOf(claim.excerpt)
        .filter((t) => /\d/.test(t))
        .sort()
        .join(' ')
      let group = groups.find(
        (g) =>
          g.numbers === numbers &&
          [...tokens].filter((t) => g.tokens.has(t)).length /
            new Set([...tokens, ...g.tokens]).size >=
            0.6,
      )
      if (!group) {
        group = { tokens, numbers, excerpt: claim.excerpt, occurrences: [] }
        groups.push(group)
      }
      group.occurrences.push({ articleId: row.articleId, excerpt: claim.excerpt, at: row.at })
    }
  return groups.flatMap((g) =>
    distinct(g.occurrences).length >= THRESHOLDS.unbackedClaim
      ? [
          candidate(
            'unbacked_claim',
            claimSignature([...g.tokens]),
            { claim: g.excerpt },
            g.occurrences,
          ),
        ]
      : [],
  )
}
export function recurringRejectedRefs(rows: QaObservation[]): SuggestionCandidate[] {
  const groups = new Map<string, Occurrence[]>()
  for (const row of rows)
    for (const claim of row.evidenceCheck?.claims ?? []) {
      const ref = claim.ref?.trim().toUpperCase()
      if (claim.status !== 'rejected' || !ref || !/^R\d+$/.test(ref) || !claim.excerpt?.trim())
        continue
      groups.set(ref, [
        ...(groups.get(ref) ?? []),
        { articleId: row.articleId, excerpt: claim.excerpt, at: row.at },
      ])
    }
  return [...groups].flatMap(([ref, occurrences]) =>
    distinct(occurrences).length >= THRESHOLDS.rejectedRef
      ? [candidate('rejected_ref', `rejected_ref:${ref}`, { ref }, occurrences)]
      : [],
  )
}
