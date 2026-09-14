'use client'

import React, { useRef } from 'react'

import { FACET_GAIN_THRESHOLD } from '../../../lib/informationGain/scoring'
import type { InformationGainRunView, ScorecardClaim } from '../articleStatus'
import { dec, pct, ScorecardClaimsTable } from './ScorecardClaims'
import { DECISION_LABEL } from './types'

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
  onClaimLink,
}: {
  reasons: InformationGainRunView['reasons']
  claimById: Map<string, ScorecardClaim>
  /**
   * Called before the fragment navigation, so the disclosure holding the
   * claims table can open itself. A link to a row inside a closed `<details>`
   * scrolls nowhere.
   */
  onClaimLink: () => void
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
                <a
                  href={`#ig-claim-${encodeURIComponent(reason.claimId)}`}
                  onClick={onClaimLink}
                >
                  {reason.claimId}
                </a>
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

/** The six headline numbers, the uncalibrated disclaimer and the claim counts. */
function IgMetrics({ run }: { run: InformationGainRunView }) {
  return (
    <>
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
    </>
  )
}

/**
 * The full scorecard for one run. Everything here is read from the
 * `information-gain-runs` row itself; `isCurrent` says whether the article's
 * own `informationGain` summary still points at this run, because a reviewer
 * reading a decision assembled from two different scoring passes is exactly
 * the failure this banner exists to prevent.
 *
 * The decision and the reasons behind it render open; the tiles, the
 * uncalibrated disclaimer and the claims table sit behind "Show scorecard".
 * Six metrics and a claims table between the draft and the panel that acts on
 * it buried the two things a reviewer actually decides from.
 */
export function Scorecard({
  run,
  isCurrent,
  summaryRunId,
}: {
  run: InformationGainRunView
  isCurrent: boolean
  summaryRunId: number | null
}) {
  const claimById = new Map(run.claims.map((c) => [c.id, c]))
  const claimsDisclosure = useRef<HTMLDetailsElement>(null)
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

      <h3 className="datum-ops__ig-subhead">Why this decision</h3>
      <IgReasons
        claimById={claimById}
        onClaimLink={() => {
          // Synchronously, before the browser follows the fragment: the row
          // has to be in the layout for the jump to land on it.
          if (claimsDisclosure.current) claimsDisclosure.current.open = true
        }}
        reasons={run.reasons}
      />

      <details
        className="datum-ops__audit-details"
        ref={claimsDisclosure}
        style={{ marginTop: 12 }}
      >
        <summary>Show scorecard</summary>
        <IgMetrics run={run} />
        <ScorecardClaimsTable run={run} />
      </details>
    </section>
  )
}
