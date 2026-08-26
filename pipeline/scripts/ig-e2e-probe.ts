/**
 * Database side of the information-gain E2E walkthrough (`ig-e2e.sh`).
 *
 * The shell script owns the flow and the assertions; this file owns everything
 * that needs Payload. It prints `key=value` lines so the script can read them
 * with `grep`/`sed` and needs no `jq`.
 *
 * Usage:
 *   tsx scripts/ig-e2e-probe.ts reset <keyword>       ensure a templateless topic_selected article
 *   tsx scripts/ig-e2e-probe.ts state <articleId>     the article's status, decision, run and cost rows
 *   tsx scripts/ig-e2e-probe.ts candidates <domain…>  each domain's review-queue row, or `none`
 */
import { initPayload } from '../src/payloadClient'

/**
 * Cleared on reset so a re-run scores a fresh draft rather than reusing the
 * last one. The `group` fields (`research`, `qaResults`, `informationGain`) are
 * spelled out key by key: Payload's beforeValidate walks a group's subfields, so
 * passing `null` for the group itself throws before the update is attempted.
 */
const CLEARED = {
  template: null,
  title: null,
  body: null,
  research: {
    rankingPagesSummary: null,
    commonSubtopics: [],
    relatedQuestions: [],
    snapshot: null,
    queryCluster: null,
    facets: null,
    gaps: null,
  },
  qaResults: {
    structural: { passed: null, violations: null },
    factCheck: { passed: null, notes: null, sources: null },
    qualitativeReview: {
      passed: null,
      notes: null,
      voiceScore: null,
      voiceNotes: null,
      notTraitViolations: null,
    },
  },
  qaModels: null,
  generationModel: null,
  revisionNotes: null,
  reviewNotes: null,
  reviewJustification: null,
  informationGain: {
    run: null,
    decision: null,
    policyVersion: null,
    consensusCoverage: null,
    verifiedGainUnits: null,
    verificationRatio: null,
    internalDuplicationRate: null,
    verifiedNovelClaims: null,
    scoredAt: null,
  },
}

const [command, ...rest] = process.argv.slice(2)
const payload = await initPayload()

if (command === 'reset') {
  // The walkthrough owns one dedicated keyword so it is repeatable against a
  // database that has already been walked through: `pipeline:fetch` skips a
  // keyword that already has an article, and the four mock content-gap
  // keywords are consumed by the first run.
  const keyword = rest.join(' ').trim()
  if (!keyword) {
    console.error('Usage: tsx scripts/ig-e2e-probe.ts reset <keyword>')
    process.exit(1)
  }
  const { docs } = await payload.find({
    collection: 'articles',
    where: { keyword: { equals: keyword } },
    limit: 1,
    depth: 0,
  })
  const existing = docs[0]
  if (existing) {
    // `overrideAccess` defaults to true on the Local API, which is what lets
    // this clear the `informationGain` group (`access.update: () => false`).
    // The beforeChange gates still run; `topic_selected` is an ungated target.
    await payload.update({
      collection: 'articles',
      id: existing.id,
      data: { ...CLEARED, status: 'topic_selected' },
    })
    console.log(`articleId=${existing.id}`)
    console.log('reused=true')
  } else {
    const created = await payload.create({
      collection: 'articles',
      data: { keyword, status: 'topic_selected' },
    })
    console.log(`articleId=${created.id}`)
    console.log('reused=false')
  }
  process.exit(0)
}

if (command === 'state') {
  const articleId = Number.parseInt(rest[0] ?? '', 10)
  if (Number.isNaN(articleId)) {
    console.error('Usage: tsx scripts/ig-e2e-probe.ts state <articleId>')
    process.exit(1)
  }
  const article = await payload.findByID({ collection: 'articles', id: articleId, depth: 0 })
  const gain = article.informationGain
  console.log(`status=${article.status}`)
  console.log(`decision=${gain?.decision ?? 'none'}`)
  console.log(`policyVersion=${gain?.policyVersion ?? 'none'}`)
  console.log(`consensusCoverage=${gain?.consensusCoverage ?? 'none'}`)
  console.log(`verificationRatio=${gain?.verificationRatio ?? 'none'}`)
  console.log(`verifiedNovelClaims=${gain?.verifiedNovelClaims ?? 'none'}`)
  console.log(`summaryRunId=${typeof gain?.run === 'number' ? gain.run : 'none'}`)
  console.log(`snapshotId=${typeof article.research?.snapshot === 'number' ? article.research.snapshot : 'none'}`)

  const runs = await payload.find({
    collection: 'information-gain-runs',
    where: { article: { equals: articleId } },
    sort: '-createdAt',
    pagination: false,
    depth: 0,
  })
  console.log(`runRows=${runs.docs.length}`)
  const latest = runs.docs[0]
  console.log(`latestRunId=${latest?.id ?? 'none'}`)
  console.log(`latestRunDecision=${latest?.decision ?? 'none'}`)
  console.log(`latestRunCalibrated=${latest?.calibrated ?? 'none'}`)
  console.log(`latestRunBaselineAvailable=${latest?.baselineAvailable ?? 'none'}`)
  console.log(`latestRunClaims=${Array.isArray(latest?.claims) ? latest.claims.length : 'none'}`)
  console.log(`latestRunCostUsd=${latest?.costUsd ?? 'none'}`)

  const costs = await payload.find({
    collection: 'cost-log',
    where: { article: { equals: articleId } },
    pagination: false,
    depth: 0,
  })
  const byStage = new Map<string, number>()
  for (const row of costs.docs) {
    const stage = row.stage ?? 'unknown'
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1)
  }
  for (const stage of [...byStage.keys()].sort()) {
    console.log(`costRows.${stage}=${byStage.get(stage)}`)
  }
  console.log(`totalCostUsd=${article.totalCostUsd ?? 'none'}`)
  process.exit(0)
}

if (command === 'candidates') {
  // One line per domain named on the command line, so the script can assert on
  // domains that should be queued *and* on ones that should not be — a seeded
  // evidence-sources domain must never become a candidate.
  const wanted = rest.length > 0 ? rest : []
  const { docs } = await payload.find({
    collection: 'evidence-source-candidates',
    pagination: false,
    depth: 0,
  })
  const byDomain = new Map(docs.map((doc) => [doc.domain, doc]))
  for (const domain of wanted) {
    const row = byDomain.get(domain)
    if (!row) {
      console.log(`candidate.${domain}=none`)
      continue
    }
    const kinds = Array.isArray(row.sightings)
      ? [...new Set(row.sightings.map((s) => (s as { kind?: string })?.kind ?? '?'))].sort().join('+')
      : 'none'
    console.log(`candidate.${domain}=${row.status}:${kinds}:${row.suggestedClass}`)
    console.log(`candidateSerpCount.${domain}=${row.serpCount ?? 0}`)
    console.log(`candidateCitationCount.${domain}=${row.citationCount ?? 0}`)
  }
  console.log(`candidates.total=${docs.length}`)
  console.log(`candidates.pending=${docs.filter((doc) => doc.status === 'pending').length}`)
  process.exit(0)
}

console.error(`Unknown command "${command ?? ''}". Expected "reset", "state" or "candidates".`)
process.exit(1)
