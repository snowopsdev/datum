export type SuggestionKind = 'banned_word' | 'not_trait' | 'unbacked_claim' | 'rejected_ref'
export interface Occurrence {
  articleId: number
  excerpt: string
  at: string
}
export interface SuggestionCandidate {
  kind: SuggestionKind
  signature: string
  target: 'brand-voice' | 'evidence-bank'
  proposal: Record<string, unknown>
  occurrences: Occurrence[]
}
export interface PublishedComparison {
  articleId: number
  keyword: string
  generatedText: string
  publishedText: string
  at: string
}
export interface QaObservation {
  articleId: number
  at: string
  qualitativeReview?: { notTraitViolations?: { trait: string; excerpt: string }[] }
  evidenceCheck?: {
    claims?: { kind?: string; status?: string; excerpt: string; ref?: string | null }[]
  }
}
export const THRESHOLDS = {
  removedPhrase: 3,
  notTrait: 3,
  unbackedClaim: 2,
  rejectedRef: 3,
} as const
