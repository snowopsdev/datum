'use client'

import type { TextFieldClientProps } from 'payload'

import { FieldLabel, useField } from '@payloadcms/ui'
import React, { useState } from 'react'

import './ops.css'

/**
 * The webhook signing secret, off screen by default.
 *
 * Everything else in this global is configuration someone reads aloud in a
 * handover; the secret is the one value that authenticates us to the
 * receiver, and the settings page is the sort of screen that ends up on a
 * shared screen or a screenshot. So it renders as a password input with a
 * deliberate reveal, the same bargain a password manager makes.
 *
 * The value itself stays readable to the API: every reader
 * (`lib/articleEvents.ts`, `jobs/webhookDeliver.ts`, `app/hooks/revalidate`)
 * goes through `payload.findGlobal`, and a blank secret is documented to fall
 * back to `WEBHOOK_SECRET`. Masking here is about the screen, not the wire —
 * see docs/operations.md for what actually protects the endpoint.
 */
export function SecretField(props: TextFieldClientProps) {
  const { field, path: pathFromProps, readOnly } = props
  const { path, setValue, value } = useField<string>({ path: pathFromProps })
  const [revealed, setRevealed] = useState(false)
  const id = `field-${path.replace(/\./g, '__')}`
  const description = field?.admin?.description
  const label = field?.label

  return (
    <div className="field-type text datum-secret-field">
      <FieldLabel htmlFor={id} label={label} required={field?.required} />
      <div className="field-type__wrap datum-secret-field__wrap">
        <input
          autoComplete="off"
          className="datum-secret-field__input"
          disabled={Boolean(readOnly)}
          id={id}
          name={path}
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
          type={revealed ? 'text' : 'password'}
          value={value ?? ''}
        />
        <button
          aria-pressed={revealed}
          className="datum-secret-field__toggle"
          onClick={() => setRevealed((shown) => !shown)}
          type="button"
        >
          {revealed ? 'Hide secret' : 'Show secret'}
        </button>
      </div>
      {typeof description === 'string' ? (
        <div className="field-description">{description}</div>
      ) : null}
    </div>
  )
}
