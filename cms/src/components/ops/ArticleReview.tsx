'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { FACET_GAIN_THRESHOLD } from '../../lib/informationGain/scoring'
import {
  approveArticleAction,
  assignTemplateAction,
  overrideReviewAction,
  publishArticleAction,
  regenerateArticleAction,
  resetToDraftedAction,
  sendBackAction,
} from './actions'
import { BriefEditor } from './BriefEditor'
import { revisitBriefAction } from './briefActions'
import { runSelectedArticlesAction } from './boardActions'
import { Stepper } from './Stepper'
import {
  OWNER_LABEL,
  qaFailures,
  STAGE_LABEL,
  stageOf,
  type AuditTimelineEntry,
  type BoardArticle,
  type InformationGainRunView,
  type ScorecardClaim,
  type TemplateOption,
} from './articleStatus'
import './ops.css'

type Props = {
  article: BoardArticle
  mode: 'mock' | 'live'
  templates: TemplateOption[]
  editHref: string
  bodyHtml: string
  auditEntries: AuditTimelineEntry[]
  run: InformationGainRunView | null
}

const DECISION_LABEL: Record<InformationGainRunView['decision'], string> = {
  PASS: 'Pass',
  REVISE: 'Revise',
  HUMAN_REVIEW: 'Human review',
  BLOCK: 'Block',
}

/** How a source's quality score was arrived at — see `Evidence.qualitySource`. */
const QUALITY_SOURCE_LABEL: Record<string, string> = {
  'evidence-sources': 'evidence-sources table',
  rubric: 'rubric',
  rubric_capped: 'rubric (capped)',
}

/** The stored brief, in the shape the editor edits. Rows without a heading are dropped. */
function briefInitial(raw: BoardArticle['brief']) {
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
  return {
    angle: raw?.angle ?? '',
    audience: raw?.audience ?? '',
    sections: (raw?.sections ?? []).flatMap((s) =>
      s?.heading
        ? [
            {
              heading: s.heading,
              notes: s.notes ?? '',
              source: (s.source ?? 'editor') as 'template' | 'research' | 'editor',
            },
          ]
        : [],
    ),
    mustCover: strings(raw?.mustCover),
    opportunities: strings(raw?.opportunities),
    notes: raw?.notes ?? '',
  }
}

function pct(value: number | null): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function dec(value: number | null, digits = 2): string {
  return value == null ? '—' : value.toFixed(digits)
}

function CheckRow({ label, passed }: { label: string; passed: boolean | null | undefined }) {
  const ok = passed === true
  return (
    <div className="datum-ops__check">
      <span className={`datum-ops__mark datum-ops__mark--${ok ? 'pass' : 'fail'}`}>
        {ok ? 'PASS' : 'FAIL'}
      </span>
      <span>{label}</span>
    </div>
  )
}

/**
 * One headline number. `gated` marks the metrics a policy threshold actually
 * judged this run against, so a reviewer can see at a glance which figure
 * produced the decision and which is context — `consensusCoverage` and
 * `facetGainCoverage` in particular are both "coverage" but measure different
 * things and only the first is gated.
 */
function IgMetric({
  label,
  value,
  hint,
  gated,
}: {
  label: string
  value: string
  hint: string
  gated?: boolean
}) {
  return (
    <div className={`datum-ops__ig-metric${gated ? ' datum-ops__ig-metric--gated' : ''}`}>
      <div className="datum-ops__ig-metric-label">
        <span>{label}</span>
        <span className={`datum-ops__ig-gate${gated ? ' datum-ops__ig-gate--on' : ''}`}>
          {gated ? 'gated' : 'not gated'}
        </span>
      </div>
      <div className="datum-ops__ig-metric-value">{value}</div>
      <p className="datum-ops__ig-metric-hint">{hint}</p>
    </div>
  )
}

/**
 * The reasons a decision landed where it did. Reason messages are written from
 * the threshold that tripped and do **not** name their claim — two claims
 * failing the same gate produce byte-identical strings — so each row carries
 * its own claim excerpt (or, failing that, the claim id) and links to that
 * claim's row in the table below.
 */
