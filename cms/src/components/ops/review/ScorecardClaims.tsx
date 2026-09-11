'use client'

import React from 'react'

import type { InformationGainRunView, ScorecardClaim } from '../articleStatus'

/** How a source's quality score was arrived at — see `Evidence.qualitySource`. */
const QUALITY_SOURCE_LABEL: Record<string, string> = {
  'evidence-sources': 'evidence-sources table',
  rubric: 'rubric',
  rubric_capped: 'rubric (capped)',
}

export function pct(value: number | null): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

export function dec(value: number | null, digits = 2): string {
  return value == null ? '—' : value.toFixed(digits)
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

/** Every claim the run recorded, or as many of them as `toRunView` kept. */
export function ScorecardClaimsTable({ run }: { run: InformationGainRunView }) {
  return (
    <>
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
    </>
  )
}
