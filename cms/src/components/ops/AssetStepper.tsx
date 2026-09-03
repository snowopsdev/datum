'use client'

import React, { useState, useTransition } from 'react'

import { assistAction, type AssistAsset } from './setupActions'
import './ops.css'

/**
 * One step of a tenant-asset editor.
 *
 * `assist` is the section name from the setup-assistant contract, or absent
 * when the step is nothing an assistant can help with — the review step, or a
 * step that is only switches and dates.
 */
export type AssetStep<Id extends string = string> = {
  id: Id
  title: string
  blurb: string
  assist?: string
}

type Props<Id extends string> = {
  heading: string
  lede: string
  /** Rendered next to the heading: a status, a pill, a link back to the list. */
  headerExtra?: React.ReactNode
  steps: readonly AssetStep<Id>[]
  step: number
  onStep: (index: number) => void
  asset: AssistAsset
  /** `asset === 'icp'`: which record the assistant is drafting for. */
  icpId?: number
  /** The current value of this step's assist section, sent for a refine. */
  sectionValue: (stepId: Id) => unknown
  /** Merge an assistant's proposal into form state. Never saves. */
  onAssist: (stepId: Id, value: Record<string, unknown>) => void
  disabled: boolean
  /** The step's fields. */
  children: React.ReactNode
  /** Save, activate, archive — whatever this asset's footer offers. */
  actions: React.ReactNode
  /** What is still missing, shown above the actions. Never blocks a save here. */
  problems?: string[]
  problemsTitle?: string
  error?: string | null
  message?: string | null
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/**
 * The step navigation, notes box, assist buttons, and footer every tenant
 * asset editor shares.
 *
 * `BrandVoiceEditor.tsx` is deliberately not refactored onto this: it works,
 * it is covered, and its onboarding flow has rules (a stored `onboardingStep`,
 * an upload path) that no other asset has. This is the same shape, minus that
 * history, plus the thing the tenant assets need and the voice does not — an
 * assistant that drafts a section from the workspace's own words.
 *
 * Notes are per step and live only in this component. They are assist input:
 * what an operator scribbles to steer one draft is not an asset field, and
 * saving it would put scratch text one edit away from every prompt.
 */
export function AssetStepper<Id extends string>({
  heading,
  lede,
  headerExtra,
  steps,
  step,
  onStep,
  asset,
  icpId,
  sectionValue,
  onAssist,
  disabled,
  children,
  actions,
  problems = [],
  problemsTitle = 'Still missing',
  error,
  message,
}: Props<Id>) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [assistError, setAssistError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [assistNote, setAssistNote] = useState<string | null>(null)
  const [mock, setMock] = useState(false)
  const [pending, startTransition] = useTransition()

  const current = steps[Math.max(0, Math.min(steps.length - 1, step))]
  const busy = disabled || pending

  const runAssist = (mode: 'draft' | 'refine') => {
    if (!current.assist) return
    setAssistError(null)
    setWarnings([])
    setAssistNote(null)
    startTransition(async () => {
      const result = await assistAction({
        asset,
        section: current.assist as string,
        mode,
        notes: notes[current.id] ?? '',
        current: mode === 'refine' ? sectionValue(current.id) : null,
        ...(icpId != null ? { icpId } : {}),
      })
      if (!result.ok) {
        setAssistError(result.error)
        return
      }
      const value = asRecord(result.value)
      if (!value) {
        setAssistError('The assistant returned nothing usable for this step.')
        return
      }
      onAssist(current.id, value)
      setMock(result.mock)
      setWarnings(result.warnings)
      setAssistNote(
        mode === 'draft'
          ? 'Drafted into the fields above. Nothing is saved until you press Save.'
          : 'Revised the fields above. Nothing is saved until you press Save.',
      )
    })
  }

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>{heading}</h1>
        <span className="datum-ops__pill">
          step {step + 1} of {steps.length}
        </span>
        {headerExtra}
      </div>
      <p className="datum-ops__lede">{lede}</p>

      <div className="datum-ops__stepper">
        <ol className="datum-ops__progress" aria-label="Setup progress">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={`datum-ops__progress-seg${i < step ? ' is-done' : ''}${
                i === step ? ' is-current' : ''
              }`}
            >
              <button type="button" onClick={() => onStep(i)} disabled={busy} title={s.title}>
                <span className="datum-ops__progress-num">{i + 1}</span>
                <span className="datum-ops__progress-label">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="datum-ops__step">
          <h2>{current.title}</h2>
          <p className="datum-ops__sub">{current.blurb}</p>
          {error ? <p className="datum-ops__error">{error}</p> : null}
          {message ? <p className="datum-ops__ok">{message}</p> : null}

          {children}

          {current.assist ? (
            <div className="datum-ops__assist">
              <div className="datum-ops__assist-head">
                <strong>Draft this step with the setup assistant</strong>
                {mock ? <span className="datum-ops__pill datum-ops__pill--muted">mock</span> : null}
              </div>
              <p className="datum-ops__hint">
                It reads your site pages, your brand voice, and the rest of this workspace. It never
                saves: whatever comes back lands in the form for you to edit.
              </p>
              <div className="datum-ops__field">
                <label htmlFor={`assist-notes-${current.id}`}>
                  Your notes for this step (optional)
                </label>
                <textarea
                  id={`assist-notes-${current.id}`}
                  value={notes[current.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [current.id]: e.target.value })}
                  disabled={busy}
                  placeholder="Anything the site does not say: what you heard on calls, what you want emphasised."
                />
              </div>
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn"
                  onClick={() => runAssist('draft')}
                  disabled={busy}
                >
                  {pending ? 'Working…' : 'Draft with AI'}
                </button>
                <button
                  type="button"
                  className="datum-ops__btn"
                  onClick={() => runAssist('refine')}
                  disabled={busy}
                >
                  Refine with AI
                </button>
              </div>
              {assistError ? <p className="datum-ops__error">{assistError}</p> : null}
              {assistNote ? <p className="datum-ops__ok">{assistNote}</p> : null}
              {warnings.length > 0 ? (
                <ul className="datum-ops__list">
                  {warnings.map((warning) => (
                    <li className="datum-ops__warn" key={warning}>
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="datum-ops__step-actions">
            <div className="datum-ops__actions">
              <button
                type="button"
                className="datum-ops__btn"
                onClick={() => onStep(step - 1)}
                disabled={busy || step === 0}
              >
                ← Back
              </button>
              <button
                type="button"
                className="datum-ops__btn"
                onClick={() => onStep(step + 1)}
                disabled={busy || step === steps.length - 1}
              >
                Next →
              </button>
            </div>
            <div className="datum-ops__actions">{actions}</div>
          </div>

          {problems.length > 0 ? (
            <div className="datum-ops__checklist">
              <strong>{problemsTitle}</strong>
              <ul>
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
