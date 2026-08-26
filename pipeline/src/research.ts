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
import { buildQueryCluster } from './informationGain/lib'
import { resolveTemplate, type Stage } from './stages'

export const researchStage: Stage = {
  name: 'research',
  entryStatus: 'topic_selected',
  exitStatus: 'researched',
  async run(article, ctx) {
    // runPipeline queries with depth: 1, so the template relationship is populated.
    const template = resolveTemplate(article)
    const serp = await ctx.ahrefs.serpResearch(article.keyword)
    const queryCluster = buildQueryCluster(article.keyword, serp.relatedQuestions)
    const snapshot = await getOrBuildSnapshot(ctx, article, template, serp, queryCluster)
    return {
      status: 'researched',
      data: {
        research: {
          rankingPagesSummary: serp.rankingPagesSummary,
          commonSubtopics: serp.commonSubtopics.map((text) => ({ text })),
          relatedQuestions: serp.relatedQuestions.map((text) => ({ text })),
          snapshot: snapshot.id,
          queryCluster,
          facets: snapshot.facets,
          gaps: snapshot.gaps,
        },
      },
    }
  },
}
