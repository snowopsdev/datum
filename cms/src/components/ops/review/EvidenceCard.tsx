'use client'

import React from 'react'

import { evidenceFindingsOf, type BoardArticle } from '../articleStatus'

/**
 * What the draft said about this company, judged against the evidence bank.
 *
 * Rendered only when there is something to judge: an empty card beside a
 * failing draft reads as "the evidence check passed", which is the opposite of
 * "the evidence check found no first-party claims".
 */
export function EvidenceCard({ article }: { article: BoardArticle }) {
  const findings = evidenceFindingsOf(article.qaResults?.evidenceCheck?.claims)
  const citations = article.evidenceCitations
  if (findings.length === 0 && citations.length === 0) return null
  return (
    <div className="datum-ops__block">
      <h3>Evidence</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        What the draft said about this company, judged against the evidence bank. Rejected,
        unusable, and overreaching claims fail the article; unbacked ones are flagged only.
      </p>
      {findings.length > 0 ? (
        <ul className="datum-ops__qa-fails">
          {findings.map((finding, index) => (
            <li key={`evidence-${index}`}>
              <p className="datum-ops__qa-what">
                <code className="datum-ops__qa-code">{finding.status}</code> {finding.excerpt}
              </p>
              {finding.note ? (
                <p className="datum-ops__qa-fix">
                  {finding.ref ? <strong>[{finding.ref}] </strong> : null}
                  {finding.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="datum-ops__hint">No first-party claims were found to judge.</p>
      )}
      {citations.length > 0 ? (
        <details className="datum-ops__audit-details" style={{ marginTop: 10 }}>
          <summary>Entries the draft cited ({citations.length})</summary>
          <ul className="datum-ops__list">
            {citations.map((citation, index) => (
              <li key={`citation-${citation.ref}-${index}`}>
                <code>{citation.ref}</code> {citation.excerpt}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
