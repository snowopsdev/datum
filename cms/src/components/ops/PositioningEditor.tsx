'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  type PositioningContent,
  positioningCompletenessProblems,
  positioningContentOf,
  positioningStatus,
} from '../../lib/tenant/positioning'
import { AssetStepper } from './AssetStepper'
import {
  POSITIONING_SECTION_COMPONENTS,
  POSITIONING_STEPS,
  type PositioningStepId,
} from './positioningSections'
import { savePositioningAction } from './tenantActions'
import './ops.css'

/** Which content keys each assist section is allowed to write. */
const SECTION_KEYS: Record<Exclude<PositioningStepId, 'review'>, (keyof PositioningContent)[]> = {
  core: ['category', 'goal', 'promise', 'activePosition', 'statement'],
  frame: ['macroFrame', 'landscape'],
  coreClaims: ['coreClaims'],
  pillars: ['pillars'],
  identity: ['enemy', 'archetype', 'essence'],
  language: ['descriptorLadder', 'vocabularyReachFor', 'vocabularyAvoid'],
  openRulings: ['openRulings'],
}

export function PositioningEditor({ initial }: { initial: PositioningContent }) {
  const router = useRouter()
  const [content, setContent] = useState(initial)
  const [step, setStep] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const problems = positioningCompletenessProblems(content)
  const status = positioningStatus(content)
  const current = POSITIONING_STEPS[step].id

  const save = () =>
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const result = await savePositioningAction(content)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage('Saved. The next run writes with this position.')
      router.refresh()
    })

  const applyAssist = (stepId: PositioningStepId, value: Record<string, unknown>) => {
    if (stepId === 'review') return
    const allowed = SECTION_KEYS[stepId]
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in value) patch[key] = value[key]
    }
    // Through the shared parser, so an assistant's stray field or malformed
    // row is cleaned exactly the way a saved document would be.
    setContent((prev) => positioningContentOf({ ...prev, ...patch }))
  }

  const Section = current === 'review' ? null : POSITIONING_SECTION_COMPONENTS[current]

  return (
    <AssetStepper<PositioningStepId>
      heading="Positioning"
      lede="What you are to the audience you just described. Nothing here blocks a run — whatever is filled in is injected, and the rest is left out."
      headerExtra={
        <>
          <span className={`datum-ops__status datum-ops__status--${status === 'ready' ? 'active' : 'draft'}`}>
            {status}
          </span>
          <Link className="datum-ops__link-btn" href="/admin/ops/setup" prefetch={false}>
            ← Setup
          </Link>
        </>
      }
      steps={POSITIONING_STEPS}
      step={step}
      onStep={setStep}
      asset="positioning"
      sectionValue={(stepId) => {
        if (stepId === 'review') return null
        const value: Record<string, unknown> = {}
        for (const key of SECTION_KEYS[stepId]) value[key] = content[key]
        return value
      }}
      onAssist={applyAssist}
      disabled={pending}
      problems={current === 'review' ? problems : []}
      problemsTitle="A finished position still needs"
      error={error}
      message={message}
      actions={
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--primary"
          onClick={save}
          disabled={pending}
        >
          Save
        </button>
      }
    >
      {Section ? (
        <Section content={content} onChange={setContent} disabled={pending} />
      ) : (
        <div className="datum-ops__panel-body">
          <p className="datum-ops__hint">
            {status === 'ready'
              ? 'Complete. Every generate and qualitative-review call carries this block.'
              : status === 'missing'
                ? 'Nothing saved yet. The positioning block is left out of prompts entirely until something is.'
                : 'Partial. What is filled in is already injected — this list is about sharpening, not unblocking.'}
          </p>
          <table className="datum-ops__table">
            <tbody>
              <tr>
                <th>Core claims</th>
                <td>{content.coreClaims.length}</td>
              </tr>
              <tr>
                <th>Pillars</th>
                <td>{content.pillars.length}</td>
              </tr>
              <tr>
                <th>Descriptor ladder</th>
                <td>{content.descriptorLadder.map((row) => row.descriptor).join(' → ') || '—'}</td>
              </tr>
              <tr>
                <th>Open rulings</th>
                <td>{content.openRulings.filter((row) => row.status === 'open').length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </AssetStepper>
  )
}
