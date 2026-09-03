'use client'

import React from 'react'

import {
  type Confidence,
  CONFIDENCE_OPTIONS,
  CONFIDENCE_USAGE,
  CONFIDENCE_USAGE_HINT,
} from '../../lib/tenant/confidence'

/**
 * The one control every tenant asset uses to say how sure it is.
 *
 * The usage hint is not decoration: the level decides the grammar the writer
 * is allowed to use, so the person picking it is told what they are signing up
 * for at the moment they pick. Imported from `lib/tenant/confidence` directly
 * rather than the barrel, which pulls in `node:crypto`.
 */
export function ConfidenceSelect({
  id,
  value,
  onChange,
  disabled,
  label = 'Confidence',
}: {
  id: string
  value: Confidence | null
  onChange: (value: Confidence | null) => void
  disabled: boolean
  label?: string
}) {
  return (
    <div className="datum-ops__field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as Confidence | null)}
        disabled={disabled}
      >
        <option value="">Not set</option>
        {CONFIDENCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="datum-ops__hint">
        {value
          ? `The writer will ${CONFIDENCE_USAGE_HINT[CONFIDENCE_USAGE[value]]}.`
          : 'Unset reads as no instruction — the writer states it plainly.'}
      </p>
    </div>
  )
}
