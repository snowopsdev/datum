'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import type { SitePage } from '../../lib/tenant/workspaceProfile'
import { AssetStepper, type AssetStep } from './AssetStepper'
import { Field, RowsEditor } from './setupFields'
import { refreshSitePagesAction } from './setupActions'
import { saveWorkspaceProfileAction } from './tenantActions'
import type { WorkspaceProfileInput } from './setupTypes'
import './ops.css'

type StepId = 'profile' | 'competitors' | 'pages'

const STEPS: readonly AssetStep<StepId>[] = [
  {
    id: 'profile',
    title: 'Who you are',
    blurb:
      'The company name and the site Datum writes about. Everything else in setup is read against this one domain.',
    assist: 'profile',
  },
  {
    id: 'competitors',
    title: 'Who you write against',
    blurb:
      'The sites the content-gap report compares you to, and the names prose should call them by.',
  },
  {
    id: 'pages',
    title: 'Your site, in Datum’s words',
    blurb:
      'Fetch your own pages once and the setup assistant can draft audiences, positioning, and facts from what you already say.',
  },
]

export type WorkspaceEditorData = WorkspaceProfileInput & {
  sitePages: SitePage[]
  sitePagesFetchedLabel: string | null
  /** Where the resolved domain comes from when the field below is blank. */
  fallbackDomain: string | null
  fallbackSource: 'env' | 'default' | 'admin'
  problems: string[]
}

/**
 * The workspace profile: one domain, a competitor table, and the site crawl
 * the setup assistant reads.
 *
 * It is a stepper rather than one long form for the same reason the other
 * assets are: the three questions are independent, and a person who only came
 * to press "fetch site pages" should not have to scroll past a competitor
 * table to find it.
 */
