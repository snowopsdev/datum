/**
 * The two LLM passes the information-gain stage makes over a draft's claims:
 * judging them against the baseline corpus, and hunting outside evidence for
 * the ones that look genuinely new.
 *
 * Split out from the stage itself because they are the only parts that loop
 * over batches and call a model; the stage file is then the flow and the
 * persistence, and `./scorecard` is every rule applied to what comes back.
 */

import { completeJSONLogged } from '../llm'
import type { StageContext } from '../stages'

import {
  judgeBatches,
  pickForVerification,
  selectBaselineContext,
  verifierBatches,
} from './batching'
import {
  parseJudgeReply,
  parseVerifierReply,
  type BaselineClaim,
  type DraftClaim,
  type Facet,
  type InformationGainPolicy,
  type QueryClusterEntry,
  type VerifierSignals,
} from './lib'
import { JUDGE_SYSTEM, judgeUser, VERIFIER_SYSTEM, verifierUser } from './prompts'
import {
  deriveJudgeSignals,
  firstPartyOutcome,
  verifiedOutcome,
  type JudgeDerived,
  type VerificationOutcome,
} from './scorecard'

/**
 * One judge call per facet batch. Batching by facet is what keeps the baseline
 * context small enough to fit: every claim in a batch is weighed against the
 * same slice of the corpus.
 */
export async function runJudge(
  ctx: StageContext,
  articleId: number,
  keyword: string,
  queryCluster: QueryClusterEntry[],
  facets: Facet[],
  draftClaims: DraftClaim[],
  baselineClaims: BaselineClaim[],
): Promise<Map<string, JudgeDerived>> {
  const queryIds = new Set(queryCluster.map((query) => query.id))
  const baselineIds = new Set(baselineClaims.map((claim) => claim.id))
  const derived = new Map<string, JudgeDerived>()

  for (const batch of judgeBatches(draftClaims)) {
    const context = selectBaselineContext(batch, baselineClaims)
    const result = await completeJSONLogged(ctx, 'informationGainJudge', articleId, {
      system: JUDGE_SYSTEM,
      user: judgeUser({ keyword }, queryCluster, facets, batch, context),
    })
    const signals = parseJudgeReply(
      result.json,
      batch.map((claim) => claim.id),
      queryIds,
      baselineIds,
    )
    for (const [claimId, judge] of signals) {
      derived.set(claimId, deriveJudgeSignals(judge, queryCluster))
    }
  }
  return derived
}

/** Letters and digits only, lower-cased: the comparison unit for overlap. */
const normalise = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Which draft claims the workspace's own evidence bank already backs.
 *
 * A normalised substring match in either direction, because the writer's
 * sentence and the claim extractor's paraphrase of it are rarely identical:
 * the extractor drops subordinate clauses, so the claim is usually contained in
 * the cited sentence, and occasionally the reverse. Anything shorter than a
 * clause is ignored, since a short string is contained in almost everything.
 *
 * Deliberately conservative — a missed match costs a web verification the run
 * was going to pay for anyway, while a false match would mark an unrelated
 * sentence as verified by evidence that says nothing about it.
 */
export function firstPartyMatches(
  draftClaims: DraftClaim[],
  citations: { ref: string; excerpt: string }[],
): Map<string, string> {
  const matches = new Map<string, string>()
  const cited = citations
    .map((citation) => ({ ref: citation.ref, text: normalise(citation.excerpt) }))
    .filter((citation) => citation.text.length >= 40)
  if (cited.length === 0) return matches
  for (const claim of draftClaims) {
    const text = normalise(claim.text)
    if (text.length < 40) continue
    const hit = cited.find(
      (citation) => citation.text.includes(text) || text.includes(citation.text),
    )
    if (hit) matches.set(claim.id, hit.ref)
  }
  return matches
}

/**
 * Web-search verification for the materially novel, checkable claims only.
 * Claims left out keep the neutral values `unverifiedOutcome` gives them —
 * absence of a check is not evidence of a problem, and only a `verified` claim
 * can be blocked. Claims the evidence bank already backs are settled before the
 * selection, so they never spend a search.
 */
export async function runVerifier(
  ctx: StageContext,
  articleId: number,
  keyword: string,
  draftClaims: DraftClaim[],
  judged: Map<string, JudgeDerived>,
  policy: InformationGainPolicy,
  /**
   * The evidence-bank entries the draft declared, from `article.evidenceCitations`.
   * A claim that restates one is settled here rather than searched for on the
   * web, where by construction it cannot be found. See R6 in the design.
   */
  firstParty: { ref: string; excerpt: string }[] = [],
): Promise<Map<string, VerificationOutcome>> {
  const outcomes = new Map<string, VerificationOutcome>()
  const backed = firstPartyMatches(draftClaims, firstParty)
  for (const [claimId, ref] of backed) {
    const claim = draftClaims.find((row) => row.id === claimId)
    if (claim) outcomes.set(claimId, firstPartyOutcome(ref, claim.text))
  }
  const candidates = draftClaims
    .filter((claim) => !backed.has(claim.id))
    .map((claim) => ({
      claim,
      novelty: judged.get(claim.id)?.novelty ?? 0,
    }))
  const selected = pickForVerification(candidates, policy)
  const byId = new Map(draftClaims.map((claim) => [claim.id, claim]))

  for (const batch of verifierBatches(selected)) {
    const result = await completeJSONLogged(ctx, 'evidenceVerification', articleId, {
      system: VERIFIER_SYSTEM,
      user: verifierUser({ keyword }, batch),
      needWebSearch: true,
    })
    const signals: Map<string, VerifierSignals> = parseVerifierReply(
      result.json,
      batch.map((claim) => claim.id),
    )
    for (const [claimId, verifier] of signals) {
      const claim = byId.get(claimId)
      if (claim === undefined) continue
      outcomes.set(claimId, verifiedOutcome(claim, verifier, ctx.evidenceSources))
    }
  }
  return outcomes
}
