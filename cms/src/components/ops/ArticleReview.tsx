'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  approveArticleAction,
  assignTemplateAction,
  publishArticleAction,
  resetToDraftedAction,
  sendBackAction,
} from './actions'
import type { BoardArticle, TemplateOption } from './articleStatus'
import './ops.css'

type Props = {
  article: BoardArticle
  templates: TemplateOption[]
  editHref: string
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

function violationLines(article: BoardArticle): string[] {
  const lines: string[] = []
  const qa = article.qaResults
  const raw = qa?.structural?.violations
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (typeof v === 'string') lines.push(v)
      else if (v && typeof v === 'object' && 'code' in v) {
        const code = String((v as { code: unknown }).code)
        const detail =
          'message' in v && (v as { message?: unknown }).message != null
            ? ` — ${String((v as { message: unknown }).message)}`
            : ''
        lines.push(`${code}${detail}`)
      }
    }
  }
  if (qa?.factCheck?.passed === false && qa.factCheck.notes) {
    lines.push(`Fact: ${qa.factCheck.notes}`)
  }
  if (qa?.qualitativeReview?.passed === false && qa.qualitativeReview.notes) {
    lines.push(`Style: ${qa.qualitativeReview.notes}`)
  }
  return lines
}

export function ArticleReview({ article, templates, editHref }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState(
    article.templateId != null ? String(article.templateId) : '',
  )
  const [notes, setNotes] = useState(article.reviewNotes ?? '')

  const run = (fn: () => Promise<void>, thenBoard = true) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        if (thenBoard) router.push('/admin/ops/articles')
        else router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      }
    })
  }

  const qa = article.qaResults
  const details = violationLines(article)

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <Link className="datum-ops__btn" href="/admin/ops/articles" prefetch={false}>
          ← Board
        </Link>
        <span className={`datum-ops__status datum-ops__status--${article.status}`}>
          {article.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="datum-ops__review">
        <div className="datum-ops__review-main">
          <h1>{article.title || article.keyword}</h1>
          <p className="datum-ops__sub">
            {article.keyword}
            {article.templateName ? ` · ${article.templateName}` : ''}
            {article.totalCostUsd != null ? ` · $${article.totalCostUsd.toFixed(2)}` : ''}
          </p>
          <div className="datum-ops__prose">
            <h3>Preview</h3>
            <p>
              {article.metaDescription ||
                article.researchHint ||
                'No body preview yet — assign a template and run the pipeline.'}
            </p>
          </div>
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
                    run(() => assignTemplateAction(article.id, Number(templateId)))
                  }
                >
                  Assign & return
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
              {details.length > 0 ? (
                <div className="datum-ops__block">
                  <h3>Failure detail</h3>
                  <ul className="datum-ops__list">
                    {details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="datum-ops__block">
                <h3>Resolve</h3>
                <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                  Reset to <code>drafted</code> re-enters QA on next <code>pipeline:run</code>.
                </p>
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
                    onClick={() => run(() => resetToDraftedAction(article.id, notes))}
                  >
                    Reset to drafted
                  </button>
                  <a className="datum-ops__btn" href={editHref}>
                    Open in admin
                  </a>
                </div>
              </div>
            </>
          ) : null}

          {article.status === 'qa_passed' ? (
            <div className="datum-ops__block">
              <h3>Approve</h3>
              <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
                All QA checks passed.
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
                  onClick={() => run(() => approveArticleAction(article.id, notes))}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() => run(() => publishArticleAction(article.id, notes))}
                >
                  Approve & publish
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  disabled={pending}
                  onClick={() =>
                    run(() => sendBackAction(article.id, notes || 'Sent back for revision.'), false)
                  }
                >
                  Send back
                </button>
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
                  onClick={() => run(() => publishArticleAction(article.id, notes))}
                >
                  Publish
                </button>
              </div>
            </div>
          ) : null}

          {!['topic_selected', 'needs_revision', 'qa_passed', 'approved'].includes(
            article.status,
          ) ? (
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
