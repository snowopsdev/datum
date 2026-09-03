'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  emptyIcpContent,
  type IcpContent,
  icpCompletenessProblems,
  icpContentOf,
} from '../../lib/tenant/icp'
import { AssetStepper } from './AssetStepper'
import { ICP_SECTION_COMPONENTS } from './icpSections'
import { ICP_STEPS, type IcpDTO, type IcpStepId } from './icpTypes'
import {
  activateIcpAction,
  archiveIcpAction,
  createIcpAction,
  deleteIcpDraftAction,
  saveIcpAction,
  setPrimaryIcpAction,
} from './tenantActions'
import './ops.css'

const LIST_PATH = '/admin/ops/setup/audiences'

/**
 * Merge one assistant section into the form.
 *
 * Only the keys the section is allowed to return are read, so a model that
 * answers a question nobody asked cannot rewrite the rest of the audience:
 * the "pains" step returns pains, and anything else in the reply is ignored.
 */
function mergeAssist(content: IcpContent, value: Record<string, unknown>): IcpContent {
  // The parser is the same one the collection hook and the loader use, so a
  // section arriving with a bad confidence or a half-filled row is cleaned the
  // one way rather than three.
  const parsed = icpContentOf({ ...content, ...value })
  return {
    ...parsed,
    // Never from the assistant: these are the record's own state.
    id: content.id,
    status: content.status,
    primary: content.primary,
    name: typeof value.name === 'string' && value.name.trim() ? parsed.name : content.name,
  }
}

export function IcpEditor({ record }: { record: IcpDTO | null }) {
  const router = useRouter()
  const [content, setContent] = useState<IcpContent>(() =>
    record ? icpContentOf(record) : emptyIcpContent(),
  )
  const [id, setId] = useState<number | null>(record?.id ?? null)
  const [status, setStatus] = useState(record?.status ?? 'draft')
  const [primary, setPrimary] = useState(record?.primary ?? false)
  const [step, setStep] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const problems = icpCompletenessProblems(content)
  const current = ICP_STEPS[step].id

  /** Create on first save, update afterwards; returns the id or null on failure. */
  const persist = async (): Promise<number | null> => {
    if (id == null) {
      const created = await createIcpAction(content)
      if (!created.ok) {
        setError(created.error)
        return null
      }
      setId(created.id)
      router.replace(`${LIST_PATH}/${created.id}`)
      return created.id
    }
    const saved = await saveIcpAction(id, content)
    if (!saved.ok) {
      setError(saved.error)
      return null
    }
    return id
  }

  const run = (fn: () => Promise<void>) => {
    setError(null)
    setMessage(null)
    startTransition(fn)
  }

  const save = () =>
    run(async () => {
      const savedId = await persist()
      if (savedId == null) return
      setMessage(`Saved ${content.name || 'the audience'}.`)
      router.refresh()
    })

  const activate = () =>
    run(async () => {
      const savedId = await persist()
      if (savedId == null) return
      const result = await activateIcpAction(savedId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStatus('active')
      setMessage('Active. New pieces can be written for this audience.')
      router.refresh()
    })

  const makePrimary = () =>
    run(async () => {
      const savedId = await persist()
      if (savedId == null) return
      const result = await setPrimaryIcpAction(savedId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPrimary(true)
      setMessage('This is now the audience every new piece starts with.')
      router.refresh()
    })

  const archive = () =>
    run(async () => {
      if (id == null) return
      const result = await archiveIcpAction(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStatus('archived')
      setPrimary(false)
      setMessage('Archived. Pieces already written for it keep pointing at it.')
      router.refresh()
    })

  const remove = () =>
    run(async () => {
      if (id == null) return
      const result = await deleteIcpDraftAction(id)
      if (!result.ok) {
        setError(result.error)
        setConfirmDelete(false)
        return
      }
      router.replace(LIST_PATH)
      router.refresh()
    })

  const Section = current === 'review' ? null : ICP_SECTION_COMPONENTS[current]

  return (
    <AssetStepper<IcpStepId>
      heading={record ? content.name || 'Audience' : 'New audience'}
      lede="Who this piece is for. Every section is injected into the writer’s prompt with its confidence, which decides whether it may be stated or must be hedged."
      headerExtra={
        <>
          <span className={`datum-ops__status datum-ops__status--${status}`}>{status}</span>
          {primary ? <span className="datum-ops__pill">primary</span> : null}
          <Link className="datum-ops__link-btn" href={LIST_PATH} prefetch={false}>
            ← Audiences
          </Link>
        </>
      }
      steps={ICP_STEPS}
      step={step}
      onStep={setStep}
      asset="icp"
      {...(id != null ? { icpId: id } : {})}
      sectionValue={(stepId) => {
        if (stepId === 'boundaries') {
          return { churnTriggers: content.churnTriggers, notOurUser: content.notOurUser }
        }
        if (stepId === 'review') return null
        return { [stepId]: content[stepId as keyof IcpContent] }
      }}
      onAssist={(_stepId, value) => setContent((prev) => mergeAssist(prev, value))}
      disabled={pending}
      problems={current === 'review' ? problems : []}
      problemsTitle={
        status === 'active'
          ? 'Fix before saving — an active audience must stay complete'
          : 'Before you can activate'
      }
      error={error}
      message={message}
      actions={
        <>
          <button
            type="button"
            className="datum-ops__btn datum-ops__btn--primary"
            onClick={save}
            disabled={pending}
          >
            Save
          </button>
          {status !== 'active' ? (
            <button
              type="button"
              className="datum-ops__btn"
              onClick={activate}
              disabled={pending || problems.length > 0}
              title={problems.length ? problems.join('; ') : undefined}
            >
              Activate
            </button>
          ) : null}
          {status === 'active' && !primary ? (
            <button type="button" className="datum-ops__btn" onClick={makePrimary} disabled={pending}>
              Make primary
            </button>
          ) : null}
          {status === 'active' ? (
            <button type="button" className="datum-ops__btn" onClick={archive} disabled={pending}>
              Archive
            </button>
          ) : null}
          {status === 'draft' && id != null ? (
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
      {Section ? (
        <Section content={content} onChange={setContent} disabled={pending} />
      ) : (
        <IcpReview content={content} problems={problems} status={status} primary={primary} />
      )}
    </AssetStepper>
  )
}

function IcpReview({
  content,
  problems,
  status,
  primary,
}: {
  content: IcpContent
  problems: string[]
  status: string
  primary: boolean
}) {
  const counts: [string, number | string][] = [
    ['Pains', content.pains.length],
    ['Competitor claims', content.competition.length],
    ['Channels', content.channels.length],
    ['Boundaries', content.notOurUser.length + content.churnTriggers.length],
    ['Status', primary ? `${status} · primary` : status],
  ]
  return (
    <div className="datum-ops__panel-body">
      <p className="datum-ops__hint">
        {problems.length === 0
          ? 'Complete. Activating it lets new pieces be written for this audience; making it primary makes it the default.'
          : 'An audience can be saved at any point. It can only be activated once these are answered.'}
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
      {content.who ? (
        <>
          <h3 className="datum-ops__section-title">Who</h3>
          <p>{content.who}</p>
        </>
      ) : null}
    </div>
  )
}
