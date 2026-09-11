'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { startContentRunAction } from './contentRunActions'

type Props = {
  templates: Array<{ id: number; name: string }>
  mode: 'mock' | 'live'
  pipelineReady: boolean
  runActive: boolean
  /** Preselects a template, e.g. the one the caller was already looking at. */
  selectedTemplateId?: number
}

export function ContentRunForm({
  templates,
  mode,
  pipelineReady,
  runActive,
  selectedTemplateId,
}: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState(selectedTemplateId ?? templates[0]?.id ?? 0)
  const [count, setCount] = useState(1)
  const [confirmLiveCost, setConfirmLiveCost] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const disabled = !pipelineReady || runActive

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await startContentRunAction({
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
        {pending ? 'Queuing…' : 'Find gaps and research them'}
      </button>
      {message ? (
        <p className="datum-ops__form-message" role="status">
          {message}
        </p>
      ) : null}
    </form>
  )
}
