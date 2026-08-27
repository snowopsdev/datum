'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'

import type { WorkspaceSetupData } from '../../lib/loadWorkspaceReadiness'
import { ContentRunForm } from './ContentRunForm'
import './ops.css'

type Props = {
  setup: WorkspaceSetupData
}

function State({ ready }: { ready: boolean }) {
  return (
    <span className={`datum-ops__setup-state datum-ops__setup-state--${ready ? 'ready' : 'todo'}`}>
      {ready ? 'Ready' : 'Set up'}
    </span>
  )
}

export function OnboardingHub({ setup }: Props) {
  const router = useRouter()
  const { readiness, latestRun } = setup
  const activeRun = latestRun?.status === 'queued' || latestRun?.status === 'running'
  const completed = [
    readiness.runtime.ready,
    readiness.governance.ready,
    readiness.content.ready,
    readiness.verification.ready,
  ].filter(Boolean).length

  useEffect(() => {
    if (!activeRun) return
    const timer = window.setInterval(() => router.refresh(), 2000)
    return () => window.clearInterval(timer)
  }, [activeRun, router])

  return (
    <main className="datum-ops datum-ops__setup">
      <div className="datum-ops__setup-intro">
        <div>
          <p className="datum-ops__eyebrow">Workspace setup</p>
          <h1>
            {readiness.ready ? 'Your governed pipeline is ready' : 'Set up your content pipeline'}
          </h1>
          <p className="datum-ops__lede">
            Connect the controls already in Datum, then prove them with one end-to-end QA run.
          </p>
        </div>
        <div className="datum-ops__progress" aria-label={`${completed} of 4 setup areas ready`}>
          <strong>{completed}/4</strong>
          <span>ready</span>
        </div>
      </div>

      <div className="datum-ops__setup-list">
        <section>
          <div>
            <span className="datum-ops__step-number">01</span>
            <h2>Runtime</h2>
          </div>
          <p>
            {readiness.runtime.ready
              ? `${readiness.mode === 'mock' ? 'Mock' : 'Live'} providers are configured.`
              : `Add ${readiness.runtime.missing.join(', ')} to the environment.`}
          </p>
          <State ready={readiness.runtime.ready} />
        </section>
        <section>
          <div>
            <span className="datum-ops__step-number">02</span>
            <h2>Governance</h2>
          </div>
          <p>
            {readiness.governance.ready
              ? 'An active brand voice governs generation and QA.'
              : 'Create and activate the voice the pipeline must follow.'}
          </p>
          <Link href="/admin/ops/governance/brand-voice">Open brand voice</Link>
          <State ready={readiness.governance.ready} />
        </section>
        <section>
          <div>
            <span className="datum-ops__step-number">03</span>
            <h2>Content controls</h2>
          </div>
          <p>
            {readiness.content.ready
              ? `${readiness.content.templateCount} template${readiness.content.templateCount === 1 ? '' : 's'} and stage models are available.`
              : 'Create the structural and SEO rules for generated articles.'}
          </p>
          <span className="datum-ops__inline-links">
            <Link href="/admin/ops/templates">Templates</Link>
            <Link href="/admin/globals/llm-settings">Models</Link>
          </span>
          <State ready={readiness.content.ready} />
        </section>
        <section>
          <div>
            <span className="datum-ops__step-number">04</span>
            <h2>Verification</h2>
          </div>
          <p>
            {readiness.verification.ready
              ? `Latest QA result: ${readiness.verification.articleStatus?.replace('_', ' ')}.`
              : readiness.verification.stale
                ? 'Configuration changed. Run verification again.'
                : 'Generate a sample and carry it through research, generation, and QA.'}
          </p>
          <State ready={readiness.verification.ready} />
        </section>
      </div>

      <section className="datum-ops__verification-panel">
        <div>
          <p className="datum-ops__eyebrow">End-to-end check</p>
          <h2>{readiness.ready ? 'Pipeline verified' : 'Verify this workspace'}</h2>
          {latestRun ? (
            <p className="datum-ops__run-status">
              Run {latestRun.runId.slice(0, 8)} · {latestRun.status}
              {latestRun.errorSummary ? ` — ${latestRun.errorSummary}` : ''}
            </p>
          ) : null}
        </div>
        {readiness.ready ? (
          <Link className="datum-ops__primary-action" href="/admin/ops/content">
            Open content
          </Link>
        ) : (
          <ContentRunForm
            disabled={
              activeRun ||
              !readiness.runtime.ready ||
              !readiness.governance.ready ||
              !readiness.content.ready
            }
            mode={readiness.mode}
            source="onboarding"
            templates={setup.templates as Array<{ id: number; name: string }>}
          />
        )}
      </section>
    </main>
  )
}
