'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import { activateDefaultTenantAction } from './tenantActions'
import './ops.css'

export type SetupChecklistData = {
  mode: 'mock' | 'live'
  /** `governance.ready`: a piece can be researched and written. */
  ready: boolean
  voice: { name: string | null; active: boolean }
  workspace: {
    ready: boolean
    targetDomain: string | null
    /** Where the domain came from: an admin field, an env var, or the mock default. */
    source: 'admin' | 'env' | 'default'
    competitorCount: number
    sitePages: number
    /** Preformatted on the server, so the hub never re-renders a different clock. */
    sitePagesFetchedLabel: string | null
  }
  audiences: { ready: boolean; count: number; primaryName: string | null }
  positioning: { status: 'missing' | 'partial' | 'ready'; problems: string[] }
  evidence: {
    status: 'missing' | 'ready'
    usable: number
    expired: number
    incomplete: number
    rejected: number
    facts: number
  }
}

type Row = {
  id: string
  title: string
  blurb: string
  state: string
  done: boolean
  recommended?: boolean
  href: string
  action: string
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

function workspaceState(workspace: SetupChecklistData['workspace']): string {
  if (!workspace.targetDomain) return 'No site to write about yet'
  const parts = [workspace.targetDomain]
  if (workspace.source === 'env') parts[0] = `${workspace.targetDomain} (from TARGET_DOMAIN)`
  if (workspace.source === 'default') parts[0] = `${workspace.targetDomain} (demo default)`
  parts.push(plural(workspace.competitorCount, 'competitor'))
  parts.push(
    workspace.sitePagesFetchedLabel
      ? `${plural(workspace.sitePages, 'page')} fetched ${workspace.sitePagesFetchedLabel}`
      : 'site pages not fetched',
  )
  return parts.join(' · ')
}

function positioningState(positioning: SetupChecklistData['positioning']): string {
  if (positioning.status === 'ready') return 'Ready — category, promise, three claims, pillars'
  if (positioning.status === 'missing') return 'Nothing written yet'
  return `Started · ${plural(positioning.problems.length, 'thing')} left`
}

function evidenceState(evidence: SetupChecklistData['evidence']): string {
  if (evidence.status === 'missing') return 'Nothing a draft may cite yet'
  const parts = [plural(evidence.usable, 'usable claim'), plural(evidence.facts, 'fact')]
  if (evidence.expired > 0) parts.push(`${evidence.expired} expired`)
  // Named on the row rather than left to the editor, because an unfinished
  // claim looks like evidence in every list until somebody says it is not.
  if (evidence.incomplete > 0) parts.push(`${evidence.incomplete} unverified`)
  if (evidence.rejected > 0) parts.push(`${evidence.rejected} rejected`)
  return parts.join(' · ')
}

/** Required rows first, then the two that sharpen a draft without gating one. */
export function checklistRows(data: SetupChecklistData): Row[] {
  return [
    {
      id: 'workspace',
      title: 'Workspace',
      blurb: 'Which site Datum writes about, and who it writes against.',
      state: workspaceState(data.workspace),
      done: data.workspace.ready,
      href: '/admin/ops/setup/workspace',
      action: data.workspace.targetDomain ? 'Edit' : 'Set the domain',
    },
    {
      id: 'voice',
      title: 'Brand voice',
      blurb: 'How every draft sounds, and the words it may never use.',
      state: data.voice.active
        ? `Active: ${data.voice.name || 'Untitled brand voice'}`
        : 'No active voice — drafts would run on the platform style guide alone',
      done: data.voice.active,
      href: '/admin/ops/governance/brand-voice',
      action: data.voice.active ? 'Edit' : 'Set up',
    },
    {
      id: 'audiences',
      title: 'Audiences',
      blurb: 'Who each piece is for. The primary one is used for new pieces.',
      state: data.audiences.count
        ? `${plural(data.audiences.count, 'active audience', 'active audiences')}${
            data.audiences.primaryName ? ` · primary: ${data.audiences.primaryName}` : ''
          }`
        : 'None yet',
      done: data.audiences.ready,
      href: '/admin/ops/setup/audiences',
      action: data.audiences.count ? 'Edit' : 'Add an audience',
    },
    {
      id: 'positioning',
      title: 'Positioning',
      blurb: 'The category you claim and the words you claim it in.',
      state: positioningState(data.positioning),
      done: data.positioning.status === 'ready',
      recommended: true,
      href: '/admin/ops/setup/positioning',
      action: data.positioning.status === 'missing' ? 'Add positioning' : 'Edit',
    },
    {
      id: 'evidence',
      title: 'Evidence bank',
      blurb: 'Everything a draft may state about you as fact, and what it may not.',
      state: evidenceState(data.evidence),
      done: data.evidence.status === 'ready',
      recommended: true,
      href: '/admin/ops/setup/evidence',
      action: data.evidence.status === 'missing' ? 'Add evidence' : 'Edit',
    },
  ]
}

/**
 * The whole of setup on one page: five assets, what each one says right now,
 * and where to fix it.
 *
 * It replaces `FirstRun`, which asked one question at a time and could only
 * answer "what is missing" as a list of sentences. Five assets need five
 * states, and the two recommended ones need to look different from the three
 * that block a run — a workspace with no evidence bank writes fine, it just
 * writes with nothing to cite.
 *
 * The same component is the `/admin` landing page and the permanent
 * `/admin/ops/setup` page, because the questions do not stop being interesting
 * once the first piece is written.
 */
export function SetupChecklist(props: SetupChecklistData) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const rows = checklistRows(props)
  const blockers = rows.filter((row) => !row.recommended && !row.done)

  const useDemo = () => {
    setError(null)
    startTransition(async () => {
      const result = await activateDefaultTenantAction()
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="datum-ops datum-setup">
      <p className="datum-ops__eyebrow">
        {props.ready ? 'Ready' : blockers.length === rows.length - 2 ? 'A few things first' : 'Nearly there'}
      </p>
      <h1>{props.ready ? 'Your workspace' : 'Set up your workspace'}</h1>
      <p className="datum-ops__lede">
        {props.ready
          ? 'Everything a piece is researched, written, and checked against lives here. Edit any of it whenever you like — changes reach the next run.'
          : 'Datum writes as you, for someone, about a site. Fill in the three required rows and you can make your first piece; the other two make every draft sound more like you.'}
      </p>

      <ul className="datum-setup__rows">
        {rows.map((row) => (
          <li className="datum-setup__row" key={row.id}>
            <span
              aria-hidden="true"
              className={`datum-setup__mark${row.done ? ' is-done' : ''}${
                row.recommended ? ' is-optional' : ''
              }`}
            >
              {row.done ? '✓' : row.recommended ? '·' : ''}
            </span>
            <div className="datum-setup__body">
              <div className="datum-setup__title">
                <strong>{row.title}</strong>
                {row.recommended ? (
                  <em className="datum-first__optional">Recommended</em>
                ) : null}
              </div>
              <p className="datum-setup__state">{row.state}</p>
              <p className="datum-ops__hint">{row.blurb}</p>
            </div>
            <Link className="datum-ops__btn" href={row.href} prefetch={false}>
              {row.action}
            </Link>
          </li>
        ))}
      </ul>

      <div className="datum-setup__footer">
        {props.ready ? (
          <Link className="datum-ops__btn datum-ops__btn--primary" href="/admin/ops/new">
            Make your first piece
          </Link>
        ) : null}
        <button
          className={`datum-ops__btn${props.ready ? '' : ' datum-ops__btn--primary'}`}
          disabled={pending}
          onClick={useDemo}
          type="button"
        >
          {pending ? 'Setting up…' : 'Start with the demo workspace'}
        </button>
        <span className="datum-ops__hint">
          Fills whatever is still blank with a demo brand: a plain B2B voice, a site to write about,
          two audiences, a position, and an evidence bank. Every part of it is an ordinary record you
          can edit or replace.
        </span>
      </div>
      {error ? <p className="datum-ops__error">{error}</p> : null}
      {props.mode === 'live' ? null : (
        <p className="datum-ops__hint">
          Mock mode: runs use canned fixtures and never call a paid provider.
        </p>
      )}
    </main>
  )
}
