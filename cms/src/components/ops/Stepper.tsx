'use client'

import React from 'react'

import { CONTENT_STAGES, STAGE_LABEL, type StageInfo } from './articleStatus'
import './ops.css'

type Props = {
  current: StageInfo
  /** Compact for list rows; full shows the labels under every step. */
  size?: 'compact' | 'full'
}

/**
 * Where a piece is, on the five steps a person actually thinks in.
 *
 * Every internal status maps to one step (see `STATUS_STAGE`), so the same
 * component reads the same way in a list row and on the piece page. Colour
 * carries who has to act — blue for Datum, orange for you — because that is
 * the question a glance is asking.
 */
export function Stepper({ current, size = 'compact' }: Props) {
  return (
    <ol
      aria-label={`Stage ${current.step} of ${CONTENT_STAGES.length}: ${STAGE_LABEL[current.stage]}`}
      className={`datum-stepper datum-stepper--${size} datum-stepper--${current.owner}`}
    >
      {CONTENT_STAGES.map((stage, i) => {
        const step = i + 1
        const state = step < current.step ? 'done' : step === current.step ? 'current' : 'todo'
        return (
          <li
            aria-current={state === 'current' ? 'step' : undefined}
            className={`datum-stepper__step datum-stepper__step--${state}`}
            key={stage}
            title={STAGE_LABEL[stage]}
          >
            <span className="datum-stepper__dot" />
            {size === 'full' ? <span className="datum-stepper__label">{STAGE_LABEL[stage]}</span> : null}
          </li>
        )
      })}
    </ol>
  )
}
