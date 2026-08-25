'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  type BrandVoiceContent,
  brandVoiceActivationProblems,
  emptyBrandVoiceContent,
} from '../../lib/brandVoice'
import { AuditTimeline } from './AuditTimeline'
import {
  activateBrandVoiceAction,
  archiveBrandVoiceAction,
  createBrandVoiceDraftAction,
  deleteDraftAction,
  extractBrandVoiceFromUploadAction,
  saveBrandVoiceDraftAction,
} from './brandVoiceActions'
import { BrandVoiceGuide } from './BrandVoiceGuide'
import {
  AdjectivesSection,
  AudienceSection,
  EssenceSection,
  NotTraitsSection,
  PersonaSection,
  SamplesSection,
  SECTION_COMPONENTS,
  ToneSection,
  ValuesSection,
  WordsSection,
} from './brandVoiceSections'
import {
  type BrandVoiceAuditEntry,
  type BrandVoiceDTO,
  type BrandVoiceMode,
  STEP_COUNT,
  STEPS,
} from './brandVoiceTypes'
import './ops.css'

const VIEW_PATH = '/admin/ops/governance/brand-voice'

type Tab = 'essence' | 'audience' | 'voice' | 'boundaries' | 'samples' | 'guide' | 'history'

const TABS: [Tab, string][] = [
  ['essence', 'Essence & values'],
  ['audience', 'Audience & persona'],
  ['voice', 'Voice chart'],
  ['boundaries', 'Boundaries & words'],
  ['samples', 'Samples'],
  ['guide', 'Guide'],
  ['history', 'History'],
]

type Props = {
  records: BrandVoiceDTO[]
  selectedId: number | null
  auditEntries: BrandVoiceAuditEntry[]
  initialMode: BrandVoiceMode | null
}

type Screen = 'empty' | 'onboarding' | 'review'

function contentOf(record: BrandVoiceDTO | null): BrandVoiceContent {
  if (!record) return emptyBrandVoiceContent()
  const {
    id: _id,
    status: _status,
    source: _source,
    onboardingStep: _step,
    activatedAt: _at,
    activatedBy: _by,
    sourceFile: _file,
    updatedAt: _updated,
    editHref: _href,
    ...content
  } = record
  return content
}

function clampStep(step: number | null | undefined): number {
  return Math.max(0, Math.min(STEP_COUNT - 1, step ?? 0))
}