export function SetupWorkspaceEditor(props: WorkspaceEditorData) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [companyName, setCompanyName] = useState(props.companyName)
  const [targetDomain, setTargetDomain] = useState(props.targetDomain)
  const [siteNotes, setSiteNotes] = useState(props.siteNotes)
  const [competitors, setCompetitors] = useState(props.competitors)
  const [problems, setProblems] = useState(props.problems)
  const [warnings, setWarnings] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const result = await saveWorkspaceProfileAction({
        companyName,
        targetDomain,
        siteNotes,
        competitors,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setProblems(result.problems)
      setMessage('Saved. The next run researches this domain.')
      router.refresh()
    })

  const fetchPages = () =>
    startTransition(async () => {
      setError(null)
      setMessage(null)
      setWarnings([])
      const result = await refreshSitePagesAction()
      if (!result.ok) {
        setError(result.error)
        return
      }
      setWarnings(result.warnings)
      setMessage(`Fetched ${result.pages} page${result.pages === 1 ? '' : 's'}.`)
      // The action writes the pages to the global; the list below is rendered
      // straight from the server's copy, so a refresh is what redraws it.
      router.refresh()
    })

  const applyAssist = (_step: StepId, value: Record<string, unknown>) => {
    if (typeof value.companyName === 'string') setCompanyName(value.companyName)
    if (typeof value.siteNotes === 'string') setSiteNotes(value.siteNotes)
    if (Array.isArray(value.competitors)) {
      const proposed = value.competitors.flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const r = row as { domain?: unknown; name?: unknown }
        const domain = typeof r.domain === 'string' ? r.domain.trim() : ''
        if (!domain) return []
        return [{ domain, name: typeof r.name === 'string' ? r.name.trim() : domain }]
      })
      // Merged, not replaced: a competitor somebody typed is a decision, and
      // the assistant reading the site cannot know it was deliberate.
      const known = new Set(competitors.map((row) => row.domain.toLowerCase()))
      setCompetitors([
        ...competitors,
        ...proposed.filter((row) => !known.has(row.domain.toLowerCase())),
      ])
    }
  }

  const current = STEPS[step].id

  return (
    <AssetStepper
      heading="Workspace"
      lede="The site Datum writes about, the sites it writes against, and what your own pages say."
      headerExtra={
        <Link className="datum-ops__link-btn" href="/admin/ops/setup" prefetch={false}>
          ← Setup
        </Link>
      }
      steps={STEPS}
      step={step}
      onStep={setStep}
      asset="workspace"
      sectionValue={() => ({ companyName, competitors, siteNotes })}
      onAssist={applyAssist}
      disabled={pending}
      problems={problems}
      problemsTitle="Before a run can research this workspace"
      error={error}
      message={message}
      actions={
        <button
          type="button"
          className="datum-ops__btn datum-ops__btn--primary"
          onClick={save}
          disabled={pending}
        >
          Save
        </button>
      }
    >
      {current === 'profile' ? (
        <>
          <Field
            id="ws-companyName"
            label="Company name"
            value={companyName}
            onChange={setCompanyName}
            disabled={pending}
            placeholder="Acme"
            hint="Used in prompts to mark which statements are first-party claims about you."
          />
          <Field
            id="ws-targetDomain"
            label="Target domain"
            value={targetDomain}
            onChange={setTargetDomain}
            disabled={pending}
            placeholder="acme.com"
            hint={
              props.fallbackDomain && props.fallbackSource !== 'admin'
                ? `Leave blank to keep using ${props.fallbackDomain} (${
                    props.fallbackSource === 'env' ? 'from TARGET_DOMAIN' : 'the demo default'
                  }). Paste a full URL if you like — it is reduced to the host.`
                : 'Paste a full URL if you like — it is reduced to the host. www matters: it is a different target.'
            }
          />
          <Field
            id="ws-siteNotes"
            label="Notes about the site"
            value={siteNotes}
            onChange={setSiteNotes}
            disabled={pending}
            multiline
            placeholder="Anything the pages do not say: which products matter, what is being retired, who the site is really for."
          />
        </>
      ) : null}

      {current === 'competitors' ? (
        <RowsEditor
          id="ws-competitors"
          rows={competitors}
          onChange={setCompetitors}
          empty={() => ({ domain: '', name: '' })}
          addLabel="Add a competitor"
          disabled={pending}
          emptyText="No competitors yet. The content-gap report needs at least one."
          renderRow={({ row, rowId, patch }) => (
            <>
              <Field
                id={`${rowId}-domain`}
                label="Domain"
                value={row.domain}
                onChange={(domain) => patch({ domain })}
                disabled={pending}
                placeholder="competitor.com"
              />
              <Field
                id={`${rowId}-name`}
                label="Name in prose (optional)"
                value={row.name}
                onChange={(name) => patch({ name })}
                disabled={pending}
                placeholder="Competitor Inc"
              />
            </>
          )}
        />
      ) : null}

      {current === 'pages' ? (
        <div className="datum-ops__panel-body">
          <p className="datum-ops__hint">
            Datum reads your home page and up to seven marketing pages linked from it. Nothing is
            published, and the text is only used to draft your setup.
          </p>
          <div className="datum-ops__actions">
            <button
              type="button"
              className="datum-ops__btn"
              onClick={fetchPages}
              disabled={pending}
            >
              {pending ? 'Fetching…' : 'Fetch site pages'}
            </button>
            <span className="datum-ops__hint">
              {props.sitePagesFetchedLabel
                ? `Last fetched ${props.sitePagesFetchedLabel}`
                : 'Never fetched'}
            </span>
          </div>
          {warnings.length > 0 ? (
            <ul className="datum-ops__list">
              {warnings.map((warning) => (
                <li className="datum-ops__warn" key={warning}>
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          {props.sitePages.length === 0 ? (
            <p className="datum-ops__empty">No pages stored yet.</p>
          ) : (
            <table className="datum-ops__table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>URL</th>
                  <th>Characters</th>
                </tr>
              </thead>
              <tbody>
                {props.sitePages.map((page) => (
                  <tr key={page.url}>
                    <td>{page.title || 'Untitled'}</td>
                    <td>{page.url}</td>
                    <td>{page.text.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </AssetStepper>
  )
}
