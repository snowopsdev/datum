'use client'

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { approveBriefAction, type BriefEdits, saveBriefAction } from './briefActions'
import { LeaveDialog, RestoreNotice, SaveButton, UnsavedBar } from './DirtyGuardUi'
import { announceRunQueued } from './runQueued'
import { useDirtyGuard } from './useDirtyGuard'
import type { BriefAngleOption } from '../../../../pipeline/src/brief'
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
  /** The article's version, so an edit kept in the browser is not put over a newer save. */
  updatedAt?: string | null
  /** Active audiences, primary first. Empty when the workspace has none. */
  icps: BriefIcpOption[]
  initial: {
    angleOptions?: BriefAngleOption[]
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
 * Research proposes grounded angles; the editor's job
 * is to correct the angle, cut or add sections, and say what they actually
 * want. Approving is what starts the writing — there is no separate run
 * button to find afterwards.
 */
export function BriefEditor({
  articleId,
  keyword,
  templateName,
  mode,
  updatedAt = null,
  icps,
  initial,
}: Props) {
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

  // Sections are compared by what they say, not by the list keys the rows
  // render under, so reordering or removing one cannot fool the comparison.
  const guard = useDirtyGuard<BriefEdits>({
    formKey: `brief:article:${articleId}`,
    value: edits(),
    initial: {
      angle: initial.angle,
      audience: initial.audience,
      sections: initial.sections,
      notes: initial.notes,
      icpId: initial.icpId,
    },
    version: updatedAt,
    onReset: (value) => {
      setAngle(value.angle)
      setAudience(value.audience)
      setSections(value.sections)
      setNotes(value.notes)
      setIcpId(value.icpId)
    },
    labels: {
      angle: 'the angle',
      audience: 'the audience',
      sections: 'the sections',
      notes: 'the notes',
      icpId: 'the audience',
    },
    save: async () => {
      setMessage(null)
      const result = await saveBriefAction(articleId, edits())
      if (!result.ok) {
        setMessage({ ok: false, text: result.error })
        return null
      }
      // Every field as stored: the angle and notes come back trimmed, and a
      // field left as typed would stay dirty against them for good.
      const saved = result.saved ?? edits()
      setAngle(saved.angle)
      setAudience(saved.audience)
      setSections(saved.sections)
      setNotes(saved.notes)
      setIcpId(saved.icpId)
      toast.success(result.message)
      router.refresh()
      return { saved, version: result.updatedAt }
    },
  })

  const angleOptions = initial.angleOptions ?? []
  /** The chosen card holds the single tab stop; a hand-typed angle leaves the first one. */
  const focusableAngle = Math.max(
    0,
    angleOptions.findIndex((option) => option.angle === angle),
  )

  /** Arrow keys move the choice and the focus together, as a native radio group does. */
  const moveAngle = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = angleOptions.length
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % count
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    else return
    event.preventDefault()
    setAngle(angleOptions[next].angle)
    const radios =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    radios?.[next]?.focus()
  }

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

  const save = () =>
    startTransition(async () => {
      await guard.submit()
    })

  /**
   * Approve, and with it start writing. In live mode that is a paid call, so
   * the same one-line confirm the run panel uses stands in front of it — the
   * server refuses an unconfirmed live approval either way.
   */
  const approve = (confirmLiveCost: boolean) => {
    setMessage(null)
    setConfirming(false)
    startTransition(async () => {
      const sent = edits()
      const result = await approveBriefAction(articleId, sent, { confirmLiveCost })
      setMessage({ ok: result.ok, text: result.ok ? result.message : result.error })
      if (result.ok) {
        // Approved with these edits: the piece moves on, so nothing is left unsaved.
        guard.markSaved(sent)
        if (result.runId) announceRunQueued({ runId: result.runId })
        router.refresh()
      }
    })
  }

  return (
    <div className="datum-brief">
      <RestoreNotice guard={guard} />
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

      {angleOptions.length ? (
        <div className="datum-brief__sections">
          <h3>Suggested angles</h3>
          <div aria-label="Suggested angles" className="datum-brief__angles" role="radiogroup">
            {angleOptions.map((option, index) => {
              const selected = angle === option.angle
              return (
                <button
                  aria-checked={selected}
                  className={`datum-brief__angle${selected ? ' is-selected' : ''}`}
                  disabled={pending}
                  key={index}
                  onClick={() => setAngle(option.angle)}
                  onKeyDown={(event) => moveAngle(event, index)}
                  role="radio"
                  tabIndex={index === focusableAngle ? 0 : -1}
                  type="button"
                >
                  <span aria-hidden="true" className="datum-brief__angle-check" />
                  <span className="datum-brief__angle-body">
                    <strong className="datum-brief__angle-title">{option.angle}</strong>
                    <span className="datum-brief__angle-why">{option.rationale}</span>
                    <span className="datum-brief__angle-chips">
                      <span className="datum-brief__angle-chip">
                        For: {option.pain ?? 'Template direction'}
                      </span>
                      <span className="datum-brief__angle-chip">
                        Fills: {option.gaps.join(', ') || '—'}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
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
        <p
          className={message.ok ? 'datum-ops__ok' : 'datum-ops__error'}
          role={message.ok ? 'status' : 'alert'}
        >
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
            <SaveButton guard={guard} onClick={save} pending={pending} />
          </>
        )}
      </div>
      <UnsavedBar guard={guard} onSave={save} pending={pending} />
      <LeaveDialog guard={guard} />
    </div>
  )
}
