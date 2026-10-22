'use client'

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState, useTransition } from 'react'

import {
  COMPANY_MENTIONS_OPTIONS,
  type CompanyMentions,
  DEFAULT_COMPANY_MENTIONS,
} from '../../lib/tenant/companyMentions'
import { LeaveDialog, RestoreNotice, SaveButton, UnsavedBar } from './DirtyGuardUi'
import { createTemplateAction, saveTemplateConfigAction } from './templateActions'
import type { TemplateConfigDTO } from './templateTypes'
import { useDirtyGuard } from './useDirtyGuard'
import './ops.css'

type Tab = 'outline' | 'rules' | 'seo' | 'examples'

type Props = {
  templates: TemplateConfigDTO[]
  initialId: number | null
}

/** Everything the Save button saves, in the shape the unsaved check compares. */
type TemplateForm = {
  outline: string
  example: string
  companyMentions: CompanyMentions
  dos: string[]
  donts: string[]
  requiredSections: string[]
  seoSpec: TemplateConfigDTO['seoSpec']
}

const DEFAULT_SEO: TemplateConfigDTO['seoSpec'] = {
  titleTagMaxLength: 60,
  metaDescriptionMaxLength: 160,
  headingStructureRules: '',
  faqRequired: true,
  faqMinQuestions: 3,
  faqMaxQuestions: 6,
  ogTagsRequired: true,
}

const FORM_LABELS = {
  outline: 'the outline',
  example: 'the example',
  companyMentions: 'company mentions',
  dos: 'the dos',
  donts: 'the don’ts',
  requiredSections: 'the required sections',
  seoSpec: 'the SEO limits',
}

/** One entry per non-blank line: what the save keeps, so a stray newline is not a change. */
const linesOf = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const formOf = (t: TemplateConfigDTO | null): TemplateForm => ({
  outline: t?.outline ?? '',
  example: t?.example ?? '',
  companyMentions: t?.companyMentions ?? DEFAULT_COMPANY_MENTIONS,
  dos: t?.dos ?? [],
  donts: t?.donts ?? [],
  requiredSections: t?.requiredSections ?? [],
  seoSpec: t?.seoSpec ?? DEFAULT_SEO,
})

