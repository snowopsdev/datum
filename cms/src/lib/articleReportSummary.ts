import { ARTICLE_STATUSES } from './articleStatusMeta'
import type { BoardArticle } from '../components/ops/articleStatus'

export type ReportArticle = Pick<
  BoardArticle,
  | 'id'
  | 'title'
  | 'keyword'
  | 'status'
  | 'templateName'
  | 'totalCostUsd'
  | 'qaResults'
  | 'informationGain'
>

function failureDetails(a: ReportArticle): { fails: string[]; details: string[] } {
  const fails: string[] = []
  const details: string[] = []
  const qa = a.qaResults
  if (qa?.structural?.passed === false) {
    fails.push('structural')
    const raw = qa.structural.violations
    if (Array.isArray(raw)) {
      for (const v of raw) {
        if (typeof v === 'string') details.push(v)
        else if (v && typeof v === 'object' && 'code' in v) {
          details.push(String((v as { code: unknown }).code))
        }
      }
    }
  }
  if (qa?.factCheck?.passed === false) {
    fails.push('factCheck')
    if (qa.factCheck.notes) details.push(qa.factCheck.notes)
  }
  if (qa?.qualitativeReview?.passed === false) {
    fails.push('qualitative')
    if (qa.qualitativeReview.notes) details.push(qa.qualitativeReview.notes)
  }
  return { fails, details }
}

type IgDecision = 'PASS' | 'REVISE' | 'HUMAN_REVIEW' | 'BLOCK'

export const IG_DECISIONS: IgDecision[] = ['PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK']

export const IG_DECISION_LABEL: Record<IgDecision, string> = {
  PASS: 'Pass',
  REVISE: 'Revise',
  HUMAN_REVIEW: 'Human review',
  BLOCK: 'Block',
}

/**
 * Rolls the articles' denormalised `informationGain` summaries up into the
 * decision mix. Deliberately reads only the summary group and never mixes it
 * with `status`: an article whose summary was cleared (reset, sent back,
 * queued for regeneration) has no decision at all, and counting its status as
 * one would report a verdict nobody scored. The review queue is the reverse —
 * it is a *status* question ("who is waiting on a human"), so it comes from
 * `status` alone.
 */
function informationGainMix(articles: ReportArticle[]) {
  const counts = Object.fromEntries(IG_DECISIONS.map((d) => [d, 0])) as Record<IgDecision, number>
  let scored = 0
  for (const a of articles) {
    const decision = a.informationGain?.decision
    if (decision && IG_DECISIONS.includes(decision)) {
      counts[decision] += 1
      scored += 1
    }
  }
  return { counts, scored }
}

export function summarizeReportArticles(articles: ReportArticle[]) {
  const byStatus = Object.fromEntries(ARTICLE_STATUSES.map((s) => [s, 0])) as Record<string, number>
  for (const a of articles) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1

  const withQa = articles.filter((a) => a.qaResults?.structural?.passed != null)
  const rate = (key: 'structural' | 'factCheck' | 'qualitativeReview') => {
    const rows = articles.filter((a) => {
      const block = a.qaResults?.[key]
      return block && typeof block === 'object' && 'passed' in block && block.passed != null
    })
    const passed = rows.filter((a) => a.qaResults?.[key]?.passed === true).length
    return { t: rows.length, p: passed }
  }
  const st = rate('structural')
  const fc = rate('factCheck')
  const qu = rate('qualitativeReview')
  const failures = articles.filter((a) => a.status === 'needs_revision')
  const ig = informationGainMix(articles)
  const igReviewQueue = articles.filter(
    (a) => a.status === 'needs_review' || a.status === 'blocked',
  )
  const igAwaitingScore = articles.filter((a) => a.status === 'qa_passed')
  const published = articles.filter((a) => a.status === 'published')
  const publishedSpend = published.reduce((s, a) => s + (a.totalCostUsd ?? 0), 0)
  const allSpend = articles.reduce((s, a) => s + (a.totalCostUsd ?? 0), 0)
  const waste = Math.max(0, allSpend - publishedSpend)

  return {
    articleCount: articles.length,
    byStatus,
    withQaCount: withQa.length,
    st,
    fc,
    qu,
    failures: failures.map((a) => ({
      id: a.id,
      title: a.title,
      keyword: a.keyword,
      templateName: a.templateName,
      totalCostUsd: a.totalCostUsd,
      ...failureDetails(a),
    })),
    ig,
    igReviewQueue: igReviewQueue.map((a) => ({
      id: a.id,
      title: a.title,
      keyword: a.keyword,
      status: a.status,
      informationGain: a.informationGain?.decision
        ? { decision: a.informationGain.decision }
        : null,
    })),
    igAwaitingScoreCount: igAwaitingScore.length,
    publishedCount: published.length,
    publishedSpend,
    waste,
  }
}
export type ArticleReportSummary = ReturnType<typeof summarizeReportArticles>