function EntryCards({
  onStart,
  onUpload,
  disabled,
  compact,
}: {
  onStart: () => void
  onUpload: (file: File) => void
  disabled: boolean
  compact?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const inputId = compact ? 'bv-upload-compact' : 'bv-upload'
  return (
    <div className={`datum-ops__entry-cards${compact ? ' is-compact' : ''}`}>
      <div className="datum-ops__entry-card">
        <div className="datum-ops__entry-card-head">
          <h3>Upload an existing guide</h3>
          <span className="datum-ops__pill">one extraction call</span>
        </div>
        <p>
          Already have a brand book, tone-of-voice doc, or style guide? Drop it in and we extract the
          same fields for you to review before anything goes live.
        </p>
        <label htmlFor={inputId} className="datum-ops__hint">
          Choose a brand guide file
        </label>
        <input
          id={inputId}
          type="file"
          accept=".md,.txt,.pdf,.docx"
          disabled={disabled}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="datum-ops__actions">
          <button
            type="button"
            className="datum-ops__btn datum-ops__btn--primary"
            onClick={() => file && onUpload(file)}
            disabled={disabled || !file}
          >
            {disabled ? 'Extracting…' : 'Upload & extract'}
          </button>
          <span className="datum-ops__hint">.md, .txt, .pdf, .docx · up to 10 MB</span>
        </div>
      </div>
      <div className="datum-ops__entry-card">
        <div className="datum-ops__entry-card-head">
          <h3>Start onboarding</h3>
          <span className="datum-ops__pill">{STEP_COUNT} short steps</span>
        </div>
        <p>
          Answer nine questions about who you are, who you write for, and how you sound. Save a
          draft at any point and come back later.
        </p>
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--primary"
          onClick={onStart}
          disabled={disabled}
        >
          Start onboarding
        </button>
      </div>
    </div>
  )
}

export function BrandVoiceEditor({ records, selectedId, auditEntries, initialMode }: Props) {
  const router = useRouter()
  const selected = records.find((r) => r.id === selectedId) ?? null

  const [screen, setScreen] = useState<Screen>(() => {
    if (initialMode === 'onboarding') return 'onboarding'
    if (initialMode === 'review' || initialMode === 'guide') return records.length ? 'review' : 'empty'
    return records.length ? 'review' : 'empty'
  })
  const [tab, setTab] = useState<Tab>(initialMode === 'guide' ? 'guide' : 'essence')
  const [seenSelectedId, setSeenSelectedId] = useState(selectedId)
  const [workingId, setWorkingId] = useState<number | null>(selectedId)
  const [content, setContent] = useState<BrandVoiceContent>(() => contentOf(selected))
  const [step, setStep] = useState(() => clampStep(selected?.onboardingStep))
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reload the working copy only when the server-selected record changes.
  if (selectedId !== seenSelectedId) {
    setSeenSelectedId(selectedId)
    setWorkingId(selectedId)
    setContent(contentOf(selected))
    setStep(clampStep(selected?.onboardingStep))
    setConfirmDelete(false)
  }

  const working = records.find((r) => r.id === workingId) ?? null
  const hasDraft = records.some((r) => r.status === 'draft')
  const problems = brandVoiceActivationProblems(content)

  const run = (fn: () => Promise<void>) => {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      }
    })
  }

  /** Create or update the working record; returns its id. */
  const persist = async (completedSteps: number, nextMode: BrandVoiceMode): Promise<number> => {
    const onboardingStep = Math.max(working?.onboardingStep ?? 0, completedSteps)
    if (workingId == null) {
      const { id } = await createBrandVoiceDraftAction({ ...content, onboardingStep })
      setWorkingId(id)
      router.replace(`${VIEW_PATH}?id=${id}&mode=${nextMode}`)
      return id
    }
    await saveBrandVoiceDraftAction(workingId, { ...content, onboardingStep })
    router.refresh()
    return workingId
  }

  const startOnboarding = () => {
    setWorkingId(null)
    setContent(emptyBrandVoiceContent())
    setStep(0)
    setMessage(null)
    setError(null)
    setScreen('onboarding')
  }

  const uploadGuide = (file: File) =>
    run(async () => {
      const formData = new FormData()
      formData.set('file', file)
      const result = await extractBrandVoiceFromUploadAction(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage(
        result.warnings.length
          ? `Extracted "${file.name}" into a draft. Review it — ${result.warnings.join('; ')}.`
          : `Extracted "${file.name}" into a draft. Review every section, then activate.`,
      )
      setScreen('review')
      setTab('essence')
      router.replace(`${VIEW_PATH}?id=${result.id}&mode=review`)
      router.refresh()
    })

  const openRecord = (record: BrandVoiceDTO, nextTab: Tab = 'essence') => {
    setMessage(null)
    setError(null)
    setTab(nextTab)
    setConfirmDelete(false)
    if (record.status === 'draft' && record.source === 'onboarding' && record.onboardingStep < STEP_COUNT) {
      setScreen('onboarding')
      router.replace(`${VIEW_PATH}?id=${record.id}&mode=onboarding`)
    } else {
      setScreen('review')
      router.replace(`${VIEW_PATH}?id=${record.id}&mode=review`)
    }
  }

  const goToReview = (id: number) => {
    setScreen('review')
    setTab('essence')
    router.replace(`${VIEW_PATH}?id=${id}&mode=review`)
  }

  // ------------------------------------------------------------------ empty
  if (screen === 'empty') {
    return (
      <div className="datum-ops">
        <div className="datum-ops__header">
          <h1>Brand voice</h1>
          <span className="datum-ops__pill">governance</span>
        </div>
        <p className="datum-ops__lede">
          One voice for the whole workspace. Every generated title, description, FAQ, and body is
          written in it and checked against it. Start by telling us who you are.
        </p>
        {error ? <p className="datum-ops__error">{error}</p> : null}
        <EntryCards onStart={startOnboarding} onUpload={uploadGuide} disabled={pending} />
      </div>
    )
  }

  // ------------------------------------------------------------- onboarding
  if (screen === 'onboarding') {
    const current = STEPS[step]
    const Section = SECTION_COMPONENTS[current.id]
    const isLast = step === STEP_COUNT - 1

    const next = () =>
      run(async () => {
        const completed = step + 1
        const id = await persist(completed, isLast ? 'review' : 'onboarding')
        if (isLast) {
          setMessage('Onboarding complete — review your answers, then activate.')
          goToReview(id)
        } else {
          setStep(completed)
        }
      })
    const saveDraft = () =>
      run(async () => {
        await persist(step, 'onboarding')
        setMessage('Draft saved. You can come back to this step later.')
      })
    const skipToReview = () =>
      run(async () => {
        const id = await persist(step, 'review')
        goToReview(id)
      })

    return (
      <div className="datum-ops">
        <div className="datum-ops__header">
          <h1>Brand voice onboarding</h1>
          <span className="datum-ops__pill">
            step {step + 1} of {STEP_COUNT}
          </span>
          {working ? (
            <span className={`datum-ops__status datum-ops__status--${working.status}`}>
              {working.status}
            </span>
          ) : null}
        </div>
        <p className="datum-ops__lede">
          {working ? working.name || 'Untitled brand voice' : 'New brand voice'} · answers save as a
          draft; nothing governs the pipeline until you activate it.
        </p>

        <div className="datum-ops__stepper">
          <ol className="datum-ops__progress" aria-label="Onboarding progress">
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                className={`datum-ops__progress-seg${i < step ? ' is-done' : ''}${
                  i === step ? ' is-current' : ''
                }`}
              >
                <button type="button" onClick={() => setStep(i)} disabled={pending} title={s.title}>
                  <span className="datum-ops__progress-num">{i + 1}</span>
                  <span className="datum-ops__progress-label">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="datum-ops__step">
            <h2>{current.title}</h2>
            <p className="datum-ops__sub">{current.blurb}</p>
            {error ? <p className="datum-ops__error">{error}</p> : null}
            {message ? <p className="datum-ops__ok">{message}</p> : null}

            <Section content={content} onChange={setContent} disabled={pending} />

            <div className="datum-ops__step-actions">
              <div className="datum-ops__actions">
                <button
                  type="button"
                  className="datum-ops__btn"
                  onClick={() => setStep(step - 1)}
                  disabled={pending || step === 0}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--primary"
                  onClick={next}
                  disabled={pending}
                >
                  {isLast ? 'Finish & review' : 'Next →'}
                </button>
              </div>
              <div className="datum-ops__actions">
                <button type="button" className="datum-ops__btn" onClick={saveDraft} disabled={pending}>
                  Save draft
                </button>
                <button
                  type="button"
                  className="datum-ops__link-btn"
                  onClick={skipToReview}
                  disabled={pending}
                >
                  Skip to review
                </button>
                {records.length ? (
                  <button
                    type="button"
                    className="datum-ops__link-btn"
                    onClick={() => {
                      setScreen('review')
                      if (selected) router.replace(`${VIEW_PATH}?id=${selected.id}&mode=review`)
                    }}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------- review
  const record = working ?? selected
  if (!record) {
    return (
      <div className="datum-ops">
        <div className="datum-ops__header">
          <h1>Brand voice</h1>
        </div>
        <EntryCards onStart={startOnboarding} onUpload={uploadGuide} disabled={pending} />
      </div>
    )
  }

  const save = () =>
    run(async () => {
      await persist(record.onboardingStep, 'review')
      setMessage(`Saved ${content.name || 'brand voice'}`)
    })
  const activate = () =>
    run(async () => {
      const id = await persist(STEP_COUNT, 'review')
      const result = await activateBrandVoiceAction(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage(`${content.name || 'Brand voice'} is now active and governs every pipeline run.`)
      router.refresh()
    })
  const archive = () =>
    run(async () => {
      await archiveBrandVoiceAction(record.id)
      setMessage('Archived. The pipeline runs on the platform style guide alone until you activate another voice.')
      router.refresh()
    })
  const remove = () =>
    run(async () => {
      await deleteDraftAction(record.id)
      setConfirmDelete(false)
      router.replace(VIEW_PATH)
      router.refresh()
    })

  const grouped: [string, BrandVoiceDTO[]][] = [
    ['Draft', records.filter((r) => r.status === 'draft')],
    ['Active', records.filter((r) => r.status === 'active')],
    ['Archived', records.filter((r) => r.status === 'archived')],
  ]

  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Brand voice</h1>
        <span className="datum-ops__pill">governance</span>
        <span className={`datum-ops__status datum-ops__status--${record.status}`}>{record.status}</span>
      </div>
      <p className="datum-ops__lede">
        The active voice is injected into every generate and QA call. Banned words hard-fail
        structural QA; persona, values, and boundaries steer the qualitative review.
      </p>

      <div className="datum-ops__tpl datum-ops__bv">
        <aside className="datum-ops__tpl-list">
          {grouped.map(([label, group]) =>
            group.length ? (
              <div key={label} className="datum-ops__tpl-group">
                <div className="datum-ops__tpl-group-label">{label}</div>
                {group.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={r.id === record.id ? 'is-active' : undefined}
                    onClick={() => openRecord(r)}
                  >
                    {r.name || 'Untitled brand voice'}
                    <span>
                      {r.source}
                      {r.status === 'draft' && r.onboardingStep < STEP_COUNT
                        ? ` · step ${r.onboardingStep + 1} of ${STEP_COUNT}`
                        : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null,
          )}
          {!hasDraft ? (
            <div className="datum-ops__tpl-new">
              <div className="datum-ops__tpl-group-label">Replace this voice</div>
              <EntryCards onStart={startOnboarding} onUpload={uploadGuide} disabled={pending} compact />
            </div>
          ) : null}
        </aside>

        <div className="datum-ops__tpl-editor">
          <div className="datum-ops__tabs">
            {TABS.map(([id, label]) => (
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

          <div className="datum-ops__tab-panel datum-ops__tab-panel--wide">
            {tab !== 'guide' && tab !== 'history' ? (
              <h2>
                {record.name || 'Untitled brand voice'} · {TABS.find(([id]) => id === tab)?.[1]}
              </h2>
            ) : null}
            {error ? <p className="datum-ops__error">{error}</p> : null}
            {message ? <p className="datum-ops__ok">{message}</p> : null}

            {tab === 'essence' ? (
              <>
                <EssenceSection content={content} onChange={setContent} disabled={pending} />
                <h3 className="datum-ops__section-title">Core values</h3>
                <ValuesSection content={content} onChange={setContent} disabled={pending} />
              </>
            ) : null}
            {tab === 'audience' ? (
              <>
                <AudienceSection content={content} onChange={setContent} disabled={pending} />
                <h3 className="datum-ops__section-title">Human persona</h3>
                <PersonaSection content={content} onChange={setContent} disabled={pending} />
              </>
            ) : null}
            {tab === 'voice' ? (
              <AdjectivesSection content={content} onChange={setContent} disabled={pending} />
            ) : null}
            {tab === 'boundaries' ? (
              <>
                <h3 className="datum-ops__section-title">What we are NOT</h3>
                <NotTraitsSection content={content} onChange={setContent} disabled={pending} />
                <h3 className="datum-ops__section-title">Tone dials</h3>
                <ToneSection content={content} onChange={setContent} disabled={pending} />
                <WordsSection content={content} onChange={setContent} disabled={pending} />
              </>
            ) : null}
            {tab === 'samples' ? (
              <SamplesSection content={content} onChange={setContent} disabled={pending} />
            ) : null}
            {tab === 'guide' ? <BrandVoiceGuide content={content} record={record} /> : null}
            {tab === 'history' ? (
              <AuditTimeline
                entries={auditEntries}
                title="History"
                blurb="Append-only record of who changed this brand voice, when, and what changed."
                emptyText="No events recorded for this brand voice yet."
              />
            ) : null}

            {tab !== 'guide' && tab !== 'history' ? (
              <div className="datum-ops__review-footer">
                {problems.length ? (
                  <div className="datum-ops__checklist">
                    <strong>
                      {record.status === 'active'
                        ? 'Fix before saving — an active voice must stay complete'
                        : 'Before you can activate'}
                    </strong>
                    <ul>
                      {problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="datum-ops__actions">
                  <button
                    type="button"
                    className="datum-ops__btn datum-ops__btn--primary"
                    disabled={pending || (record.status === 'active' && problems.length > 0)}
                    onClick={save}
                  >
                    Save
                  </button>
                  {record.status !== 'active' ? (
                    <button
                      type="button"
                      className="datum-ops__btn datum-ops__btn--primary"
                      disabled={pending || problems.length > 0}
                      onClick={activate}
                    >
                      Activate
                    </button>
                  ) : (
                    <button type="button" className="datum-ops__btn" disabled={pending} onClick={archive}>
                      Archive
                    </button>
                  )}
                  {record.status === 'draft' ? (
                    confirmDelete ? (
                      <>
                        <button
                          type="button"
                          className="datum-ops__btn datum-ops__btn--danger"
                          disabled={pending}
                          onClick={remove}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          className="datum-ops__link-btn"
                          disabled={pending}
                          onClick={() => setConfirmDelete(false)}
                        >
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="datum-ops__link-btn"
                        disabled={pending}
                        onClick={() => setConfirmDelete(true)}
                      >
                        Delete draft
                      </button>
                    )
                  ) : null}
                  <Link className="datum-ops__btn" href={record.editHref} prefetch={false}>
                    Open in admin
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
