import type { Payload } from 'payload'

import type { Article, CostLog, InformationGainRun } from '../../cms/src/payload-types'

export type ReportPeriod = 'week' | 'month'

interface ViolationLike {
  code: string
  [k: string]: unknown
}

function violationsOf(article: Article): ViolationLike[] {
  const raw = article.qaResults?.structural?.violations
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (v): v is ViolationLike => typeof v === 'object' && v !== null && typeof (v as ViolationLike).code === 'string',
  )
}

function templateNameOf(article: Article): string {
  if (article.template && typeof article.template === 'object') return article.template.name
  return '(no template)'
}

function articleIdOf(row: CostLog): number | null {
  if (typeof row.article === 'number') return row.article
  if (row.article && typeof row.article === 'object') return row.article.id
  return null
}

const usd = (n: number): string => `$${n.toFixed(4)}`

function rate(passed: number, total: number): string {
  if (total === 0) return 'n/a (0 checked)'
  return `${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`
}

class PassCounter {
  passed = 0
  total = 0
  add(didPass: boolean): void {
    this.total += 1
    if (didPass) this.passed += 1
  }
  toString(): string {
    return rate(this.passed, this.total)
  }
}

/** Decision order for the digest: worst first, so a reader sees the blocks. */
const IG_DECISIONS = ['BLOCK', 'HUMAN_REVIEW', 'REVISE', 'PASS'] as const

/** The mean of a nullable score across the scored articles, or `n/a` when none carry it. */
function meanOf(articles: Article[], pick: (a: Article) => number | null | undefined): string {
  const values = articles.map(pick).filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return 'n/a'
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)
}

interface ReasonLike {
  policy: string
  message: string
  severity: string
  claimId?: string
}

const MAX_REASONS = 3

/**
 * The reasons behind an article's decision, read from its linked run rather
 * than recomputed: thresholds move, and the run row is the record of the policy
 * that actually judged this draft. BLOCK first, then HUMAN_REVIEW, then the
 * rest — a reviewer wants the disqualifying reason, not the first one listed.
 */
async function topReasons(payload: Payload, article: Article): Promise<ReasonLike[]> {
  const runId =
    typeof article.informationGain?.run === 'number'
      ? article.informationGain.run
      : (article.informationGain?.run as InformationGainRun | null | undefined)?.id
  if (runId == null) return []
  const { docs } = await payload.find({
    collection: 'information-gain-runs',
    where: { id: { equals: runId } },
    limit: 1,
    depth: 0,
  })
  const raw = docs[0]?.reasons
  if (!Array.isArray(raw)) return []
  const reasons = raw.filter(
    (r): r is ReasonLike =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as ReasonLike).policy === 'string' &&
      typeof (r as ReasonLike).message === 'string',
  )
  const rank = (r: ReasonLike): number => {
    const index = IG_DECISIONS.indexOf(r.severity as (typeof IG_DECISIONS)[number])
    return index === -1 ? IG_DECISIONS.length : index
  }
  return [...reasons].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_REASONS)
}

