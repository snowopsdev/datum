'use client'

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState, useTransition } from 'react'

import {
  type BrandVoiceContent,
  brandVoiceActivationProblems,
  emptyBrandVoiceContent,
} from '../../lib/brandVoice'
import { AssetStepper } from './AssetStepper'
import { SaveButton } from './DirtyGuardUi'
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
import { SECTION_COMPONENTS } from './brandVoiceSections'
import {
  type BrandVoiceAuditEntry,
  type BrandVoiceDTO,
  type BrandVoiceMode,
  type BrandVoiceStepId,
  BRAND_VOICE_STEPS,
  GUIDE_STEP,
  REVIEW_STEP,
  STEP_COUNT,
} from './brandVoiceTypes'
import { SuggestionEditorContext } from './SetupSuggestions'
import type { SetupSuggestionDTO } from './suggestionTypes'
import { useDirtyGuard } from './useDirtyGuard'
import './ops.css'

const VIEW_PATH = '/admin/ops/setup/brand-voice'

const LEDE =
  'One voice for the whole workspace. Every generated title, description, FAQ, and body is written in it and checked against it. Nothing changes how Datum writes until you activate it.'

type Props = {
  suggestion?: SetupSuggestionDTO | null
  records: BrandVoiceDTO[]
  selectedId: number | null
  auditEntries: BrandVoiceAuditEntry[]
  initialMode: BrandVoiceMode | null
}

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
    ...content
  } = record
  return content
}

/** A stored `onboardingStep` only ever addresses one of the nine questions. */
function clampQuestion(step: number | null | undefined): number {
  return Math.max(0, Math.min(STEP_COUNT - 1, step ?? 0))
}

/**
 * Where the rail opens.
 *
 * A draft that stopped mid-interview resumes where it stopped; anything
 * already answered through to the end opens on the review gate, which is the
 * question someone returning to a finished voice is actually asking. `?mode=`
 * from a link wins over both.
 */
function initialStep(record: BrandVoiceDTO | null, mode: BrandVoiceMode | null): number {
  if (mode === 'guide') return GUIDE_STEP
  if (mode === 'review') return REVIEW_STEP
  if (mode === 'onboarding') return clampQuestion(record?.onboardingStep)
  if (record && record.status === 'draft' && record.onboardingStep < STEP_COUNT) {
    return clampQuestion(record.onboardingStep)
  }
  return REVIEW_STEP
}

/** The `?mode=` that names a rail position, so a reload lands back on it. */
function modeOf(step: number): BrandVoiceMode {
  if (step === GUIDE_STEP) return 'guide'
  if (step >= REVIEW_STEP) return 'review'
  return 'onboarding'
}

function recordLabel(record: BrandVoiceDTO): string {
  const name = record.name || 'Untitled brand voice'
  const progress =
    record.status === 'draft' && record.onboardingStep < STEP_COUNT
      ? ` · question ${record.onboardingStep + 1} of ${STEP_COUNT}`
      : ''
  return `${name} · ${record.status} · ${record.source}${progress}`
}