function IgReasons({
  reasons,
  claimById,
}: {
  reasons: InformationGainRunView['reasons']
  claimById: Map<string, ScorecardClaim>
}) {
  if (reasons.length === 0) {
    return (
      <p className="datum-ops__sub" style={{ margin: 0 }}>
        No policy reasons — nothing tripped a gate.
      </p>
    )
  }
  return (
    <ul className="datum-ops__ig-reasons">
      {reasons.map((reason, index) => {
        const claim = reason.claimId ? claimById.get(reason.claimId) : undefined
        return (
          <li key={`${reason.policy}-${reason.claimId ?? 'doc'}-${index}`}>
            <div className="datum-ops__ig-reason-head">
              <span
                className={`datum-ops__ig-sev datum-ops__ig-sev--${reason.severity}`}
                title={`Severity ${reason.severity}`}
              >
                {reason.severity.replace(/_/g, ' ')}
              </span>
              <code className="datum-ops__ig-code">{reason.policy}</code>
              <span>{reason.message}</span>
            </div>
            {reason.claimId ? (
              <div className="datum-ops__ig-reason-claim">
                <a href={`#ig-claim-${encodeURIComponent(reason.claimId)}`}>{reason.claimId}</a>
                <span>{claim?.excerpt || claim?.text || '(claim not in this run)'}</span>
              </div>
            ) : (
              <div className="datum-ops__ig-reason-claim">
                <span>Document-level — not tied to one claim.</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ClaimFlags({ claim }: { claim: ScorecardClaim }) {
  const flags: { key: string; label: string; tone: string }[] = []
  if (claim.blocked) flags.push({ key: 'blocked', label: 'blocked', tone: 'bad' })
  if (claim.requiresHumanReview) flags.push({ key: 'review', label: 'review', tone: 'warn' })
  if (claim.materiallyNovel) flags.push({ key: 'novel', label: 'novel', tone: 'info' })
  if (claim.verifiedNovel) flags.push({ key: 'verified', label: 'verified', tone: 'good' })
  if (flags.length === 0) {
    return <span className="datum-ops__ig-flag datum-ops__ig-flag--none">—</span>
  }
  return (
    <span className="datum-ops__ig-flags">
      {flags.map((f) => (
        <span key={f.key} className={`datum-ops__ig-flag datum-ops__ig-flag--${f.tone}`}>
          {f.label}
        </span>
      ))}
    </span>
  )
}

function ClaimEvidence({ claim }: { claim: ScorecardClaim }) {
  if (claim.evidence.length === 0) {
    return (
      <span className="datum-ops__sub" style={{ margin: 0 }}>
        none
      </span>
    )
  }
  return (
    <ul className="datum-ops__ig-evidence">
      {claim.evidence.map((e, index) => (
        <li key={`${claim.id}-ev-${index}`}>
          {/* `href` is null unless the model-authored URL was http/https — see
              `ScorecardEvidence.href`; anything else renders as bare text. */}
          {e.href ? (
            <a href={e.href} rel="noreferrer noopener" target="_blank">
              {e.domain}
            </a>
          ) : (
            <span title="No usable http(s) URL on this evidence">{e.domain}</span>
          )}
          <span className="datum-ops__ig-evidence-meta">
            {e.sourceKind} · q {dec(e.qualityScore)} ·{' '}
            {e.qualitySource
              ? (QUALITY_SOURCE_LABEL[e.qualitySource] ?? e.qualitySource)
              : 'source unknown'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The full scorecard for one run. Everything here is read from the
 * `information-gain-runs` row itself; `isCurrent` says whether the article's
 * own `informationGain` summary still points at this run, because a reviewer
 * reading a decision assembled from two different scoring passes is exactly
 * the failure this banner exists to prevent.
 */
function ScorecardSection({
  run,
  isCurrent,
  summaryRunId,
}: {
  run: InformationGainRunView
  isCurrent: boolean
  summaryRunId: number | null
}) {
  const claimById = new Map(run.claims.map((c) => [c.id, c]))
  return (
    <section className="datum-ops__ig" aria-labelledby="ig-scorecard-heading">
      <div className="datum-ops__ig-head">
        <div>
          <h2 id="ig-scorecard-heading">Information gain</h2>
          <p className="datum-ops__sub" style={{ margin: 0 }}>
            run #{run.id} · policy <code>{run.policyVersion}</code> · scored {run.createdAtLabel}
            {run.baselineAvailable ? '' : ' · no baseline corpus was available'}
          </p>
        </div>
        <div className="datum-ops__ig-head-marks">
          <span className={`datum-ops__ig-decision datum-ops__ig-decision--${run.decision}`}>
            {DECISION_LABEL[run.decision]}
          </span>
          {run.calibrated ? null : (
            <span
              className="datum-ops__ig-uncal"
              title="No calibration pass exists yet: these are the scoring model's own estimates, not measurements."
            >
              uncalibrated
            </span>
          )}
        </div>
      </div>

      {isCurrent ? null : (
        <p className="datum-ops__warn">
          {summaryRunId == null
            ? 'This scorecard is from an earlier scoring pass. The article carries no current information-gain decision — it was reset, sent back, or queued for regeneration since — so nothing below reflects the draft as it stands now.'
            : `The article's summary points at run #${summaryRunId}, but this is the latest scorecard (run #${run.id}). Treat the two as separate scoring passes rather than one decision.`}
        </p>
      )}

      <div className="datum-ops__ig-metrics">
        <IgMetric
          label="Consensus coverage"
          value={pct(run.scores.consensusCoverage)}
          hint="Weighted share of consensus facets the draft addresses at all. This is the coverage the decision was gated on."
          gated
        />
        <IgMetric
          label="Verification ratio"
          value={dec(run.scores.verificationRatio)}
          hint="Verified gain units as a share of potential gain units."
          gated
        />
        <IgMetric
          label="Verified gain units"
          value={dec(run.scores.verifiedGainUnits)}
          hint={`Of ${dec(run.scores.potentialGainUnits)} potential — the gain that survived evidence integrity. The units themselves are not gated; the *count* of verified novel claims below is.`}
        />
        <IgMetric
          label="Verified gain density"
          value={dec(run.scores.verifiedGainDensity, 3)}
          hint="Verified gain units per 1,000 draft tokens."
        />
        <IgMetric
          label="Facet gain coverage"
          value={pct(run.scores.facetGainCoverage)}
          hint={`A different measure from consensus coverage: the share of facets where some single claim delivers at least ${FACET_GAIN_THRESHOLD} verified gain. A draft can address every facet (coverage 100%) while adding little to most of them.`}
        />
        <IgMetric
          label="Internal duplication"
          value={pct(run.scores.internalDuplicationRate)}
          hint="Share of draft claims likely already published on our own site. Gated: at or above the policy maximum this alone sends the draft to review."
          gated
        />
      </div>

      <p className="datum-ops__ig-note">
        Every 0–1 signal on this page — coverage, novelty, evidence integrity, source quality — is
        an <strong>uncalibrated estimate produced by the scoring model</strong>. No calibration pass
        exists yet, so read 0.96 as “the model was confident”, not as a measured 96%.
      </p>

      <div className="datum-ops__ig-summary">
        <span>{run.claimSummary.totalClaims ?? 0} claims</span>
        <span>{run.claimSummary.materiallyNovelClaims ?? 0} materially novel</span>
        <span
          className="datum-ops__ig-summary-gated"
          title="Gated: the policy sets a minimum number of verified materially-novel claims."
        >
          {run.claimSummary.verifiedNovelClaims ?? 0} verified novel · gated
        </span>
        <span>{run.claimSummary.unsupportedNovelClaims ?? 0} unsupported novel</span>
        <span>{run.claimSummary.contradictoryClaims ?? 0} contradictory</span>
        <span>{run.claimSummary.firstPartyClaims ?? 0} first-party</span>
      </div>

      <h3 className="datum-ops__ig-subhead">Why this decision</h3>
      <IgReasons claimById={claimById} reasons={run.reasons} />

      <h3 className="datum-ops__ig-subhead">Claims</h3>
      {run.claimsTruncated ? (
        <p className="datum-ops__warn">
          Showing {run.claims.length} of {run.claimCount} claims. Claims a policy reason cites are
          always shown, then blocked and review-flagged claims, then materially novel ones. Open the
          run in admin to read the rest.
        </p>
      ) : null}
      {run.claims.length === 0 ? (
        <p className="datum-ops__sub" style={{ margin: 0 }}>
          This run recorded no claims.
        </p>
      ) : (
        <div className="datum-ops__ig-table-wrap">
          <table className="datum-ops__ig-table">
            <thead>
              <tr>
                <th scope="col">Claim</th>
                <th scope="col">Type</th>
                <th scope="col" title="novelty · relevance · utility · intra-document novelty">
                  N·R·U·H
                </th>
                <th scope="col">Evidence integrity</th>
                <th scope="col">Evidence</th>
                <th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {run.claims.map((claim) => (
                <tr id={`ig-claim-${claim.id}`} key={claim.id}>
                  <td>
                    <div className="datum-ops__ig-claim-text">{claim.excerpt || claim.text}</div>
                    <div className="datum-ops__ig-claim-meta">
                      <code>{claim.id}</code>
                      <span>{claim.section ?? 'no section'}</span>
                    </div>
                  </td>
                  <td>
                    <div>{claim.kind.replace(/_/g, ' ')}</div>
                    <div className="datum-ops__ig-claim-meta">
                      <span>{claim.verificationMode.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                  <td>
                    <div className="datum-ops__ig-nruh">
                      {dec(claim.novelty)} · {dec(claim.relevance)} · {dec(claim.utility)} ·{' '}
                      {dec(claim.intraDocumentNovelty)}
                    </div>
                    <div className="datum-ops__ig-claim-meta">
                      <span>
                        gain {dec(claim.verifiedGain, 3)} of {dec(claim.potentialGain, 3)}
                      </span>
                    </div>
                  </td>
                  <td>{dec(claim.evidenceIntegrity)}</td>
                  <td>
                    <ClaimEvidence claim={claim} />
                  </td>
                  <td>
                    <ClaimFlags claim={claim} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function ArticleReview({
  article,
  mode,
  templates,
  editHref,
  bodyHtml,
  auditEntries,
  run,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState(
    article.templateId != null ? String(article.templateId) : '',
  )
  const [confirmLiveCost, setConfirmLiveCost] = useState(false)
  const [notes, setNotes] = useState(article.reviewNotes ?? '')
  /**
   * Deliberately *not* seeded from the article's persisted
   * `reviewJustification`: `gateReviewOverride` requires the submitted
   * justification to differ from the stored one, so a pre-filled box would
   * either silently re-satisfy the gate or hand the reviewer a value that is
   * guaranteed to be refused. The reviewer types a fresh one, every time.
   */
  const [justification, setJustification] = useState('')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const runAction = (fn: () => Promise<void>, thenBoard = true) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        if (thenBoard) router.push('/admin/ops/content')
        else router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      }
    })
  }

  const qa = article.qaResults
  const failures = qaFailures(article)
  const summaryRun = article.informationGain?.run
  const summaryRunId = typeof summaryRun === 'number' ? summaryRun : (summaryRun?.id ?? null)
  const runIsCurrent = run != null && summaryRunId === run.id
  const revisionCount = article.revisionCount ?? 0

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <Link className="datum-ops__btn" href="/admin/ops/content" prefetch={false}>
          ← Content
        </Link>
        <div className="datum-ops__stage-header">
          <Stepper current={stageOf(article.status)} size="full" />
          <span className={`datum-content__owner datum-content__owner--${stageOf(article.status).owner}`}>
            {OWNER_LABEL[stageOf(article.status).owner]} · {STAGE_LABEL[stageOf(article.status).stage]}:{' '}
            {stageOf(article.status).label}
          </span>
        </div>
      </div>

      <div className="datum-ops__review">
        <div className="datum-ops__review-main">
          <h1>{article.title || article.keyword}</h1>
          <p className="datum-ops__sub">
            {article.keyword}
            {article.templateName ? ` · ${article.templateName}` : ''}
            {article.totalCostUsd != null ? ` · $${article.totalCostUsd.toFixed(2)}` : ''}
          </p>
          {article.status === 'brief_review' ? (
            <BriefEditor
              articleId={article.id}
              initial={briefInitial(article.brief)}
              keyword={article.keyword}
              mode={mode}
              templateName={article.templateName}
            />
          ) : null}
          <div className="datum-ops__prose" hidden={article.status === 'brief_review'}>
            <h3>Article body</h3>
            {bodyHtml ? (
              <div className="datum-ops__body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : (
              <p>
                {article.metaDescription ||
                  article.researchHint ||
                  (article.status === 'topic_selected'
                    ? 'Nothing written yet. Research runs first, then you approve a brief.'
                    : 'No body yet.')}
              </p>
            )}
          </div>
          {(article.metaDescription || article.researchHint) && bodyHtml ? (
            <div className="datum-ops__prose" style={{ marginTop: 12 }}>
              <h3>SEO / research</h3>
              {article.metaDescription ? <p>{article.metaDescription}</p> : null}
              {article.researchHint && article.researchHint !== article.metaDescription ? (
                <p>{article.researchHint}</p>
              ) : null}
            </div>
          ) : null}

          {run ? (
            <ScorecardSection isCurrent={runIsCurrent} run={run} summaryRunId={summaryRunId} />
          ) : null}

          <section className="datum-ops__audit" aria-labelledby="audit-trail-heading">
            <div className="datum-ops__audit-head">
              <div>
                <h2 id="audit-trail-heading">Audit trail</h2>
                <p>
                  Append-only article changes, pipeline stages, model calls, and review decisions.
                </p>
              </div>
              <span>{auditEntries.length} events</span>
            </div>
            {auditEntries.length === 0 ? (
              <p className="datum-ops__empty">
                No audit events yet. Existing articles begin tracking on their next change.
              </p>
            ) : (
              <ol className="datum-ops__timeline">
                {auditEntries.map((entry) => (
                  <li key={entry.id} className="datum-ops__timeline-item">
                    <div className="datum-ops__timeline-marker" aria-hidden="true" />
                    <div className="datum-ops__timeline-content">
                      <div className="datum-ops__timeline-title">
                        <strong>{entry.summary}</strong>
                        <time dateTime={entry.createdAt}>{entry.createdAtLabel}</time>
                      </div>
                      <div className="datum-ops__timeline-meta">
                        <span>{entry.actorType}</span>
                        <span>{entry.actor}</span>
                        {entry.stage ? <span>{entry.stage}</span> : null}
                        {entry.fromStatus || entry.toStatus ? (
                          <span>
                            {entry.fromStatus ?? 'new'} → {entry.toStatus ?? 'unchanged'}
                          </span>
                        ) : null}
                        {entry.pipelineRunId ? (
                          <span>run {entry.pipelineRunId.slice(0, 8)}</span>
                        ) : null}
                      </div>
                      {entry.details != null ? (
                        <details className="datum-ops__audit-details">
                          <summary>Evidence</summary>
                          <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="datum-ops__review-aside">
          {error ? <p className="datum-ops__error">{error}</p> : null}

          {article.status === 'topic_selected' ? (
            <div className="datum-ops__block">
              <h3>Assign template</h3>
              <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                {article.researchHint || 'Pick a shape before the next pipeline run.'}
              </p>
              <div className="datum-ops__field">
                <label htmlFor="tpl">Template</label>
                <select
                  id="tpl"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={pending}
                >
                  <option value="">Select…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--primary"
                  disabled={pending || !templateId}
                  onClick={() =>
                    runAction(() => assignTemplateAction(article.id, Number(templateId)))
                  }
                >
                  Assign & return
                </button>
              </div>
            </div>
          ) : null}

          {article.status === 'topic_selected' && article.templateId != null ? (
            <div className="datum-ops__block">
              <h3>Start research</h3>
              <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                {/*
                  This exists because a piece created while the workspace was
                  not ready (no brand voice, missing live keys) is created
                  anyway and left here — nothing queues research for it on its
                  own once the workspace becomes ready, and until now there was
                  no way to start it from the admin.
                */}
                Research has not started yet. This runs it for this piece alone.
              </p>
              {mode === 'live' ? (
                <label className="datum-ops__cost-confirm">
                  <input
                    checked={confirmLiveCost}
                    disabled={pending}
                    onChange={(e) => setConfirmLiveCost(e.target.checked)}
                    type="checkbox"
                  />
                  <span>This run uses paid live providers.</span>
                </label>
              ) : null}
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--primary"
                  disabled={pending || (mode === 'live' && !confirmLiveCost)}
                  onClick={() =>
                    runAction(async () => {
                      const result = await runSelectedArticlesAction({
                        articleIds: [article.id],
                        confirmLiveCost,
                      })
                      if (!result.ok) throw new Error(result.error)
                    }, false)
                  }
                >
                  Start research
                </button>
              </div>
            </div>
          ) : null}

          {article.status === 'needs_revision' ? (
            <>
              <div className="datum-ops__block">
                <h3>QA triage</h3>
                <CheckRow label="Structural" passed={qa?.structural?.passed} />
                <CheckRow label="Fact check" passed={qa?.factCheck?.passed} />
                <CheckRow label="Qualitative" passed={qa?.qualitativeReview?.passed} />
              </div>
              {failures.length > 0 ? (
                <div className="datum-ops__block">
                  <h3>What failed</h3>
                  <ul className="datum-ops__qa-fails">
                    {failures.map((f, index) => (
                      <li key={`${f.code ?? f.check}-${index}`}>
                        <p className="datum-ops__qa-what">{f.what}</p>
                        <p className="datum-ops__qa-fix">
                          <strong>To fix:</strong> {f.fix}
                        </p>
                        {f.sources && f.sources.length > 0 ? (
                          <p className="datum-ops__qa-sources">
                            Checked against:{' '}
                            {f.sources.map((url, i) => (
                              <React.Fragment key={url}>
                                {i > 0 ? ', ' : ''}
                                <a href={url} rel="noreferrer noopener" target="_blank">
                                  {(() => {
                                    try {
                                      return new URL(url).hostname.replace(/^www\./, '')
                                    } catch {
                                      return url
                                    }
                                  })()}
                                </a>
                              </React.Fragment>
                            ))}
                          </p>
                        ) : null}
                        {f.code ? <code className="datum-ops__qa-code">{f.code}</code> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="datum-ops__hint">
                    Regenerating sends every &ldquo;to fix&rdquo; line above to the writer verbatim,
                    along with the original brief. It rewrites against the same research, so the new
                    draft is comparable to this one.
                  </p>
                </div>
              ) : null}
              {run && run.reasons.length > 0 ? (
                <div className="datum-ops__block">
                  <h3>Information-gain reasons</h3>
                  <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                    From run #{run.id}
                    {runIsCurrent ? '' : ' — an earlier scoring pass, not the current decision'}.
                    Regenerating feeds these to the next draft verbatim.
                  </p>
                  <ul className="datum-ops__list">
                    {run.reasons.map((reason, index) => (
                      <li key={`aside-${reason.policy}-${index}`}>
                        <code>{reason.policy}</code> {reason.message}
                        {reason.claimId ? ` (claim ${reason.claimId})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="datum-ops__block">
                <h3>Resolve</h3>
                <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                  Reset to <code>drafted</code> re-enters QA on next <code>pipeline:run</code>.
                  Regenerating goes further back, to <code>researched</code>, and rewrites the
                  draft.
                  {revisionCount > 0
                    ? ` Regenerated ${revisionCount} time${revisionCount === 1 ? '' : 's'} already.`
                    : ''}
                </p>
                {article.revisionNotes ? (
                  <details className="datum-ops__audit-details" style={{ marginBottom: 10 }}>
                    <summary>Notes fed to the last regeneration</summary>
                    <pre>{article.revisionNotes}</pre>
                  </details>
                ) : null}
                <div className="datum-ops__field">
                  <label htmlFor="note">Review note</label>
                  <textarea
                    id="note"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={pending}
                    placeholder="What you fixed…"
                  />
                </div>
                <div className="datum-ops__actions">
                  <button
                    type="button"
                    className="datum-ops__btn datum-ops__btn--primary"
                    disabled={pending}
                    onClick={() => runAction(() => resetToDraftedAction(article.id, notes))}
                  >
                    Reset to drafted
                  </button>
                  <button
                    className="datum-ops__btn"
                    disabled={pending}
                    onClick={() =>
                      runAction(async () => {
                        const result = await revisitBriefAction(article.id)
                        if (!result.ok) throw new Error(result.error)
                      }, false)
                    }
                    title="Go back to the brief and change the angle or sections before rewriting"
                    type="button"
                  >
                    Revisit brief
                  </button>
                  {confirmRegenerate ? (
                    <>
                      <button
                        type="button"
                        className="datum-ops__btn datum-ops__btn--danger"
                        disabled={pending}
                        onClick={() => runAction(() => regenerateArticleAction(article.id, notes))}
                      >
                        Confirm: discard draft & regenerate
                      </button>
                      <button
                        type="button"
                        className="datum-ops__btn"
                        disabled={pending}
                        onClick={() => setConfirmRegenerate(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="datum-ops__btn"
                      disabled={pending}
                      onClick={() => setConfirmRegenerate(true)}
                    >
                      Regenerate from gaps
                    </button>
                  )}
                  <a className="datum-ops__btn" href={editHref}>
                    Open in admin
                  </a>
                </div>
                {confirmRegenerate ? (
                  <p className="datum-ops__warn" style={{ marginTop: 10 }}>
                    This throws away the current body and sends the article back to{' '}
                    <code>researched</code> so the next pipeline run writes a new one, with the
                    reasons above (plus your note) in the prompt.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {article.status === 'qa_passed' ? (
            <div className="datum-ops__block">
              <h3>Awaiting information gain</h3>
              <p className="datum-ops__sub" style={{ margin: 0 }}>
                QA passed, but nothing has scored this draft yet. The <code>informationGain</code>{' '}
                stage runs on the next <code>pipeline:run</code> and decides between{' '}
                <code>verified</code>, <code>needs_review</code>, <code>blocked</code>, and{' '}
                <code>needs_revision</code>. There is nothing to approve until it has.
              </p>
              <div className="datum-ops__actions" style={{ marginTop: 12 }}>
                <a className="datum-ops__btn" href={editHref}>
                  Open in admin
                </a>
              </div>
            </div>
          ) : null}

          {article.status === 'verified' ? (
            <div className="datum-ops__block">
              <h3>Approve</h3>
              <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                QA and information gain both cleared this draft
                {run && runIsCurrent ? ` (run #${run.id}, ${DECISION_LABEL[run.decision]})` : ''}.
              </p>
              <div className="datum-ops__field">
                <label htmlFor="note">Review notes</label>
                <textarea
                  id="note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--primary"
                  disabled={pending}
                  onClick={() => runAction(() => approveArticleAction(article.id, notes))}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() => runAction(() => publishArticleAction(article.id, notes))}
                >
                  Approve & publish
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() =>
                    runAction(
                      () => sendBackAction(article.id, notes || 'Sent back for revision.'),
                      false,
                    )
                  }
                >
                  Send back
                </button>
                <a className="datum-ops__btn" href={editHref}>
                  Open in admin
                </a>
              </div>
            </div>
          ) : null}

          {article.status === 'approved' ? (
            <div className="datum-ops__block">
              <h3>Publish</h3>
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--primary"
                  disabled={pending}
                  onClick={() => runAction(() => publishArticleAction(article.id, notes))}
                >
                  Publish
                </button>
                <a className="datum-ops__btn" href={editHref}>
                  Open in admin
                </a>
              </div>
            </div>
          ) : null}

          {article.status === 'needs_review' || article.status === 'blocked' ? (
            <div className="datum-ops__block">
              <h3>Reviewer decision</h3>
              <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                {article.status === 'blocked'
                  ? 'Scoring blocked this draft.'
                  : 'Scoring asked for a human.'}{' '}
                {run
                  ? `Run #${run.id} recorded ${run.reasons.length} reason${
                      run.reasons.length === 1 ? '' : 's'
                    } — read them on the scorecard before deciding.`
                  : 'No scorecard is attached to this article.'}
              </p>
              <div className="datum-ops__field">
                <label htmlFor="justification">Justification (required to override)</label>
                <textarea
                  id="justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={pending}
                  placeholder="Why this draft is safe to verify despite the decision…"
                />
              </div>
              <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                Overriding records your justification on the article and in the audit trail, and
                must be new text each time — a justification written for an earlier review will be
                refused.
              </p>
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--primary"
                  disabled={pending || justification.trim().length === 0}
                  onClick={() => runAction(() => overrideReviewAction(article.id, justification))}
                >
                  Override to verified
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() =>
                    runAction(
                      () =>
                        sendBackAction(
                          article.id,
                          justification.trim() || 'Sent back after information-gain review.',
                        ),
                      false,
                    )
                  }
                >
                  Send back
                </button>
                <button
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() =>
                    runAction(async () => {
                      const result = await revisitBriefAction(article.id)
                      if (!result.ok) throw new Error(result.error)
                    }, false)
                  }
                  title="Go back to the brief and change the angle or sections before rewriting"
                  type="button"
                >
                  Revisit brief
                </button>
                <a className="datum-ops__btn" href={editHref}>
                  Open in admin
                </a>
              </div>
            </div>
          ) : null}

          {![
            'topic_selected',
            'needs_revision',
            'qa_passed',
            'verified',
            'needs_review',
            'blocked',
            'approved',
          ].includes(article.status) ? (
            <div className="datum-ops__block">
              <h3>Status</h3>
              <p className="datum-ops__sub" style={{ margin: 0 }}>
                No operator action required. Wait for the pipeline or open the document in admin.
              </p>
              <div className="datum-ops__actions" style={{ marginTop: 12 }}>
                <a className="datum-ops__btn" href={editHref}>
                  Open in admin
                </a>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
