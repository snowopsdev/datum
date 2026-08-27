'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { activateDefaultBrandVoiceAction } from './firstRunActions'
import './ops.css'

type Props = {
  hasVoice: boolean
  mode: 'mock' | 'live'
}

/**
 * The whole of onboarding: one decision, then make something.
 *
 * The old hub had four gates — environment variables, brand voice, templates,
 * and a mandatory verification run. Only the voice is a decision a content
 * person makes; templates are seeded, env vars belong to whoever deploys (the
 * runtime banner tells them), and a demo run is friction, not proof.
 */
export function FirstRun({ hasVoice, mode }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const useDefault = () => {
    setError(null)
    startTransition(async () => {
      const result = await activateDefaultBrandVoiceAction()
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="datum-ops datum-first">
      <p className="datum-ops__eyebrow">{hasVoice ? 'Ready' : 'One thing first'}</p>
      {hasVoice ? (
        <>
          <h1>Make your first piece</h1>
          <p className="datum-ops__lede">
            Pick the kind of piece and what it is about. Datum researches it, writes you a brief,
            and waits for your say-so before writing a word
            {mode === 'live' ? ' or paying a provider' : ''}.
          </p>
          <div className="datum-first__actions">
            <Link className="datum-ops__btn datum-ops__btn--primary" href="/admin/ops/new">
              New content
            </Link>
            <Link className="datum-ops__link-btn" href="/admin/ops/governance/brand-voice">
              Review the brand voice
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1>How should Datum sound?</h1>
          <p className="datum-ops__lede">
            Every draft is written and checked against a brand voice — who you are, who you write
            for, what you never say. Set yours up now, or start with the default and replace it
            whenever you like.
          </p>
          <div className="datum-first__cards">
            <Link className="datum-first__card" href="/admin/ops/governance/brand-voice">
              <strong>Set up your brand voice</strong>
              <span>
                Answer a few questions, or upload a brand guide and let Datum extract it. About ten
                minutes.
              </span>
            </Link>
            <button className="datum-first__card" disabled={pending} onClick={useDefault} type="button">
              <strong>{pending ? 'Activating…' : 'Start with the default voice'}</strong>
              <span>
                A plain, confident, no-hype voice for B2B software. Good enough to see how the
                pipeline works; easy to swap out.
              </span>
            </button>
          </div>
          {error ? <p className="datum-ops__error">{error}</p> : null}
        </>
      )}
    </main>
  )
}
