/**
 * The draft-side information-gain prompts: pulling atomic claims out of the
 * draft, judging each one against the baseline corpus, and hunting outside
 * evidence for the ones that look genuinely new.
 *
 * Their replies are parsed by `parseDraftClaims` / `parseJudgeReply` /
 * `parseVerifierReply` in the shared lib, so the JSON shapes described here and
 * the shapes those parsers accept must stay in step — the parsers drop or zero
 * anything that does not match, and a drifted prompt shows up as a draft with
 * no claims or a claim with no evidence, not as an error. Two requirements are
 * load-bearing: a claim nobody quoted from the draft cannot be checked against
 * it, and evidence nobody quoted from its source cannot be compared with the
 * claim's numbers.
 *
 * Every score these prompts ask for is an uncalibrated estimate. The judge is
 * told so directly, because a model that believes it is issuing verdicts writes
 * confident 0.0/1.0 answers; the policy gate in `scoring.ts` is what turns
 * these numbers into a decision.
 */

import type { BaselineClaim, DraftClaim, Facet, QueryClusterEntry } from './lib'

export const DRAFT_CLAIM_EXTRACTION_SYSTEM =
  'You decompose a draft article into atomic, self-contained claims. One fact per claim, at ' +
  'most 30 words, resolve pronouns, keep numbers, dates, and units exactly as written. Skip ' +
  'navigation, boilerplate, and pure transitions. Assign each claim to the id of the facet it ' +
  'answers from the facet list you are given, or null when none fits — never invent a facet id. ' +
  'Set "section" to the exact "##" heading the claim sits under, or "FAQ" for a claim from the ' +
  'FAQ items. Set "restatesClaimIndex" to the 0-based index of an earlier claim in your own ' +
  '"claims" array that this claim merely repeats in other words, otherwise null; never point at ' +
  'itself or at a later claim. Use "first_party_measurement" for any statement of our own tests, ' +
  'surveys, benchmarks, datasets, or measurements ("our testing found", "we surveyed", "our ' +
  'data shows"), however it is phrased. Return at most 60 claims. Return JSON: {"claims":' +
  '[{"text": string, "type": "factual"|"first_party_measurement"|"inference"|"recommendation"|' +
  '"opinion"|"definition"|"comparison"|"prediction", "excerpt": string (verbatim, at most 200 ' +
  'characters, copied from the draft and supporting the claim), "section": string|null, ' +
  '"facetId": string|null, "entities": string[], "values": string[] (numbers, percentages, ' +
  'currency, dates as written), "restatesClaimIndex": number|null}]}'

/** Everything a facet contributes to a prompt; the claim ids behind it are not needed. */
const facetBrief = (facets: Facet[]): { id: string; label: string; description: string }[] =>
  facets.map((facet) => ({ id: facet.id, label: facet.label, description: facet.description }))

/**
 * The draft extraction user turn: the query the draft is meant to answer, the
 * facets it may assign claims to, then the draft itself as plain text. The
 * facets go in as JSON because the reply references their ids.
 */
export function draftClaimUser(
  article: { keyword: string; title: string | null },
  facets: Facet[],
  plainText: string,
): string {
  return [
    `Query: "${article.keyword}"`,
    `Draft: ${article.title ?? '(untitled)'}`,
    `Facets:\n${JSON.stringify(facetBrief(facets), null, 2)}`,
    `Draft text:\n${plainText}`,
  ].join('\n\n')
}

export const JUDGE_SYSTEM =
  'You judge how much new information a draft adds over the pages already ranking for a query. ' +
  'For every draft claim you are given, estimate: "duplicateProbability", how likely the SERP ' +
  'baseline claims already state it, with "closestBaselineClaimId" set to the baseline claim id ' +
  'that comes nearest (null when none does); "internalDuplicateProbability" and ' +
  '"closestInternalClaimId", the same judgement against the claims from our own published ' +
  'articles; "relevanceByQuery", an object keyed by the query ids you are given, each 0-1, for ' +
  'how much the claim answers that query; "utility" sub-scores 0-1 for specificity, ' +
  'actionability, explanatoryPower, and audienceFit; "importance" from 0.5 to 2.0 for how much ' +
  'the claim matters to the search intent, where 1.0 is ordinary; ' +
  '"containsNumericOrTemporalClaim", true only when the claim states a number, amount, date, or ' +
  'duration; and a one-sentence "rationale". You judge, you never verify: do not search, do not ' +
  'decide whether a claim is true, and do not reward or punish a claim for being checkable. ' +
  'Every 0-1 number is an uncalibrated estimate, so use the middle of the range — reserve 0.0 ' +
  'and 1.0 for cases with no doubt at all. Return one entry for every claim id you were given ' +
  'and no others. Return JSON: {"claims":[{"claimId": string, "duplicateProbability": number, ' +
  '"closestBaselineClaimId": string|null, "internalDuplicateProbability": number, ' +
  '"closestInternalClaimId": string|null, "relevanceByQuery": {[queryId: string]: number}, ' +
  '"utility": {"specificity": number, "actionability": number, "explanatoryPower": number, ' +
  '"audienceFit": number}, "importance": number, "containsNumericOrTemporalClaim": boolean, ' +
  '"rationale": string}]}'

