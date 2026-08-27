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

import { getOrBuildSnapshot } from './corpus/snapshot'
import { applyTemplateHints, buildQueryCluster, type Facet } from './informationGain/lib'
import { resolveTemplate, type Stage } from './stages'

/** `facets` is a JSON column on the snapshot, so trust nothing about its shape. */
const storedFacets = (value: unknown): Facet[] => (Array.isArray(value) ? (value as Facet[]) : [])

export const researchStage: Stage = {
  name: 'research',
  entryStatus: 'topic_selected',
  exitStatus: 'researched',
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
    return {
      status: 'researched',
      data: {
        research: {
          rankingPagesSummary: serp.rankingPagesSummary,
          commonSubtopics: serp.commonSubtopics.map((text) => ({ text })),
          relatedQuestions: serp.relatedQuestions.map((text) => ({ text })),
          snapshot: snapshot.id,
          queryCluster,
          facets,
          gaps: snapshot.gaps,
        },
      },
    }
  },
}
