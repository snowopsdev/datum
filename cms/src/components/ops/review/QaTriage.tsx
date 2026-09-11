'use client'

import React from 'react'

import { qaFailures, type BoardArticle } from '../articleStatus'

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

/** The four QA checks, pass or fail. */
export function QaTriage({ article }: { article: BoardArticle }) {
  const qa = article.qaResults
  return (
    <div className="datum-ops__block">
      <h3>QA triage</h3>
      <CheckRow label="Structural" passed={qa?.structural?.passed} />
      <CheckRow label="Fact check" passed={qa?.factCheck?.passed} />
      <CheckRow label="Qualitative" passed={qa?.qualitativeReview?.passed} />
      <CheckRow label="Evidence" passed={qa?.evidenceCheck?.passed} />
    </div>
  )
}

/** The hostname of a checked-against source, or the raw URL when it is not one. */
function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Every failing check, with the fix line the writer will be handed verbatim. */
export function QaFailures({ article }: { article: BoardArticle }) {
  const failures = qaFailures(article)
  if (failures.length === 0) return null
  return (
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
                      {sourceLabel(url)}
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
        Regenerating sends every &ldquo;to fix&rdquo; line above to the writer verbatim, along with
        the original brief. It rewrites against the same research, so the new draft is comparable to
        this one.
      </p>
    </div>
  )
}
