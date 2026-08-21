'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState, useTransition } from 'react'

import { saveTemplateConfigAction } from './templateActions'
import type { TemplateConfigDTO } from './templateTypes'
import './ops.css'

type Tab = 'outline' | 'rules' | 'seo' | 'examples'

type Props = {
  templates: TemplateConfigDTO[]
  initialId: number | null
}

export function TemplateConfigEditor({ templates, initialId }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<number | null>(
    initialId ?? templates[0]?.id ?? null,
  )
  const [tab, setTab] = useState<Tab>('outline')
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  )

  const [outline, setOutline] = useState(selected?.outline ?? '')
  const [example, setExample] = useState(selected?.example ?? '')
  const [dos, setDos] = useState((selected?.dos ?? []).join('\n'))
  const [donts, setDonts] = useState((selected?.donts ?? []).join('\n'))
  const [requiredSections, setRequiredSections] = useState(
    (selected?.requiredSections ?? []).join('\n'),
  )
  const [seo, setSeo] = useState(
    selected?.seoSpec ?? {
      titleTagMaxLength: 60,
      metaDescriptionMaxLength: 160,
      headingStructureRules: '',
      faqRequired: true,
      faqMinQuestions: 3,
      faqMaxQuestions: 6,
      ogTagsRequired: true,
    },
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadTemplate = (t: TemplateConfigDTO) => {
    setSelectedId(t.id)
    setOutline(t.outline)
    setExample(t.example)
    setDos(t.dos.join('\n'))
    setDonts(t.donts.join('\n'))
    setRequiredSections(t.requiredSections.join('\n'))
    setSeo(t.seoSpec)
    setMessage(null)
    setError(null)
    router.replace(`/admin/ops/templates?id=${t.id}`)
  }

  const save = () => {
    if (!selected) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        await saveTemplateConfigAction(selected.id, {
          outline,
          example,
          dos: dos.split('\n'),
          donts: donts.split('\n'),
          requiredSections: requiredSections.split('\n'),
          seoSpec: seo,
        })
        setMessage(`Saved ${selected.name}`)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  if (!selected) {
    return (
      <div className="datum-ops">
        <h1>Templates</h1>
        <p className="datum-ops__lede">No templates seeded yet. Run the CMS seed script.</p>
      </div>
    )
  }

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Templates</h1>
        <span className="datum-ops__pill">config</span>
      </div>
      <p className="datum-ops__lede">
        Rarer config work — tabs for outline, rules, SEO, and examples. Required H2s and seoSpec
        feed structural QA.
      </p>

      <div className="datum-ops__tpl">
        <aside className="datum-ops__tpl-list">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === selected.id ? 'is-active' : undefined}
              onClick={() => loadTemplate(t)}
            >
              {t.name}
              <span>
                {t.requiredSections.length} required H2
                {t.requiredSections.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </aside>

        <div className="datum-ops__tpl-editor">
          <div className="datum-ops__tabs">
            {(
              [
                ['outline', 'Outline'],
                ['rules', 'Rules'],
                ['seo', 'SEO'],
                ['examples', 'Examples'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'is-active' : undefined}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="datum-ops__tab-panel">
            <h2>
              {selected.name} · {tab}
            </h2>
            {error ? <p className="datum-ops__error">{error}</p> : null}
            {message ? <p className="datum-ops__ok">{message}</p> : null}

            {tab === 'outline' ? (
              <>
                <p className="datum-ops__sub">
                  Prose guidance for generate — not enforced directly. One line per block; use # /
                  ## / ### for headings.
                </p>
                <div className="datum-ops__field">
                  <label htmlFor="outline">Outline</label>
                  <textarea
                    id="outline"
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    disabled={pending}
                    style={{ minHeight: 200 }}
                  />
                </div>
              </>
            ) : null}

            {tab === 'rules' ? (
              <>
                <p className="datum-ops__sub">
                  Dos/don’ts feed generate + qualitative review. Required sections are enforced by
                  structural QA.
                </p>
                <div className="datum-ops__field">
                  <label htmlFor="dos">Dos (one per line)</label>
                  <textarea
                    id="dos"
                    value={dos}
                    onChange={(e) => setDos(e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="datum-ops__field">
                  <label htmlFor="donts">Don’ts (one per line)</label>
                  <textarea
                    id="donts"
                    value={donts}
                    onChange={(e) => setDonts(e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="datum-ops__field">
                  <label htmlFor="req">Required H2 sections (one per line)</label>
                  <textarea
                    id="req"
                    value={requiredSections}
                    onChange={(e) => setRequiredSections(e.target.value)}
                    disabled={pending}
                  />
                </div>
              </>
            ) : null}

            {tab === 'seo' ? (
              <>
                <div className="datum-ops__metrics">
                  <div className="datum-ops__field">
                    <label htmlFor="titleMax">Title max</label>
                    <input
                      id="titleMax"
                      type="number"
                      value={seo.titleTagMaxLength ?? ''}
                      onChange={(e) =>
                        setSeo({
                          ...seo,
                          titleTagMaxLength: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      disabled={pending}
                    />
                  </div>
                  <div className="datum-ops__field">
                    <label htmlFor="metaMax">Meta max</label>
                    <input
                      id="metaMax"
                      type="number"
                      value={seo.metaDescriptionMaxLength ?? ''}
                      onChange={(e) =>
                        setSeo({
                          ...seo,
                          metaDescriptionMaxLength:
                            e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      disabled={pending}
                    />
                  </div>
                  <div className="datum-ops__field">
                    <label htmlFor="faqMin">FAQ min</label>
                    <input
                      id="faqMin"
                      type="number"
                      value={seo.faqMinQuestions ?? ''}
                      onChange={(e) =>
                        setSeo({
                          ...seo,
                          faqMinQuestions: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      disabled={pending}
                    />
                  </div>
                  <div className="datum-ops__field">
                    <label htmlFor="faqMax">FAQ max</label>
                    <input
                      id="faqMax"
                      type="number"
                      value={seo.faqMaxQuestions ?? ''}
                      onChange={(e) =>
                        setSeo({
                          ...seo,
                          faqMaxQuestions: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      disabled={pending}
                    />
                  </div>
                </div>
                <div className="datum-ops__field">
                  <label>
                    <input
                      type="checkbox"
                      checked={seo.faqRequired}
                      onChange={(e) => setSeo({ ...seo, faqRequired: e.target.checked })}
                      disabled={pending}
                    />{' '}
                    FAQ required
                  </label>
                </div>
                <div className="datum-ops__field">
                  <label>
                    <input
                      type="checkbox"
                      checked={seo.ogTagsRequired}
                      onChange={(e) => setSeo({ ...seo, ogTagsRequired: e.target.checked })}
                      disabled={pending}
                    />{' '}
                    OG tags required
                  </label>
                </div>
                <div className="datum-ops__field">
                  <label htmlFor="headingRules">Heading structure rules</label>
                  <textarea
                    id="headingRules"
                    value={seo.headingStructureRules}
                    onChange={(e) => setSeo({ ...seo, headingStructureRules: e.target.value })}
                    disabled={pending}
                  />
                </div>
              </>
            ) : null}

            {tab === 'examples' ? (
              <>
                <p className="datum-ops__sub">Canonical example guidance for the generate prompt.</p>
                <div className="datum-ops__field">
                  <label htmlFor="example">Example</label>
                  <textarea
                    id="example"
                    value={example}
                    onChange={(e) => setExample(e.target.value)}
                    disabled={pending}
                    style={{ minHeight: 180 }}
                  />
                </div>
              </>
            ) : null}

            <div className="datum-ops__actions">
              <button
                type="button"
                className="datum-ops__btn datum-ops__btn--primary"
                disabled={pending}
                onClick={save}
              >
                Save config
              </button>
              <Link className="datum-ops__btn" href={selected.editHref} prefetch={false}>
                Open in admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
