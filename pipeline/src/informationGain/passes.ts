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

/**
 * Web-search verification for the materially novel, checkable claims only.
 * Claims left out keep the neutral values `unverifiedOutcome` gives them —
 * absence of a check is not evidence of a problem, and only a `verified` claim
 * can be blocked.
 */
export async function runVerifier(
  ctx: StageContext,
  articleId: number,
  keyword: string,
  draftClaims: DraftClaim[],
  judged: Map<string, JudgeDerived>,
  policy: InformationGainPolicy,
): Promise<Map<string, VerificationOutcome>> {
  const candidates = draftClaims.map((claim) => ({
    claim,
    novelty: judged.get(claim.id)?.novelty ?? 0,
  }))
  const selected = pickForVerification(candidates, policy)
  const byId = new Map(draftClaims.map((claim) => [claim.id, claim]))
  const outcomes = new Map<string, VerificationOutcome>()

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