export async function printReport(payload: Payload, period: ReportPeriod): Promise<void> {
  const periodDays = period === 'week' ? 7 : 30
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

  const { docs: articles } = await payload.find({
    collection: 'articles',
    pagination: false,
    depth: 1,
    sort: 'createdAt',
  })
  const { docs: allCostRows } = await payload.find({
    collection: 'cost-log',
    pagination: false,
    depth: 0,
  })
  const costRows = allCostRows.filter(
    (r) => r.createdAt >= periodStart.toISOString(),
  )

  const lines: string[] = []
  lines.push('PIPELINE REPORT')
  lines.push(`period: ${period} (cost-log since ${periodStart.toISOString().slice(0, 10)})`)
  lines.push(`articles: ${articles.length} total`)
  const byStatus = new Map<string, number>()
  for (const a of articles) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1)
  lines.push(
    '  ' + [...byStatus.entries()].map(([status, count]) => `${status}: ${count}`).join(', '),
  )

  // ---- QA pass rates ----
  const qaArticles = articles.filter((a) => a.qaResults?.structural?.passed != null)
  const structural = new PassCounter()
  const factCheck = new PassCounter()
  const qualitative = new PassCounter()
  const violationArticleCounts = new Map<string, number>()
  const perTemplate = new Map<
    string,
    { structural: PassCounter; factCheck: PassCounter; qualitative: PassCounter }
  >()
  for (const article of qaArticles) {
    const qa = article.qaResults
    const name = templateNameOf(article)
    let tpl = perTemplate.get(name)
    if (!tpl) {
      tpl = { structural: new PassCounter(), factCheck: new PassCounter(), qualitative: new PassCounter() }
      perTemplate.set(name, tpl)
    }
    structural.add(qa?.structural?.passed === true)
    tpl.structural.add(qa?.structural?.passed === true)
    if (qa?.factCheck?.passed != null) {
      factCheck.add(qa.factCheck.passed)
      tpl.factCheck.add(qa.factCheck.passed)
    }
    if (qa?.qualitativeReview?.passed != null) {
      qualitative.add(qa.qualitativeReview.passed)
      tpl.qualitative.add(qa.qualitativeReview.passed)
    }
    for (const code of new Set(violationsOf(article).map((v) => v.code))) {
      violationArticleCounts.set(code, (violationArticleCounts.get(code) ?? 0) + 1)
    }
  }

  lines.push('')
  lines.push(`== QA pass rates (${qaArticles.length} article(s) with QA results) ==`)
  lines.push(`structural: ${structural}`)
  if (violationArticleCounts.size > 0) {
    lines.push('  flagged by violation code (articles affected):')
    for (const [code, count] of [...violationArticleCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${code}: ${count}`)
    }
  }
  lines.push(`factCheck: ${factCheck}`)
  lines.push(`qualitativeReview: ${qualitative}`)
  lines.push('by template:')
  if (perTemplate.size === 0) lines.push('  (none)')
  for (const [name, tpl] of perTemplate) {
    lines.push(
      `  ${name}: structural ${tpl.structural}, factCheck ${tpl.factCheck}, qualitativeReview ${tpl.qualitative}`,
    )
  }

  // ---- Spend ----
  const totalSpend = costRows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
  const byStage = new Map<string, number>()
  const byModel = new Map<string, number>()
  for (const row of costRows) {
    byStage.set(row.stage ?? '(unknown)', (byStage.get(row.stage ?? '(unknown)') ?? 0) + (row.costUsd ?? 0))
    byModel.set(row.model ?? '(unknown)', (byModel.get(row.model ?? '(unknown)') ?? 0) + (row.costUsd ?? 0))
  }
  lines.push('')
  lines.push(`== Spend (${costRows.length} cost-log row(s) in period) ==`)
  lines.push(`total: ${usd(totalSpend)}`)
  lines.push('by stage:')
  for (const [stage, spend] of byStage) lines.push(`  ${stage}: ${usd(spend)}`)
  lines.push('by model:')
  for (const [model, spend] of byModel) lines.push(`  ${model}: ${usd(spend)}`)

  // ---- Published economics ----
  // Computed over all-time cost rows: dividing period-scoped spend by the
  // lifetime published count would understate cost per article.
  const published = articles.filter((a) => a.status === 'published')
  const publishedIds = new Set(published.map((a) => a.id))
  const allTimeSpend = allCostRows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
  const publishedSpend = allCostRows
    .filter((r) => {
      const id = articleIdOf(r)
      return id !== null && publishedIds.has(id)
    })
    .reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
  lines.push('')
  lines.push('== Published (all-time) ==')
  lines.push(`published articles: ${published.length}, spend on them: ${usd(publishedSpend)}`)
  lines.push(
    `cost per published article: ${published.length > 0 ? usd(publishedSpend / published.length) : 'n/a'}`,
  )
  const waste = allTimeSpend - publishedSpend
  lines.push(
    `waste (spend on unpublished articles): ${usd(waste)}${
      allTimeSpend > 0 ? ` (${((waste / allTimeSpend) * 100).toFixed(1)}% of all-time spend)` : ''
    }`,
  )

  // ---- Information gain ----
  // Every number under here is an uncalibrated LLM estimate rolled up; it is a
  // digest of how the gate is behaving, not a measurement of content quality.
  const scored = articles.filter((a) => a.informationGain?.decision != null)
  lines.push('')
  lines.push(`== Information gain (${scored.length} article(s) scored) ==`)
  if (scored.length === 0) {
    lines.push('(none)')
  } else {
    const byDecision = new Map<string, number>()
    for (const article of scored) {
      const decision = article.informationGain?.decision as string
      byDecision.set(decision, (byDecision.get(decision) ?? 0) + 1)
    }
    lines.push(
      'decisions: ' +
        IG_DECISIONS.filter((d) => byDecision.has(d))
          .map((d) => `${d}: ${byDecision.get(d)}`)
          .join(', '),
    )
    lines.push(`mean consensus coverage: ${meanOf(scored, (a) => a.informationGain?.consensusCoverage)}`)
    lines.push(`mean verification ratio: ${meanOf(scored, (a) => a.informationGain?.verificationRatio)}`)

    const queue = scored.filter(
      (a) =>
        a.informationGain?.decision === 'HUMAN_REVIEW' || a.informationGain?.decision === 'BLOCK',
    )
    lines.push('')
    lines.push(`-- Review queue (${queue.length} article(s) at needs_review/blocked) --`)
    if (queue.length === 0) lines.push('(none)')
    for (const article of queue) {
      lines.push(
        `article ${article.id} "${article.title ?? article.keyword}" [${templateNameOf(article)}] ` +
          `${article.informationGain?.decision} (status ${article.status})`,
      )
      const reasons = await topReasons(payload, article)
      if (reasons.length === 0) lines.push('  (linked run has no recorded reasons)')
      for (const reason of reasons) {
        // The claim id is what separates two otherwise identical reasons, so it
        // goes in the line rather than only in the stored run.
        const claim = typeof reason.claimId === 'string' ? ` [${reason.claimId}]` : ''
        lines.push(`  ${reason.severity} ${reason.policy}${claim}: ${reason.message}`)
      }
    }
  }

  // ---- Failure digest ----
  const needsRevision = articles.filter((a) => a.status === 'needs_revision')
  lines.push('')
  lines.push(`== Failure digest (${needsRevision.length} article(s) at needs_revision) ==`)
  const failureCodes = new Map<string, number>()
  for (const article of needsRevision) {
    for (const violation of violationsOf(article)) {
      failureCodes.set(violation.code, (failureCodes.get(violation.code) ?? 0) + 1)
    }
  }
  if (failureCodes.size > 0) {
    lines.push('violation occurrences:')
    for (const [code, count] of [...failureCodes.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${code}: ${count}`)
    }
  }
  for (const article of needsRevision) {
    lines.push(`article ${article.id} "${article.title ?? article.keyword}" [${templateNameOf(article)}]`)
    const qa = article.qaResults
    if (qa?.factCheck?.notes) {
      lines.push(`  factCheck (${qa.factCheck.passed ? 'passed' : 'failed'}): ${qa.factCheck.notes}`)
    }
    if (qa?.qualitativeReview?.notes) {
      lines.push(
        `  qualitativeReview (${qa.qualitativeReview.passed ? 'passed' : 'failed'}): ${qa.qualitativeReview.notes}`,
      )
    }
  }
  if (needsRevision.length === 0) lines.push('(none)')

  console.log(lines.join('\n'))
}
