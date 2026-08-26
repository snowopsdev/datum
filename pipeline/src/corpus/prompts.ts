/**
 * The corpus-side prompts: turning a baseline document into atomic claims, and
 * grouping those claims into the consensus facets a searcher expects answered.
 *
 * Both replies are parsed by `parsePageClaims` / `parseFacetClustering` in the
 * shared information-gain lib, so the JSON shapes described here and the shapes
 * those parsers accept must stay in step — the parsers drop anything that does
 * not match, and a drifted prompt shows up as an empty corpus, not an error.
 * The excerpt requirement is load-bearing: a claim nobody quoted cannot be
 * checked against the page it came from.
 */

import type { QueryClusterEntry } from '../informationGain/lib'

export const PAGE_CLAIM_EXTRACTION_SYSTEM =
  'You decompose a web page into atomic, self-contained claims relevant to a search query. ' +
  'One fact per claim, at most 30 words, resolve pronouns, keep numbers, dates, and units ' +
  'exactly as written. Skip navigation, ads, author bios, and boilerplate. Return at most 40 ' +
  'claims. Return JSON: {"claims":[{"text": string, "type": "factual"|"first_party_measurement"' +
  '|"inference"|"recommendation"|"opinion"|"definition"|"comparison"|"prediction", "excerpt": ' +
  'string (verbatim, at most 200 characters, copied from the page and supporting the claim), ' +
  '"entities": string[], "values": string[] (numbers, percentages, currency, dates as written)}]}'

/** The user turn for one ranking page: the query it is being read against, then its text. */
export function pageClaimUser(
  keyword: string,
  page: { position: number; title: string | null; url: string },
  text: string,
): string {
  return `Query: "${keyword}"\nPage #${page.position}: ${page.title ?? '(untitled)'} — ${page.url}\n\n${text}`
}

/** The same call for one of our own published articles, which has an id rather than a rank. */
export function internalClaimUser(
  keyword: string,
  article: { id: number; title: string | null; keyword: string },
  text: string,
): string {
  return `Query: "${keyword}"\nInternal article #${article.id}: ${article.title ?? '(untitled)'} (keyword "${article.keyword}")\n\n${text}`
}

export const FACET_CLUSTERING_SYSTEM =
  'You group baseline claims from the top-ranking pages into consensus facets: the distinct ' +
  'sub-questions a searcher expects answered. Each claim belongs to at most one facet; leave ' +
  "tangential claims unassigned. Use the template's required sections as facet hints where they " +
  'fit and set matchesHint to the exact hint text, otherwise null. Then list information gaps: ' +
  'questions in the query cluster that the baseline answers thinly (two pages or fewer) or not ' +
  'at all, each with the evidence that would settle it. At most 12 facets and 8 gaps. Return ' +
  'JSON: {"facets":[{"id": string, "label": string, "description": string, "claimIds": string[], ' +
  '"matchesHint": string|null}], "gaps":[{"facetId": string|null, "label": string, ' +
  '"description": string, "evidenceHint": string}]}'

/**
 * The clustering user turn. Everything the model has to match ids against is
 * sent as labelled JSON rather than prose, because its reply references those
 * ids and a reformatted list is the easiest way to get unusable `claimIds`.
 */
export function facetClusteringUser(
  keyword: string,
  queryCluster: QueryClusterEntry[],
  hints: string[],
  claims: { id: string; text: string; docId: string }[],
): string {
  return [
    `Query: "${keyword}"`,
    `Query cluster:\n${JSON.stringify(queryCluster, null, 2)}`,
    `Template section hints:\n${JSON.stringify(hints, null, 2)}`,
    `Baseline claims:\n${JSON.stringify(claims, null, 2)}`,
  ].join('\n\n')
}
