import { ARTICLE_STATUSES } from './articleStatusMeta'
import {
  CHECK_LABEL,
  qaFailures,
  type BoardArticle,
  type QaFailure,
} from '../components/ops/articleStatus'

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
> & {
  /** Archived pieces are out of the waiting and queue lists; their spend still counts. */
  archived?: boolean | null
}

/** `QaFailure.check` is the QA-result field name; `CHECK_LABEL` is keyed by the rollup's names. */
const CHECK_OF: Record<QaFailure['check'], keyof typeof CHECK_LABEL> = {
  structural: 'structural',
  factCheck: 'factCheck',
  qualitativeReview: 'qualitative',
  evidenceCheck: 'evidence',
}
const CHECK_ORDER: (keyof typeof CHECK_LABEL)[] = ['structural', 'factCheck', 'qualitative', 'evidence']

/**
 * Which checks failed, and what each said, in the words the review page uses.
 *
 * Failures come from `qaFailures` so a violation reads as its description, not
 * `HEADING_STRUCTURE`, and the check names come from `CHECK_LABEL`. A check the
 * model marked failed without writing anything down has no `qaFailures` entry
 * but is still named, so the card never says "no check named" for a failure.
 */
function failureDetails(a: ReportArticle): { fails: string[]; details: string[] } {
  const qa = a.qaResults
  const described = qaFailures(a)
  const failed = new Set<keyof typeof CHECK_LABEL>()
  for (const f of described) failed.add(CHECK_OF[f.check])
  if (qa?.structural?.passed === false) failed.add('structural')
  if (qa?.factCheck?.passed === false) failed.add('factCheck')
  if (qa?.qualitativeReview?.passed === false) failed.add('qualitative')
  if (qa?.evidenceCheck?.passed === false) failed.add('evidence')
  return {
    fails: CHECK_ORDER.filter((check) => failed.has(check)).map((check) => CHECK_LABEL[check]),
    details: described.map((f) => f.what),
  }
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
  const rate = (key: 'structural' | 'factCheck' | 'qualitativeReview' | 'evidenceCheck') => {
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
  const ev = rate('evidenceCheck')
  // Archived pieces are set aside: nobody is waiting on them, so they are not
  // work to do. They stay in every count and sum below.
  const live = articles.filter((a) => a.archived !== true)
  const failures = live.filter((a) => a.status === 'needs_revision')
  const ig = informationGainMix(articles)
  const igReviewQueue = live.filter(
    (a) => a.status === 'needs_review' || a.status === 'blocked',
  )
  const igAwaitingScore = live.filter((a) => a.status === 'qa_passed')
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
    ev,
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
