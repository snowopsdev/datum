'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { ContentRunForm } from './ContentRunForm'
import { TopicDiscovery } from './TopicDiscovery'
import { createTopicsAction } from './topicDiscoveryActions'
import './ops.css'

export type TemplateCard = {
  id: number
  name: string
  intent: string | null
  requiredSections: number
}

type Props = {
  templates: TemplateCard[]
  mode: 'mock' | 'live'
  pipelineReady: boolean
  runActive: boolean
}

/**
 * "I want to make a…" — the intent-first way in.
 *
 * Three panels revealed in order, no wizard chrome: pick the kind of piece,
 * say what it is about, create. Creating queues research on its own; the
 * next thing the editor sees is the brief. Keywords are still how research
 * and scoring key the piece, but they are a means here, not the entry point.
 */
export function NewContentFlow({ templates, mode, pipelineReady, runActive }: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState<number | null>(templates.length === 1 ? templates[0].id : null)
  const [path, setPath] = useState<'suggest' | 'keyword'>('suggest')
  const [keyword, setKeyword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const chosen = templates.find((t) => t.id === templateId) ?? null

  const chooseWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % templates.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + templates.length) % templates.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = templates.length - 1
    else return
    event.preventDefault()
    setTemplateId(templates[next].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }

  const createFromKeyword = (event: React.FormEvent) => {
    event.preventDefault()
    if (!chosen) return
    setError(null)
    startTransition(async () => {
      const result = await createTopicsAction({ keywords: [keyword], templateId: chosen.id })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/admin/ops/articles/${result.articleId}`)
    })
  }

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>New content</h1>
        <Link className="datum-ops__btn" href="/admin/ops/content">
          Content
        </Link>
      </div>
      <p className="datum-ops__lede">
        Pick the kind of piece, say what it is about, and Datum researches it while you wait
        {mode === 'live' ? ' — that research alone calls paid services' : ''}. You approve a brief
        before a word of the piece itself is written.
      </p>

      <section className="datum-ops__panel">
        <h2>I want to make a…</h2>
        <div className="datum-ops__panel-body">
          {templates.length === 0 ? (
            <p className="datum-ops__hint">
              No templates yet. <Link href="/admin/ops/templates">Create one</Link> first — it
              decides the shape of the piece and what QA checks for.
            </p>
          ) : (
            <div className="datum-new__cards" role="radiogroup" aria-label="Kind of piece">
              {templates.map((t, index) => (
                <button
                  aria-checked={templateId === t.id}
                  className={`datum-new__card${templateId === t.id ? ' is-selected' : ''}`}
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  onKeyDown={(event) => chooseWithKeyboard(event, index)}
                  role="radio"
                  tabIndex={templateId === t.id || (templateId === null && index === 0) ? 0 : -1}
                  type="button"
                >
                  <strong>{t.name}</strong>
                  <span>{t.intent ?? 'No description yet — add one under Templates.'}</span>
                  <em>
                    {t.requiredSections} required section{t.requiredSections === 1 ? '' : 's'}
                  </em>
                </button>
              ))}
              <Link className="datum-new__card datum-new__card--add" href="/admin/ops/templates">
                <strong>+ New template</strong>
                <span>Define your own shape and rules.</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {chosen ? (
        <section className="datum-ops__panel">
          <h2>About…</h2>
          <div className="datum-ops__panel-body">
            <div className="datum-ops__tabs datum-ops__tabs--pills" role="tablist" style={{ display: 'inline-flex', marginBottom: 12 }}>
              <button aria-selected={path === 'suggest'} className={path === 'suggest' ? 'is-active' : undefined} onClick={() => setPath('suggest')} role="tab" type="button">
                Suggest topics
              </button>
              <button aria-selected={path === 'keyword'} className={path === 'keyword' ? 'is-active' : undefined} onClick={() => setPath('keyword')} role="tab" type="button">
                I know the keyword
              </button>
            </div>

            {path === 'suggest' ? (
              <TopicDiscovery mode={mode} templateId={chosen.id} templates={templates} />
            ) : (
              <form className="datum-ops__period" onSubmit={createFromKeyword}>
                <label className="datum-ops__field" style={{ flex: '1 1 320px', marginBottom: 0 }}>
                  <span>Keyword the piece should rank for</span>
                  <input
                    disabled={pending}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. espresso machine maintenance"
                    type="text"
                    value={keyword}
                  />
                </label>
                <button
                  className="datum-ops__btn datum-ops__btn--primary"
                  disabled={pending || !keyword.trim()}
                  type="submit"
                >
                  {pending ? 'Creating…' : `Create ${chosen.name.toLowerCase()}`}
                </button>
              </form>
            )}
            {error ? <p className="datum-ops__error">{error}</p> : null}
          </div>
        </section>
      ) : null}

      <details className="datum-ops__panel datum-new__auto">
        <summary>Or let Datum find gaps automatically</summary>
        <div className="datum-ops__panel-body">
          <p className="datum-ops__sub">
            Looks for keywords your competitors rank for and you do not, picks the best few, and
            researches them. Each one stops at its brief for you, like anything else.
          </p>
          {!pipelineReady ? (
            <p className="datum-ops__hint">
              <Link href="/admin">Finish workspace setup</Link> before starting this.
            </p>
          ) : null}
          <ContentRunForm disabled={!pipelineReady || runActive} mode={mode} source="admin" templates={templates} />
        </div>
      </details>
    </div>
  )
}
