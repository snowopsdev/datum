/**
 * The information-gain stage: does this draft actually add anything the pages
 * already ranking for its keyword do not say?
 *
 * It runs after QA, on `qa_passed`, because there is no point spending judge and
 * web-search calls on a draft that failed its structural or style checks. The
 * shape of the work is three LLM passes and one pure gate:
 *
 *   1. pull the draft apart into atomic claims;
 *   2. judge each claim against the baseline corpus captured at research time —
 *      is this new, does it answer the query, is it worth saying;
 *   3. hunt outside evidence for the claims that look genuinely new, and
 *      compare their numbers with the quoted excerpts deterministically;
 *   4. hand the whole scorecard to `decidePolicy`, which is the only place a
 *      verdict is reached.
 *
 * The two batched LLM passes live in `./passes` and every rule applied to what
 * they return lives in `./scorecard`, so this file is the flow and the
 * persistence, and every rule is unit-testable without Payload. Every 0–1
 * signal here is an uncalibrated LLM estimate.
 */

import type { Where } from 'payload'

import type { CorpusSnapshot } from '../../../cms/src/payload-types'
import { completeJSONLogged } from '../llm'
import { lexicalToPlainText, type RichText } from '../richtext'
import type { Stage, StageContext } from '../stages'

import { intraDocumentNovelty } from './batching'
import { recordCandidateSightings } from './candidates'
import { runJudge, runVerifier } from './passes'
import { DRAFT_CLAIM_EXTRACTION_SYSTEM, draftClaimUser } from './prompts'
import {
  articleOutcome,
  buildClaimRecord,
  buildRunRow,
  buildScorecard,
  deriveJudgeSignals,
  unjudgedSignals,
  unverifiedOutcome,
  verifiedOutcome,
  type ClaimInput,
  type JudgeDerived,
  type VerificationOutcome,
} from './scorecard'
import {
  collectCandidateSightings,
  decidePolicy,
  estimateTokens,
  parseDraftClaims,
  scoreDocument,
  type BaselineClaim,
  type Facet,
  type QueryClusterEntry,
} from './lib'

/** The three stages whose cost belongs to this scoring run. */
const IG_COST_STAGES = ['claimExtraction', 'informationGainJudge', 'evidenceVerification']

/** JSON columns carry no shape guarantee, so nothing about them is trusted. */
const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

/** A relationship stored at `maxDepth: 0` is an id, but a hand-written row may be populated. */
function relationshipId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

/**
 * The corpus snapshot this article was researched against, or null when there
 * is none to score with. `find` rather than `findByID` because a snapshot row
 * deleted since the research stage ran is a missing baseline, not a crash —
 * the draft still gets its claims extracted and goes to a human.
 */
