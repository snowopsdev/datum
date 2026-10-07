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
  return [...grouped].flatMap(([phrase, g]) =>
    !g.kept && distinct(g.removed).length >= THRESHOLDS.removedPhrase
      ? [candidate('banned_word', `banned_word:${phrase}`, { phrase }, g.removed)]
      : [],
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
