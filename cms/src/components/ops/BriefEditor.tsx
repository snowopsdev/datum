'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { approveBriefAction, type BriefEdits, saveBriefAction } from './briefActions'
import './ops.css'

type Section = BriefEdits['sections'][number]

/** One active audience, with the line it derives, so switching can rewrite it here. */
export type BriefIcpOption = {
  id: number
  name: string
  primary: boolean
  audienceLine: string
}

type Props = {
  articleId: number
  keyword: string
  templateName: string | null
  mode: 'mock' | 'live'
  /** Active audiences, primary first. Empty when the workspace has none. */
  icps: BriefIcpOption[]
  initial: {
    angle: string
    audience: string
    sections: Section[]
    mustCover: string[]
    opportunities: string[]
    notes: string
    icpId: number | null
  }
}

/**
 * The one screen where a person shapes a piece before it costs anything.
 *
 * Everything here was built by research with no model call; the editor's job
 * is to correct the angle, cut or add sections, and say what they actually
 * want. Approving is what starts the writing — there is no separate run
 * button to find afterwards.
 */
export function BriefEditor({ articleId, keyword, templateName, mode, icps, initial }: Props) {
  const router = useRouter()
  const [angle, setAngle] = useState(initial.angle)
  const [audience, setAudience] = useState(initial.audience)
  const [icpId, setIcpId] = useState<number | null>(initial.icpId)
  const [sections, setSections] = useState<Section[]>(initial.sections)
  const [notes, setNotes] = useState(initial.notes)
  const [newHeading, setNewHeading] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  /** Live mode only: approving is one confirmation away from spending money. */
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const edits = (): BriefEdits => ({ angle, audience, sections, notes, icpId })

  /**
   * Switching audiences rewrites the line, unless the editor has already
   * written their own. The server applies the same rule when it saves — this
   * is here so the change is visible before the save, not instead of it.
   */
  const chooseIcp = (next: number | null) => {
    const previousLine = icps.find((icp) => icp.id === icpId)?.audienceLine ?? ''
    const nextLine = icps.find((icp) => icp.id === next)?.audienceLine ?? ''
    if ((audience === previousLine || audience === '') && nextLine) setAudience(nextLine)
    setIcpId(next)
  }

  const updateSection = (index: number, patch: Partial<Section>) =>
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const removeSection = (index: number) => setSections((prev) => prev.filter((_, i) => i !== index))

  const addSection = () => {
    const heading = newHeading.trim()
    if (!heading) return
    setSections((prev) => [...prev, { heading, notes: '', source: 'editor' }])
    setNewHeading('')
  }

  const save = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await saveBriefAction(articleId, edits())
      setMessage({ ok: result.ok, text: result.ok ? result.message : result.error })
      if (result.ok) router.refresh()
    })
  }

  /**
   * Approve, and with it start writing. In live mode that is a paid call, so
   * the same one-line confirm the run panel uses stands in front of it — the
   * server refuses an unconfirmed live approval either way.
   */
  const approve = (confirmLiveCost: boolean) => {
    setMessage(null)
    setConfirming(false)
    startTransition(async () => {
      const result = await approveBriefAction(articleId, edits(), { confirmLiveCost })
      setMessage({ ok: result.ok, text: result.ok ? result.message : result.error })
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="datum-brief">
      <div className="datum-brief__intro">
        <p className="datum-ops__eyebrow">Brief · step 2 of 5</p>
        <h2>Check the plan before we write</h2>
        <p className="datum-ops__sub">
          Research is done. Nothing has been written yet, so nothing has been spent on writing.
          {mode === 'live' ? ' Research used paid calls, and writing will too.' : ''}
        </p>
        <ol className="datum-brief__todo">
          <li>
            <strong>Check the angle and audience.</strong> Change them if they are off.
          </li>
          <li>
            <strong>Go through the sections.</strong> Keep, rename, or remove them. Add a note to
            any section to tell the writer what to say.
          </li>
          <li>
            <strong>Add notes for the writer</strong> if you have any. This is optional.
          </li>
          <li>
            <strong>Press Approve and write.</strong> Datum writes the draft, runs the checks, and
            scores it.
          </li>
        </ol>
      </div>

      <label className="datum-ops__field">
        <span>Angle</span>
        <input
          disabled={pending}
          onChange={(e) => setAngle(e.target.value)}
          placeholder={`What "${keyword}" should deliver`}
          type="text"
          value={angle}
        />
        <span className="datum-ops__hint">What this piece promises the reader.</span>
      </label>

      {icps.length > 0 ? (
        <label className="datum-ops__field">
          <span>Audience</span>
          <select
            disabled={pending}
            onChange={(e) => chooseIcp(e.target.value ? Number(e.target.value) : null)}
            value={icpId ?? ''}
          >
            <option value="">Not set</option>
            {icps.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name}
                {icp.primary ? ' (primary)' : ''}
              </option>
            ))}
          </select>
          <span className="datum-ops__hint">
            Who this is written for. It shapes the draft and the review.
          </span>
        </label>
      ) : null}

      <label className="datum-ops__field">
        <span>{icps.length > 0 ? 'Audience in one sentence' : 'Audience'}</span>
        <input
          disabled={pending}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Who this is for, in a sentence"
          type="text"
          value={audience}
        />
      </label>

      <div className="datum-brief__sections">
        <div className="datum-brief__sections-head">
          <h3>Sections</h3>
          <p className="datum-ops__hint">
            Sections marked <em>required</em> come from the {templateName ?? 'template'} and cannot
            be removed. The rest come from gaps in what already ranks. Keep, rename, or remove them.
            Add a note under any section to tell the writer what it should say.
          </p>
        </div>
        <ol className="datum-brief__list">
          {sections.map((section, index) => (
            <li
              className={`datum-brief__section datum-brief__section--${section.source}`}
              key={`${index}-${section.source}`}
            >
              <div className="datum-brief__section-row">
                {section.source === 'template' ? (
                  <strong className="datum-brief__heading">{section.heading}</strong>
                ) : (
                  <input
                    aria-label="Section heading"
                    className="datum-brief__heading-input"
                    disabled={pending}
                    onChange={(e) => updateSection(index, { heading: e.target.value })}
                    type="text"
                    value={section.heading}
                  />
                )}
                <span className={`datum-ops__pill datum-ops__pill--muted datum-ops__pill--tight`}>
                  {section.source === 'template'
                    ? 'required'
                    : section.source === 'research'
                      ? 'from research'
                      : 'added by you'}
                </span>
                {section.source !== 'template' ? (
                  <button
                    className="datum-ops__link-btn"
                    disabled={pending}
                    onClick={() => removeSection(index)}
                    type="button"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <textarea
                aria-label={`Notes for ${section.heading}`}
                disabled={pending}
                onChange={(e) => updateSection(index, { notes: e.target.value })}
                placeholder="Optional: what should this section say?"
                rows={2}
                value={section.notes}
              />
            </li>
          ))}
        </ol>
        <div className="datum-brief__add">
          <input
            aria-label="New section heading"
            disabled={pending}
            onChange={(e) => setNewHeading(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSection()
              }
            }}
            placeholder="Add a section…"
            type="text"
            value={newHeading}
          />
          <button
            className="datum-ops__btn"
            disabled={pending || !newHeading.trim()}
            onClick={addSection}
            type="button"
          >
            Add
          </button>
        </div>
      </div>

      {initial.mustCover.length > 0 || initial.opportunities.length > 0 ? (
        <div className="datum-brief__research">
          {initial.mustCover.length > 0 ? (
            <p>
              <strong>The top results already cover:</strong> {initial.mustCover.join(' · ')}. The
              draft covers these too. Skipping one lowers the score.
            </p>
          ) : null}
          {initial.opportunities.length > 0 ? (
            <p>
              <strong>Gaps nobody has answered well:</strong> {initial.opportunities.join(' · ')}.
              These are the sections above marked <em>from research</em>.
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="datum-ops__field">
        <span>Notes for the writer (optional)</span>
        <textarea
          disabled={pending}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="The take you want, what to avoid, an example to follow. If this disagrees with the template, this wins."
          rows={4}
          value={notes}
        />
      </label>

      {message ? (
        <p className={message.ok ? 'datum-ops__ok' : 'datum-ops__error'} role="status">
          {message.text}
        </p>
      ) : null}

      <p className="datum-brief__actions-note">
        Happy with the plan? Approve to start writing. Not sure yet? Save and come back.
      </p>
      {confirming ? <p className="datum-ops__warn">This calls paid providers. Continue?</p> : null}
      <div className="datum-brief__actions">
        {confirming ? (
          <>
            <button
              className="datum-ops__btn datum-ops__btn--primary"
              disabled={pending}
              onClick={() => approve(true)}
              type="button"
            >
              Confirm
            </button>
            <button
              className="datum-ops__btn"
              disabled={pending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="datum-ops__btn datum-ops__btn--primary"
              disabled={pending}
              onClick={() => (mode === 'live' ? setConfirming(true) : approve(false))}
              type="button"
            >
              {pending ? 'Working…' : 'Approve and write'}
            </button>
            <button className="datum-ops__btn" disabled={pending} onClick={save} type="button">
              Save for later
            </button>
          </>
        )}
      </div>
    </div>
  )
}