async function resolveSnapshot(
  ctx: StageContext,
  snapshotId: number | null,
): Promise<CorpusSnapshot | null> {
  if (snapshotId === null) return null
  const { docs } = await ctx.payload.find({
    collection: 'corpus-snapshots',
    where: { id: { equals: snapshotId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const snapshot = docs[0]
  if (!snapshot || snapshot.status === 'empty') return null
  return snapshot
}

export const informationGainStage: Stage = {
  name: 'informationGain',
  entryStatus: 'qa_passed',
  exitStatus: 'verified',
  async run(article, ctx) {
    const policy = ctx.policy.policy
    const scoredAt = new Date().toISOString()
    const plainText = article.body ? lexicalToPlainText(article.body as RichText) : ''
    const tokenCount = estimateTokens(plainText)

    // The article's own copy of the baseline, not the snapshot's: a snapshot can
    // be superseded, and `mustHave`/`weight` were re-derived against this
    // article's template when research ran. The snapshot is still the source of
    // the baseline *claims*, which are too large to duplicate per article.
    const facets = asArray<Facet>(article.research?.facets)
    const queryCluster = asArray<QueryClusterEntry>(article.research?.queryCluster)
    const snapshotId = relationshipId(article.research?.snapshot)
    const snapshot = await resolveSnapshot(ctx, snapshotId)
    const baselineAvailable = snapshot !== null
    const baselineClaims = asArray<BaselineClaim>(snapshot?.baselineClaims)

    const extraction = await completeJSONLogged(ctx, 'claimExtraction', article.id, {
      system: DRAFT_CLAIM_EXTRACTION_SYSTEM,
      user: draftClaimUser(
        { keyword: article.keyword, title: article.title ?? null },
        facets,
        plainText,
      ),
      fixtureKey: 'draft',
    })
    const draftClaims = parseDraftClaims(
      extraction.json,
      plainText,
      new Set(facets.map((facet) => facet.id)),
    )

    const judged = baselineAvailable
      ? await runJudge(
          ctx,
          article.id,
          article.keyword,
          queryCluster,
          facets,
          draftClaims,
          baselineClaims,
        )
      : new Map<string, JudgeDerived>()

    const verified = baselineAvailable
      ? await runVerifier(ctx, article.id, article.keyword, draftClaims, judged, ctx.policy.policy)
      : new Map<string, VerificationOutcome>()

    const inputs: ClaimInput[] = draftClaims.map((claim, index) => ({
      claim,
      judge: judged.get(claim.id) ?? unjudgedSignals(),
      // Only the claims *before* this one in document order count as earlier:
      // the first statement of a fact keeps its value, the repeat is discounted.
      intraDocumentNovelty: baselineAvailable
        ? intraDocumentNovelty(claim, draftClaims.slice(0, index))
        : 1,
      verification: verified.get(claim.id) ?? unverifiedOutcome(claim.type, baselineAvailable),
    }))

    const claims = inputs.map((input) => buildClaimRecord(input, policy))
    const facetById = new Map(draftClaims.map((claim) => [claim.id, claim.facetId]))
    const scores = scoreDocument(
      claims,
      tokenCount,
      policy,
      facets,
      (id) => facetById.get(id) ?? null,
    )
    const scorecard = buildScorecard({ claims, scores, facets, policy, baselineAvailable })
    const { decision, reasons } = decidePolicy(scorecard, claims, policy)

    // After every LLM call above, so this run's own rows are counted.
    const costUsd = await sumCost(ctx, article.id, ctx.runId)
    const run = await ctx.payload.create({
      collection: 'information-gain-runs',
      overrideAccess: true,
      data: buildRunRow({
        articleId: article.id,
        pipelineRunId: ctx.runId,
        snapshotId,
        policyVersion: ctx.policy.version,
        policy: { policy, sources: ctx.policy.sources },
        models: {
          claimExtraction: ctx.models.claimExtraction,
          informationGainJudge: ctx.models.informationGainJudge,
          evidenceVerification: ctx.models.evidenceVerification,
        },
        decision,
        reasons,
        scorecard,
        claims,
        tokenCount,
        costUsd,
        draftUpdatedAt: article.updatedAt ?? null,
      }),
    })

    // Bookkeeping, not scoring: the decision above is already final, and a
    // throw here would cost the article its progress and re-buy all three LLM
    // passes on the next run over a queue row. The failure still surfaces —
    // `runPipeline` logs and counts every warning and stores it on the audit row.
    const warnings: string[] = []
    try {
      const sightings = collectCandidateSightings({
        claims,
        pages: snapshot?.pages ?? [],
        rules: ctx.evidenceSources,
        articleId: article.id,
        keyword: article.keyword,
        runId: run.id,
        seenAt: scoredAt,
      })
      if (sightings.length > 0) {
        const { created, updated } = await recordCandidateSightings(ctx.payload, sightings)
        console.log(
          `[informationGain] article ${article.id}: ${created + updated} candidate domain(s) ` +
            `recorded (${created} new)`,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`evidence-source candidates not recorded: ${message}`)
      console.error(`[informationGain] article ${article.id} candidate write failed`, error)
    }

    const totalCostUsd = await sumCost(ctx, article.id)
    console.log(
      `[informationGain] article ${article.id}: ${decision} ` +
        `(coverage ${fmt(scorecard.scores.consensusCoverage)}, ` +
        `verification ratio ${fmt(scorecard.scores.verificationRatio)}, ` +
        `${scorecard.claimSummary.verifiedNovelClaims}/${scorecard.claimSummary.materiallyNovelClaims} novel claims verified)`,
    )
    for (const reason of reasons) {
      console.log(`[informationGain]   ${reason.severity} ${reason.policy}: ${reason.message}`)
    }

    return articleOutcome({
      decision,
      runId: run.id,
      policyVersion: ctx.policy.version,
      scorecard,
      totalCostUsd,
      scoredAt,
      warnings,
    })
  },
}

const fmt = (value: number | null): string => (value === null ? 'n/a' : value.toFixed(2))

/**
 * This article's spend: the whole cost-log for `totalCostUsd`, or only this
 * run's information-gain rows for the run record's own `costUsd`.
 */
async function sumCost(ctx: StageContext, articleId: number, runId?: string): Promise<number> {
  const and: Where[] = [{ article: { equals: articleId } }]
  if (runId !== undefined) {
    and.push({ pipelineRunId: { equals: runId } }, { stage: { in: IG_COST_STAGES } })
  }
  const { docs } = await ctx.payload.find({
    collection: 'cost-log',
    where: { and },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return docs.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)
}
