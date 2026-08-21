import type { Stage } from './stages'

export const researchStage: Stage = {
  name: 'research',
  entryStatus: 'topic_selected',
  exitStatus: 'researched',
  async run(article, ctx) {
    const research = await ctx.ahrefs.serpResearch(article.keyword)
    return {
      status: 'researched',
      data: {
        research: {
          rankingPagesSummary: research.rankingPagesSummary,
          commonSubtopics: research.commonSubtopics.map((text) => ({ text })),
          relatedQuestions: research.relatedQuestions.map((text) => ({ text })),
        },
      },
    }
  },
}
