/**
 * The research stage: everything the generate stage needs to know about what is
 * already on the web for this keyword.
 *
 * Two products come out of it. The SERP summary and related questions are the
 * writing brief, as before. The corpus snapshot is the information-gain
 * baseline — the ranking pages' claims clustered into consensus facets and the
 * gaps they leave — and is deliberately keyed by keyword rather than by
 * article, so two articles on the same term share one crawl.
 *
 * The snapshot's facets, gaps, and query cluster are copied onto the article as
 * well as living on the snapshot. That duplication is on purpose: the snapshot
 * can be superseded by a fresher capture, and a published article's scores must
 * stay explainable against the baseline it was actually written and judged
 * against.
 */

import { buildBrief } from './brief'
import { getOrBuildSnapshot } from './corpus/snapshot'
import {
  applyTemplateHints,
  buildQueryCluster,
  type Facet,
  type InformationGap,
} from './informationGain/lib'
import { resolveTemplate, type Stage } from './stages'
import { selectIcp } from './tenant'

/** `facets` / `gaps` are JSON columns on the snapshot, so trust nothing about their shape. */
const storedFacets = (value: unknown): Facet[] => (Array.isArray(value) ? (value as Facet[]) : [])
const storedGaps = (value: unknown): InformationGap[] =>
  Array.isArray(value) ? (value as InformationGap[]) : []

export const researchStage: Stage = {
  name: 'research',
  entryStatus: 'topic_selected',
  // The brief checkpoint. `researched` is the generate stage's entry status,
  // and approving the brief is what moves a piece there.
  exitStatus: 'brief_review',
  async run(article, ctx) {
    // runPipeline queries with depth: 1, so the template relationship is populated.
    const template = resolveTemplate(article)
    const serp = await ctx.ahrefs.serpResearch(article.keyword)
    // The operator may have grouped several related searches into this one
    // article at discovery time; they belong in the cluster the draft is
    // written for and scored against, not just the primary.
    const secondaryKeywords = (article.secondaryKeywords ?? [])
      .map((row) => row.keyword?.trim())
      .filter((k): k is string => Boolean(k))
    const queryCluster = buildQueryCluster(
      article.keyword,
      serp.relatedQuestions,
      secondaryKeywords,
    )
    const snapshot = await getOrBuildSnapshot(ctx, article, template, serp, queryCluster)
    // A reused snapshot carries the template hints of whichever article built
    // it, so `mustHave` — and the `weight` its floor depends on — are re-derived
    // against this article's own required sections before the facets are copied
    // onto it. The snapshot row keeps the build-time flags as its audit record.
    const facets = applyTemplateHints(
      storedFacets(snapshot.facets),
      (template.requiredSections ?? []).map((section) => section.heading),
      snapshot.baselineDocCount ?? 0,
    )
    const gaps = storedGaps(snapshot.gaps)
    // The audience the brief is written for. A piece created before any ICP
    // existed still has none, so the fallback resolves to the primary and the
    // return below backfills it — after which the editor's choice in the brief
    // is what steers the draft.
    const icp = selectIcp(ctx.tenant, article)
    const brief = buildBrief({
      keyword: article.keyword,
      templateIntent: template.intent,
      requiredSections: (template.requiredSections ?? []).map((s) => s.heading),
      facets,
      gaps,
      brandVoice: ctx.brandVoice,
      icp,
    })
    return {
      status: ctx.pauseForBrief === false ? 'researched' : 'brief_review',
      data: {
        brief,
        research: {
          rankingPagesSummary: serp.rankingPagesSummary,
          commonSubtopics: serp.commonSubtopics.map((text) => ({ text })),
          relatedQuestions: serp.relatedQuestions.map((text) => ({ text })),
          snapshot: snapshot.id,
          queryCluster,
          facets,
          gaps,
        },
        // Backfill, never overwrite: a piece created before any audience
        // existed gets one now, and one the editor already chose is left alone.
        ...(article.icp == null && icp?.id != null ? { icp: icp.id as number } : {}),
      },
    }
  },
}
