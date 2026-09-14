'use client'

import React from 'react'

import { BriefEditor, type BriefIcpOption } from '../../BriefEditor'
import type { BoardArticle } from '../../articleStatus'
import { ArchiveAction, OpenInAdmin } from '../ArchiveAction'
import type { PanelProps } from '../types'

/** The stored brief, in the shape the editor edits. Rows without a heading are dropped. */
export function briefInitial(raw: BoardArticle['brief'], icpId: number | null) {
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
    icpId,
  }
}

/**
 * The brief itself, in the main column — the one surface the reviewer works on
 * while the piece sits at `brief_review`.
 */
export function BriefMain({
  article,
  icps,
  mode,
}: {
  article: BoardArticle
  icps: BriefIcpOption[]
  mode: 'mock' | 'live'
}) {
  return (
    <BriefEditor
      articleId={article.id}
      icps={icps}
      initial={briefInitial(article.brief, article.icpId)}
      keyword={article.keyword}
      mode={mode}
      templateName={article.templateName}
    />
  )
}

/** The aside block beside the brief: nothing to run, only archive or leave. */
export function BriefPanel({ action, article, editHref }: PanelProps) {
  return (
    <div className="datum-ops__block">
      <h3>This piece</h3>
      <p className="datum-ops__sub" style={{ marginBottom: 10 }}>
        Approve or rework the brief on the left. Nothing is written until you do — archive it
        instead if the topic is not worth the draft.
      </p>
      <div className="datum-ops__actions">
        <ArchiveAction action={action} archived={article.archived} articleId={article.id} />
        <OpenInAdmin editHref={editHref} />
      </div>
    </div>
  )
}
