'use client'

import React, { useState } from 'react'

import { assignTemplateAction } from '../../actions'
import { runSelectedArticlesAction } from '../../boardActions'
import {
  isRunnableStatus,
  NEXT_STAGE_VERB_FOR_STATUS,
  STAGE_LABEL,
  STATUS_META,
} from '../../articleStatus'
import { OpenInAdmin } from '../ArchiveAction'
import type { PanelProps } from '../types'

/**
 * A research hint worth printing above the template select.
 *
 * `research.rankingPagesSummary` is sometimes a sentence and sometimes a dump
 * of every SERP result the research stage saw. The first helps somebody choose
 * a shape; the second buries the control it sits above, which is why the
 * `topic_selected` panel used to be mostly SERP text.
 */
const ONE_LINE_HINT_MAX = 160
function oneLineHint(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.includes('\n') || trimmed.length > ONE_LINE_HINT_MAX) return null
  return trimmed
}

/**
 * The one run control, on every status a pipeline run can advance.
 *
 * Before this, three of those statuses shared a "No operator action required.
 * Wait for the pipeline" block that was false whenever no run was in flight —
 * the reviewer could see the piece was stuck and had nothing to press. The
 * panel names the stage a run would do next and starts one.
 *
 * `topic_selected` folds the template choice in rather than getting a second
 * panel: `queueRunForArticles` refuses an article with no template, so
 * assigning one and starting research is a single decision, and splitting it
 * across two blocks only made the first look optional.
 */
export function RunNextStagePanel({
  action,
  article,
  editHref,
  mode,
  scoreInvalidatedBy,
  templates,
}: PanelProps) {
  const { pending, runAction, setNotice } = action
  const [templateId, setTemplateId] = useState(
    article.templateId != null ? String(article.templateId) : '',
  )
  /** Live mode only: the run is one confirmation away from spending money. */
  const [confirming, setConfirming] = useState(false)

  const status = article.status
  if (!isRunnableStatus(status)) return null
  const needsTemplate = status === 'topic_selected'
  const hint = needsTemplate ? oneLineHint(article.researchHint) : null

  /**
   * Start a run for this piece alone, assigning the chosen template first when
   * the piece has not got one yet — the pipeline skips untemplated articles,
   * so on `topic_selected` the two are one action.
   */
  const startRun = (confirmLiveCost: boolean) => {
    setConfirming(false)
    runAction(async () => {
      if (status === 'topic_selected' && templateId) {
        await assignTemplateAction(article.id, Number(templateId))
      }
      const result = await runSelectedArticlesAction({
        articleIds: [article.id],
        confirmLiveCost,
      })
      if (!result.ok) throw new Error(result.error)
      setNotice(result.message)
    })
  }

  return (
    <div className="datum-ops__block">
      <h3>{STAGE_LABEL[STATUS_META[status].stage]}</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        Datum will {NEXT_STAGE_VERB_FOR_STATUS[status]} on the next run.
      </p>
      {scoreInvalidatedBy ? (
        <p className="datum-ops__warn">
          Score cleared by an edit to {scoreInvalidatedBy}. Run next stage to re-check and re-score.
        </p>
      ) : null}
      {needsTemplate ? (
        <>
          {hint ? (
            <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
              {hint}
            </p>
          ) : null}
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
        </>
      ) : null}
      {confirming ? (
        <>
          <p className="datum-ops__warn">This calls paid providers. Continue?</p>
          <div className="datum-ops__actions">
            <button
              type="button"
              className="datum-ops__btn datum-ops__btn--primary"
              disabled={pending}
              onClick={() => startRun(true)}
            >
              Confirm
            </button>
            <button
              type="button"
              className="datum-ops__btn"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="datum-ops__actions">
          <button
            type="button"
            className="datum-ops__btn datum-ops__btn--primary"
            disabled={pending || (needsTemplate && !templateId)}
            onClick={() => (mode === 'live' ? setConfirming(true) : startRun(false))}
          >
            {needsTemplate ? 'Assign and start research' : 'Run next stage'}
          </button>
          <OpenInAdmin editHref={editHref} />
        </div>
      )}
    </div>
  )
}