export function TemplateConfigEditor({ templates, initialId }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<number | null>(initialId ?? templates[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('outline')
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  )

  const [outline, setOutline] = useState(selected?.outline ?? '')
  const [example, setExample] = useState(selected?.example ?? '')
  const [companyMentions, setCompanyMentions] = useState<CompanyMentions>(
    selected?.companyMentions ?? DEFAULT_COMPANY_MENTIONS,
  )
  const [dos, setDos] = useState((selected?.dos ?? []).join('\n'))
  const [donts, setDonts] = useState((selected?.donts ?? []).join('\n'))
  const [requiredSections, setRequiredSections] = useState(
    (selected?.requiredSections ?? []).join('\n'),
  )
  const [seo, setSeo] = useState(selected?.seoSpec ?? DEFAULT_SEO)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const applyForm = (form: TemplateForm) => {
    setOutline(form.outline)
    setExample(form.example)
    setCompanyMentions(form.companyMentions)
    setDos(form.dos.join('\n'))
    setDonts(form.donts.join('\n'))
    setRequiredSections(form.requiredSections.join('\n'))
    setSeo(form.seoSpec)
  }

  const form: TemplateForm = {
    outline,
    example,
    companyMentions,
    dos: linesOf(dos),
    donts: linesOf(donts),
    requiredSections: linesOf(requiredSections),
    seoSpec: seo,
  }

  const guard = useDirtyGuard<TemplateForm>({
    formKey: `template:${selected?.id ?? 'none'}`,
    value: form,
    initial: formOf(selected),
    version: selected?.updatedAt ?? null,
    onReset: applyForm,
    labels: FORM_LABELS,
    save: async (baseline) => {
      if (!selected) return null
      setError(null)
      try {
        const result = await saveTemplateConfigAction(selected.id, {
          // The outline and example go through a lossy plain-to-Lexical
          // conversion, so they are only sent when they actually changed.
          ...(form.outline !== baseline.outline ? { outline } : {}),
          ...(form.example !== baseline.example ? { example } : {}),
          companyMentions,
          dos: dos.split('\n'),
          donts: donts.split('\n'),
          requiredSections: requiredSections.split('\n'),
          seoSpec: seo,
        })
        // The textareas show what was stored, through the same mapping the
        // page reads it with: a blank line or padded outline is gone.
        const saved = formOf(result.template)
        applyForm(saved)
        toast.success(
          result.dropped > 0
            ? `Saved ${selected.name} · ${result.dropped} empty line${result.dropped === 1 ? '' : 's'} removed`
            : `Saved ${selected.name}`,
        )
        router.refresh()
        return { saved, version: result.updatedAt }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
        return null
      }
    },
  })

  const loadTemplate = (t: TemplateConfigDTO) => {
    setSelectedId(t.id)
    applyForm(formOf(t))
    setMessage(null)
    setError(null)
    router.replace(`/admin/ops/templates?id=${t.id}`)
  }

  const save = () =>
    startTransition(async () => {
      await guard.submit()
    })

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    // Creating one opens it, which would replace the edit in progress.
    guard.guardLeave(createNow)
  }

  const createNow = () => {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await createTemplateAction(newName)
      if (!result.ok) {
        setError(result.error)
        return
      }
      const created = result.template
      setNewName('')
      setAdding(false)
      // `loadTemplate` is what moves both the selection *and* every editor field.
      // Pushing the URL alone would not: this component does not remount, so
      // `initialId` is only read once and the panel would keep showing whichever
      // template was open when the form was submitted.
      loadTemplate(created)
      setMessage(`Created ${created.name}. Fill in its outline, rules and required sections below.`)
      router.refresh()
    })
  }

  const newTemplateForm = (
    <form className="datum-ops__tpl-new" onSubmit={create}>
      <label className="datum-ops__field">
        <span>Template name</span>
        <input
          autoFocus
          disabled={pending}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Product review"
          type="text"
          value={newName}
        />
      </label>
      <div className="datum-ops__row">
        <button
          className="datum-ops__btn datum-ops__btn--primary"
          disabled={pending || !newName.trim()}
          type="submit"
        >
          {pending ? 'Creating…' : 'Create template'}
        </button>
        <button
          className="datum-ops__link-btn"
          disabled={pending}
          onClick={() => {
            setAdding(false)
            setNewName('')
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
      <p className="datum-ops__hint">
        It starts empty. Add the outline, the dos and don&rsquo;ts, and the H2s QA should enforce —
        nothing is required before you can assign it to a topic.
      </p>
    </form>
  )

  if (!selected) {
    return (
      <div id="ops-main" tabIndex={-1} className="datum-ops">
        <div className="datum-ops__header">
          <h1>Templates</h1>
        </div>
        <p className="datum-ops__lede">
          A template decides the shape of an article — a how-to, a comparison, a ranked list — and
          QA checks every draft against it. You need at least one before the pipeline will touch a
          topic. <code>npm run seed</code> installs three worked examples, or start your own here.
        </p>
        {error ? (
          <p className="datum-ops__error" role="alert">
            {error}
          </p>
        ) : null}
        <section className="datum-ops__panel">
          <h2>New template</h2>
          <div className="datum-ops__panel-body">{newTemplateForm}</div>
        </section>
      </div>
    )
  }

  return (
    <div id="ops-main" tabIndex={-1} className="datum-ops">
      <div className="datum-ops__header">
        <h1>Templates</h1>
        <span className="datum-ops__pill">config</span>
      </div>
      <p className="datum-ops__lede">
        A template decides the shape of an article, and every draft is checked against it. Edit one
        below or add your own. <strong>Required sections</strong> and <strong>SEO</strong> limits
        are enforced on every draft. The outline and dos and don&rsquo;ts guide the writer.
      </p>
      <RestoreNotice guard={guard} />

      <div className="datum-ops__tpl">
        <aside className="datum-ops__tpl-list">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === selected.id ? 'is-active' : undefined}
              onClick={() => {
                if (t.id !== selected.id) guard.guardLeave(() => loadTemplate(t))
              }}
            >
              {t.name}
              <span>
                {t.requiredSections.length} required section
                {t.requiredSections.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          {adding ? (
            newTemplateForm
          ) : (
            <button
              className="datum-ops__tpl-add"
              disabled={pending}
              onClick={() => {
                setAdding(true)
                setMessage(null)
                setError(null)
              }}
              type="button"
            >
              + New template
            </button>
          )}
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
            {error ? (
              <p className="datum-ops__error" role="alert">
                {error}
              </p>
            ) : null}
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
                  <label htmlFor="companyMentions">Company mentions</label>
                  <select
                    id="companyMentions"
                    value={companyMentions}
                    onChange={(e) => setCompanyMentions(e.target.value as CompanyMentions)}
                    disabled={pending}
                  >
                    {COMPANY_MENTIONS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="datum-ops__hint">
                    {COMPANY_MENTIONS_OPTIONS.find((option) => option.value === companyMentions)?.hint}{' '}
                    The writer and the reviewer both get this rule. Your audience and positioning
                    shape every piece either way.
                  </p>
                </div>
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
                    Social sharing text required
                  </label>
                  <p className="datum-ops__hint">
                    Checks that the draft has a social title and description — the text shown when
                    someone shares the page. The social <em>image</em> is not checked: the writer
                    has no image to point at, so requiring one would fail every draft.
                  </p>
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
                <p className="datum-ops__sub">
                  Canonical example guidance for the generate prompt.
                </p>
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
              <SaveButton guard={guard} onClick={save} pending={pending} />
            </div>
          </div>
        </div>
      </div>
      <UnsavedBar guard={guard} onSave={save} pending={pending} />
      <LeaveDialog guard={guard} />
    </div>
  )
}