/** The claim fields the judge weighs; `excerptFound` and the rest are ours, not its business. */
const judgeClaimBrief = (
  claims: DraftClaim[],
): { id: string; text: string; type: string; section: string | null; values: string[] }[] =>
  claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    type: claim.type,
    section: claim.section,
    values: claim.values,
  }))

/** Baseline claims as the judge sees them: an id, the claim, and which corpus it came from. */
const baselineClaimBrief = (
  claims: BaselineClaim[],
): { id: string; text: string; corpus: 'serp' | 'internal'; values: string[] }[] =>
  claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    corpus: claim.source.kind,
    values: claim.values,
  }))

/**
 * One judge call: the query cluster the claims are scored against, the facet
 * the batch belongs to, the batch itself, and the baseline claims chosen for it
 * by `selectBaselineContext`. All four go in as labelled JSON because the reply
 * references query ids and baseline claim ids, and a reformatted list is the
 * easiest way to get ids back that match nothing.
 */
export function judgeUser(
  article: { keyword: string },
  queryCluster: QueryClusterEntry[],
  facets: Facet[],
  claims: DraftClaim[],
  baselineClaims: BaselineClaim[],
): string {
  return [
    `Query: "${article.keyword}"`,
    `Query cluster:\n${JSON.stringify(queryCluster, null, 2)}`,
    `Facets:\n${JSON.stringify(facetBrief(facets), null, 2)}`,
    `Draft claims:\n${JSON.stringify(judgeClaimBrief(claims), null, 2)}`,
    `Baseline claims:\n${JSON.stringify(baselineClaimBrief(baselineClaims), null, 2)}`,
  ].join('\n\n')
}

export const VERIFIER_SYSTEM =
  'You look for published evidence for or against each claim you are given, using web search. ' +
  'For every claim return "support" 0-1, how strongly the sources you found back it, and ' +
  '"contradiction" 0-1, how strongly they contradict it; the two are separate judgements, not ' +
  'complements. Return the sources as "evidence": each needs the "url" you actually read, an ' +
  '"excerpt" quoted verbatim from that page as a single sentence carrying the number, date, or ' +
  'statement at issue, the "publisher" name (null when the page names none), and a ' +
  '"sourceKind" of "primary" (the study, filing, or dataset itself), "official_docs" ' +
  '(documentation published by the vendor or standards body itself), "secondary" (reporting on ' +
  'a primary source), or "unverified" (anything you cannot place). Omit an evidence item ' +
  'entirely if you ' +
  'cannot quote it — never paraphrase into the excerpt, and never reconstruct a quote from ' +
  'memory. Never cite the draft under review, our own site, or any page that is reproducing the ' +
  'draft: they cannot corroborate themselves. A claim with no evidence you can quote gets an ' +
  'empty "evidence" array and support 0, which is a legitimate answer. Use "notes" for what you ' +
  'searched and what you could not settle. Both numbers are uncalibrated estimates. Return ' +
  'JSON: {"claims":[{"claimId": string, "support": number, "contradiction": number, ' +
  '"evidence":[{"url": string, "excerpt": string, "publisher": string|null, "sourceKind": ' +
  '"primary"|"official_docs"|"secondary"|"unverified"}], "notes": string|null}]}'

/**
 * One verifier call. The claim's own excerpt goes along so the model can see the
 * wording in context, and its extracted `values` are called out because those
 * are what the deterministic exactness check will compare against the evidence.
 */
export function verifierUser(article: { keyword: string }, claims: DraftClaim[]): string {
  const brief = claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    type: claim.type,
    values: claim.values,
    draftExcerpt: claim.excerpt,
  }))
  return [
    `Query: "${article.keyword}"`,
    `Claims to check:\n${JSON.stringify(brief, null, 2)}`,
  ].join('\n\n')
}