function EntryCards({
  onStart,
  onUpload,
  disabled,
}: {
  onStart: () => void
  onUpload: (file: File) => void
  disabled: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const inputId = 'bv-upload'
  return (
    <div className="datum-ops__entry-cards">
      <div className="datum-ops__entry-card">
        <div className="datum-ops__entry-card-head">
          <h3>Upload an existing guide</h3>
          <span className="datum-ops__pill">one extraction call</span>
        </div>
        <p>
          Already have a brand book, tone-of-voice doc, or style guide? Drop it in and we extract
          the same fields for you to review before anything goes live.
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

/** The review gate: what the voice says, and what still blocks activation. */
function BrandVoiceReview({
  content,
  problems,
  status,
  problemsTitle,
}: {
  content: BrandVoiceContent
  problems: string[]
  status: BrandVoiceDTO['status']
  problemsTitle: string
}) {
  const counts: [string, number | string][] = [
    ['Core values', content.coreValues.filter((v) => v.value).length],
    ['Adjectives', content.voiceAdjectives.filter((a) => a.adjective).length],
    ['Boundaries', content.notTraits.filter((t) => t.trait).length],
    ['Banned words', content.bannedWords.filter((w) => w.word.trim()).length],
    ['Samples', content.samples.filter((s) => s.text.trim()).length],
    ['Status', status],
  ]
  return (
    <div className="datum-ops__panel-body">
      <p className="datum-ops__hint">
        {problems.length === 0
          ? 'Complete. Activating it makes every pipeline run write and check against this voice.'
          : 'A voice can be saved at any point. It can only be activated once these are answered.'}
      </p>
      <table className="datum-ops__table">
        <tbody>
          {counts.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {problems.length ? (
        <div className="datum-ops__checklist">
          <strong>{problemsTitle}</strong>
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function BrandVoiceEditor({
  records,
  selectedId,
  auditEntries,
  initialMode,
  suggestion,
}: Props) {
  const router = useRouter()
  const selected = records.find((r) => r.id === selectedId) ?? null

  // Set while a voice is being made that has no record yet, which is the only
  // case where a workspace with nothing saved still wants the rail.
  const [drafting, setDrafting] = useState(initialMode === 'onboarding')
  const [seenSelectedId, setSeenSelectedId] = useState(selectedId)
  const [workingId, setWorkingId] = useState<number | null>(selectedId)
  const [content, setContent] = useState<BrandVoiceContent>(() => contentOf(selected))
  const [step, setStep] = useState(() =>
    suggestion?.kind === 'not_trait'
      ? BRAND_VOICE_STEPS.findIndex((s) => s.id === 'notTraits')
      : initialStep(selected, initialMode),
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Archiving the active voice leaves runs with no voice at all, so it takes a
  // second click. Escape backs out from anywhere; Cancel takes focus, so the
  // safe choice is the one the keyboard lands on.
  const [confirmArchive, setConfirmArchive] = useState(false)
  const cancelArchiveRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirmArchive) return
    cancelArchiveRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmArchive(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmArchive])

  // Reload the working copy when the server picks a different record than the
  // one in hand. Saving a new voice also changes the selection — to the record
  // we just created — and that must not pull the form out from under the
  // person who is still on the step they saved from.
  if (selectedId !== seenSelectedId) {
    setSeenSelectedId(selectedId)
    if (selectedId !== workingId) {
      setWorkingId(selectedId)
      setContent(contentOf(selected))
      setStep(initialStep(selected, null))
      setConfirmDelete(false)
      setConfirmArchive(false)
    }
  }

  const record = records.find((r) => r.id === workingId) ?? null
  const status = record?.status ?? 'draft'
  const hasDraft = records.some((r) => r.status === 'draft')
  const hasActive = records.some((r) => r.status === 'active')
  // Activating this voice archives that one in the same write (cascadeSingleActive).
  const activeElsewhere = records.find((r) => r.status === 'active' && r.id !== workingId) ?? null
  const problems = brandVoiceActivationProblems(content)
  const current = BRAND_VOICE_STEPS[step].id
  // The picker is how you get back: to another voice, or to the saved one you
  // left when you started a replacement that has not been saved yet.
  const showPicker = records.length > 1 || (records.length > 0 && workingId == null)
  const problemsTitle =
    status === 'active'
      ? 'Fix before saving — an active voice must stay complete'
      : 'Before you can activate'

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

  /**
   * Create or update the working record; returns its id and new `updatedAt`.
   *
   * `onboardingStep` only ever climbs: it marks how far the interview got, so
   * revisiting question two on a finished voice must not rewind it.
   */
  const persist = async (
    answeredThrough: number,
  ): Promise<{ id: number; version: string; saved: BrandVoiceContent }> => {
    const onboardingStep = Math.max(record?.onboardingStep ?? 0, answeredThrough)
    if (workingId == null) {
      const { id, updatedAt, saved } = await createBrandVoiceDraftAction({
        ...content,
        onboardingStep,
      })
      setWorkingId(id)
      router.replace(`${VIEW_PATH}?id=${id}&mode=${modeOf(step)}`)
      return { id, version: updatedAt, saved }
    }
    const { updatedAt, saved } = await saveBrandVoiceDraftAction(
      workingId,
      { ...content, onboardingStep },
      suggestion?.id,
    )
    return { id: workingId, version: updatedAt, saved }
  }

  /**
   * Saving on a question means that question is answered. The review, guide,
   * and history steps answer nothing, so saving from one leaves the marker
   * where the interview actually got to.
   */
  const answeredThrough = step < STEP_COUNT ? step + 1 : (record?.onboardingStep ?? 0)

  // The working copy against the saved record. A new voice has no record to
  // compare with, so it is compared with an empty one and keyed apart.
  const guard = useDirtyGuard<BrandVoiceContent>({
    formKey: `brand-voice:${workingId ?? 'new'}`,
    value: content,
    initial: contentOf(record),
    version: record?.updatedAt ?? null,
    onReset: setContent,
    labels: { name: 'the name' },
    save: async () => {
      setError(null)
      setMessage(null)
      try {
        const { id, version, saved } = await persist(answeredThrough)
        // What was stored, not what was typed: the fields show it too.
        setContent(saved)
        toast.success(`Saved ${saved.name}.`)
        return { saved, key: `brand-voice:${id}`, version }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
        return null
      }
    },
  })

  // The URL carries the mode, not the step: a reload comes back to the same
  // part of the flow without a server round trip on every click of the rail.
  const goToStep = (next: number) => {
    const clamped = Math.max(0, Math.min(BRAND_VOICE_STEPS.length - 1, next))
    setStep(clamped)
    if (workingId != null && modeOf(clamped) !== modeOf(step)) {
      router.replace(`${VIEW_PATH}?id=${workingId}&mode=${modeOf(clamped)}`, { scroll: false })
    }
  }

  const startOnboarding = () => {
    setWorkingId(null)
    setContent(emptyBrandVoiceContent())
    setStep(0)
    setMessage(null)
    setError(null)
    setDrafting(true)
    setConfirmDelete(false)
    setConfirmArchive(false)
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
          : `Extracted "${file.name}" into a draft. Review every step, then activate.`,
      )
      setDrafting(true)
      setStep(REVIEW_STEP)
      router.replace(`${VIEW_PATH}?id=${result.id}&mode=review`)
      router.refresh()
    })

  const openRecord = (id: number) => {
    const next = records.find((r) => r.id === id) ?? null
    setMessage(null)
    setError(null)
    setConfirmDelete(false)
    setConfirmArchive(false)
    setWorkingId(id)
    setContent(contentOf(next))
    const nextStep = initialStep(next, null)
    setStep(nextStep)
    router.replace(`${VIEW_PATH}?id=${id}&mode=${modeOf(nextStep)}`)
    router.refresh()
  }

  const save = () =>
    startTransition(async () => {
      await guard.submit()
    })

  const activate = () =>
    run(async () => {
      const { id, version, saved } = await persist(STEP_COUNT)
      // Saved whether or not the gate then accepts the activation.
      setContent(saved)
      guard.markSaved(saved, { key: `brand-voice:${id}`, version })
      const result = await activateBrandVoiceAction(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      const superseded = activeElsewhere
        ? ` “${activeElsewhere.name || 'Untitled brand voice'}” is archived.`
        : ''
      setMessage(
        `${content.name || 'Brand voice'} is now active and governs every pipeline run.${superseded}`,
      )
    })

  const archive = () =>
    run(async () => {
      if (workingId == null) return
      setConfirmArchive(false)
      await archiveBrandVoiceAction(workingId)
      setMessage('Archived. Runs are blocked until you activate another voice.')
    })

  const remove = () =>
    run(async () => {
      if (workingId == null) return
      await deleteDraftAction(workingId)
      // Nothing of a deleted draft is worth keeping a copy of.
      guard.markSaved(content)
      setConfirmDelete(false)
      // Deleting the last voice puts the workspace back where it started, so
      // the entry cards must come back with it.
      setDrafting(false)
      router.replace(VIEW_PATH)
      router.refresh()
    })

  // ------------------------------------------------------------------ empty
  // A workspace with no voice picks how to make one before it gets a rail —
  // including the workspace that just deleted its last one. Not while a first
  // voice that was never saved has been restored: the rail is where it, its
  // banner and the leave dialog are, and the cards would only sit in front.
  if (records.length === 0 && workingId == null && !drafting && !guard.dirty && !guard.restore) {
    return (
      <div id="ops-main" tabIndex={-1} className="datum-ops">
        <SuggestionEditorContext suggestion={suggestion} />
        <div className="datum-ops__header">
          <h1>Brand voice</h1>
          <span className="datum-ops__pill">governance</span>
        </div>
        <p className="datum-ops__lede">{LEDE} Start by telling us who you are.</p>
        {error ? <p className="datum-ops__error">{error}</p> : null}
        <EntryCards
                  onStart={() => guard.guardLeave(startOnboarding)}
                  onUpload={(file) => guard.guardLeave(() => uploadGuide(file))}
                  disabled={pending}
                />
      </div>
    )
  }

  const Section =
    current === 'review' || current === 'guide' || current === 'history'
      ? null
      : SECTION_COMPONENTS[current]

  return (
    <AssetStepper<BrandVoiceStepId>
      heading="Brand voice"
      lede={LEDE}
      headerExtra={
        <>
          <span className="datum-ops__pill">governance</span>
          <span className={`datum-ops__status datum-ops__status--${status}`}>{status}</span>
        </>
      }
      beforeSteps={
        <div className="datum-ops__bv-bar">
          <SuggestionEditorContext suggestion={suggestion} />
          {showPicker ? (
            <div className="datum-ops__field">
              <label htmlFor="bv-record">Editing</label>
              <select
                id="bv-record"
                value={workingId ?? ''}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (e.target.value && next !== workingId) {
                    guard.guardLeave(() => openRecord(next))
                  }
                }}
                disabled={pending}
              >
                {workingId == null ? <option value="">New brand voice (unsaved)</option> : null}
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {recordLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {/* One voice at a time: an in-flight draft is the replacement, and an
              active voice keeps its replacement folded away rather than
              inviting an operator to start over. */}
          {!hasDraft && workingId != null ? (
            hasActive ? (
              <details className="datum-ops__bv-replace">
                <summary>Replace this voice</summary>
                <EntryCards
                  onStart={() => guard.guardLeave(startOnboarding)}
                  onUpload={(file) => guard.guardLeave(() => uploadGuide(file))}
                  disabled={pending}
                />
              </details>
            ) : (
              <div className="datum-ops__bv-replace is-open">
                <strong>Replace this voice</strong>
                <EntryCards
                  onStart={() => guard.guardLeave(startOnboarding)}
                  onUpload={(file) => guard.guardLeave(() => uploadGuide(file))}
                  disabled={pending}
                />
              </div>
            )
          ) : null}
        </div>
      }
      steps={BRAND_VOICE_STEPS}
      step={step}
      onStep={goToStep}
      disabled={pending}
      // The review step lists these itself, right above the buttons. Every
      // other step still needs to say why an active voice cannot be saved.
      problems={status === 'active' && current !== 'review' ? problems : []}
      problemsTitle={problemsTitle}
      error={error}
      message={message}
      guard={guard}
      onSave={save}
      saveBlocked={status === 'active' && problems.length > 0}
      actions={
        <>
          <SaveButton
            blocked={status === 'active' && problems.length > 0}
            guard={guard}
            onClick={save}
            pending={pending}
            title={status === 'active' && problems.length ? problems.join('; ') : undefined}
          />
          {status !== 'active' ? (
            <>
              <button
                type="button"
                className="datum-ops__btn datum-ops__btn--primary"
                onClick={activate}
                disabled={pending || problems.length > 0}
                title={problems.length ? problems.join('; ') : undefined}
              >
                Activate
              </button>
              {activeElsewhere ? (
                <span className="datum-ops__hint">
                  Activating this archives “{activeElsewhere.name || 'Untitled brand voice'}”, the
                  current voice.
                </span>
              ) : null}
            </>
          ) : confirmArchive ? (
            <>
              <button
                type="button"
                className="datum-ops__btn datum-ops__btn--danger"
                onClick={archive}
                disabled={pending}
              >
                Confirm: archive
              </button>
              <button
                ref={cancelArchiveRef}
                type="button"
                className="datum-ops__btn"
                onClick={() => setConfirmArchive(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <span className="datum-ops__hint">
                Runs are blocked until you activate another voice.
              </span>
            </>
          ) : (
            <button
              type="button"
              className="datum-ops__btn"
              onClick={() => setConfirmArchive(true)}
              disabled={pending}
            >
              Archive
            </button>
          )}
          {status === 'draft' && workingId != null ? (
            confirmDelete ? (
              <>
                <button
                  type="button"
                  className="datum-ops__btn datum-ops__btn--danger"
                  onClick={remove}
                  disabled={pending}
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  className="datum-ops__link-btn"
                  onClick={() => setConfirmDelete(false)}
                  disabled={pending}
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                className="datum-ops__link-btn"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                Delete draft
              </button>
            )
          ) : null}
        </>
      }
    >
      {Section ? <Section content={content} onChange={setContent} disabled={pending} /> : null}
      {current === 'review' ? (
        <BrandVoiceReview
          content={content}
          problems={problems}
          status={status}
          problemsTitle={problemsTitle}
        />
      ) : null}
      {current === 'guide' ? <BrandVoiceGuide content={content} record={record} /> : null}
      {current === 'history' ? (
        <AuditTimeline
          entries={record ? auditEntries : []}
          title="History"
          blurb="Append-only record of who changed this brand voice, when, and what changed."
          emptyText={
            record
              ? 'No events recorded for this brand voice yet.'
              : 'Nothing yet — this voice has not been saved once.'
          }
        />
      ) : null}
    </AssetStepper>
  )
}
