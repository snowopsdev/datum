'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { startContentRunAction } from './contentRunActions'

type Props = {
  source: 'onboarding' | 'admin'
  templates: Array<{ id: number; name: string }>
  mode: 'mock' | 'live'
  disabled?: boolean
}

export function ContentRunForm({ source, templates, mode, disabled = false }: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 0)
  const [count, setCount] = useState(source === 'onboarding' ? 1 : 1)
  const [confirmLiveCost, setConfirmLiveCost] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await startContentRunAction({
        source,
        templateId,
        count,
        confirmLiveCost,
      })
      setMessage(result.ok ? `Run ${result.runId.slice(0, 8)} queued.` : result.error)
      if (result.ok) router.refresh()
    })
  }

  return (
    <form className="datum-ops__run-form" onSubmit={submit}>
      <label>
        <span>Content template</span>
        <select
          disabled={pending || disabled}
          onChange={(event) => setTemplateId(Number(event.target.value))}
          required
          value={templateId}
        >
          {templates.length === 0 ? <option value="">Create a template first</option> : null}
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      {source === 'admin' ? (
        <label>
          <span>Topics</span>
          <select
            disabled={pending || disabled}
            onChange={(event) => setCount(Number(event.target.value))}
            value={count}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {mode === 'live' ? (
        <label className="datum-ops__cost-confirm">
          <input
            checked={confirmLiveCost}
            disabled={pending || disabled}
            onChange={(event) => setConfirmLiveCost(event.target.checked)}
            type="checkbox"
          />
          <span>I understand this run uses paid live providers.</span>
        </label>
      ) : null}
      <button
        className="datum-ops__primary-action"
        disabled={pending || disabled || templates.length === 0}
        type="submit"
      >
        {pending
          ? 'Queuing…'
          : source === 'onboarding'
            ? 'Run verification demo'
            : 'Discover and run'}
      </button>
      {message ? (
        <p className="datum-ops__form-message" role="status">
          {message}
        </p>
      ) : null}
    </form>
  )
}
