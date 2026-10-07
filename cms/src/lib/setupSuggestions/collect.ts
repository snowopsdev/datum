import type { Payload } from 'payload'
import { lexicalToPlainText } from '../lexicalHtml'
import { brandVoiceContentOf, type BrandVoiceContent } from '../brandVoice'
import { evidenceBankContentOf, type EvidenceBankContent } from '../tenant/evidenceBank'
import {
  removedPhrases,
  recurringNotTraits,
  recurringUnbackedClaims,
  recurringRejectedRefs,
} from './signals'
import type { QaObservation, PublishedComparison, SuggestionCandidate } from './types'
import { loadStyleGuide } from '../../../../pipeline/src/styleGuide'
import type { SetupSuggestion } from '../../payload-types'
const object = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
const text = (raw: unknown): string => (typeof raw === 'string' ? raw : '')
const normalized = (s: string) => s.trim().toLowerCase()
export async function suggestionAssets(payload: Payload) {
  const [voices, doc] = await Promise.all([
    payload.find({
      collection: 'brand-voices',
      where: { status: { equals: 'active' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'evidence-bank', overrideAccess: true, depth: 0 }),
  ])
  return {
    voice: voices.docs[0] ?? null,
    bankDoc: doc,
    voiceContent: voices.docs[0] ? brandVoiceContentOf(voices.docs[0]) : null,
    bank: evidenceBankContentOf(doc),
  }
}
export function suggestionSatisfied(
  row: Pick<SetupSuggestion, 'kind' | 'proposal'>,
  voice: BrandVoiceContent | null,
  bank: EvidenceBankContent,
): boolean {
  const p = object(row.proposal)
  if (row.kind === 'banned_word')
    return !!voice?.bannedWords.some((w) => normalized(w.word) === normalized(text(p.phrase)))
  if (row.kind === 'not_trait') {
    const trait = voice?.notTraits.find((t) => normalized(t.trait) === normalized(text(p.trait)))
    return !!trait?.boundaryNote.trim() && trait.boundaryNote !== p.previousBoundaryNote
  }
  if (row.kind === 'unbacked_claim')
    return [
      ...bank.verifiedClaims.map((c) => c.claim),
      ...bank.rejectedClaims.map((c) => c.claim),
    ].some((c) => normalized(c) === normalized(text(p.claim)))
  if (row.kind === 'rejected_ref')
    return !!bank.rejectedClaims.find((c) => c.ref === p.ref)?.replacement.trim()
  return false
}
function outputText(output: Record<string, unknown>): string {
  return [
    lexicalToPlainText(output.body as never),
    ...['title', 'titleTag', 'metaDescription', 'ogTitle', 'ogDescription'].map((k) =>
      text(output[k]),
    ),
  ]
    .filter(Boolean)
    .join('\n')
}
export async function collectSetupSuggestions(
  payload: Payload,
): Promise<{ created: number; updated: number; obsolete: number }> {
  const result = { created: 0, updated: 0, obsolete: 0 }
  const assets = await suggestionAssets(payload)
  const [state, latest, current] = await Promise.all([
    payload.findGlobal({ slug: 'setup-suggestion-scan', overrideAccess: true }),
    payload.find({
      collection: 'article-audit',
      sort: ['-createdAt', '-id'],
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'setup-suggestions',
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const last = latest.docs[0]
  const changed = last && (last.createdAt !== state.auditCursor || last.id !== state.auditCursorId)
  if (changed) {
    const [history, published] = await Promise.all([
      // Only the two events the signals read. Every stage stores its full
      // output on its audit row, so an unfiltered read pulls research corpora
      // and information-gain runs into memory for nothing.
      payload.find({
        collection: 'article-audit',
        where: { event: { in: ['generate_completed', 'qa_completed'] } },
        sort: ['createdAt', 'id'],
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'articles',
        where: { status: { equals: 'published' } },
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const generated = new Map<number, { output: Record<string, unknown>; at: string }>()
    const qa: QaObservation[] = []
    for (const audit of history.docs) {
      const id = typeof audit.article === 'object' ? audit.article.id : audit.article
      const details = object(audit.details)
      const output = object(details.output)
      if (audit.event === 'generate_completed') generated.set(id, { output, at: audit.createdAt })
      if (audit.event === 'qa_completed')
        qa.push({
          articleId: id,
          at: audit.createdAt,
          ...object(output.qaResults ?? details.qaResults),
        } as QaObservation)
    }
    const comparisons: PublishedComparison[] = published.docs.flatMap((article) => {
      const gen = generated.get(article.id)
      return gen
        ? [
            {
              articleId: article.id,
              keyword: article.keyword,
              generatedText: outputText(gen.output),
              publishedText: outputText(article as unknown as Record<string, unknown>),
              at: gen.at,
            },
          ]
        : []
    })
    const candidates: SuggestionCandidate[] = [
      ...removedPhrases(comparisons, [
        ...loadStyleGuide().bannedPhrases,
        ...(assets.voiceContent?.bannedWords.map((w) => w.word) ?? []),
      ]),
      ...recurringNotTraits(qa),
      ...recurringUnbackedClaims(qa),
      ...recurringRejectedRefs(qa),
    ]
    for (const candidate of candidates) {
      const existing = current.docs.find((r) => r.signature === candidate.signature)
      if (candidate.kind === 'not_trait')
        candidate.proposal.previousBoundaryNote = existing
          ? object(existing.proposal).previousBoundaryNote
          : (assets.voiceContent?.notTraits.find(
              (t) => normalized(t.trait) === normalized(text(candidate.proposal.trait)),
            )?.boundaryNote ?? '')
      if (suggestionSatisfied(candidate, assets.voiceContent, assets.bank)) continue
      const dates = candidate.occurrences.map((o) => o.at).sort()
      const data = {
        ...candidate,
        occurrences: candidate.occurrences.slice(-10),
        count: candidate.occurrences.length,
        lastSeenAt: dates.at(-1),
        firstSeenAt: dates[0],
      }
      if (existing) {
        if (existing.count === data.count && existing.lastSeenAt === data.lastSeenAt) continue
        await payload.update({
          collection: 'setup-suggestions',
          id: existing.id,
          overrideAccess: true,
          data,
        })
        result.updated++
      } else {
        await payload.create({
          collection: 'setup-suggestions',
          overrideAccess: true,
          data: { ...data, status: 'open' },
        })
        result.created++
      }
    }
    await payload.updateGlobal({
      slug: 'setup-suggestion-scan',
      overrideAccess: true,
      data: { auditCursor: last.createdAt, auditCursorId: last.id },
    })
  }
  for (const row of current.docs)
    if (row.status === 'open' && suggestionSatisfied(row, assets.voiceContent, assets.bank)) {
      await payload.update({
        collection: 'setup-suggestions',
        id: row.id,
        overrideAccess: true,
        data: { status: 'obsolete' },
      })
      result.obsolete++
    }
  return result
}
