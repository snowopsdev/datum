'use client'

import Link from 'next/link'
import React from 'react'

import { ContentRunForm } from './ContentRunForm'
import { TopicDiscovery } from './TopicDiscovery'
import './ops.css'

type Props = {
  templates: Array<{ id: number; name: string }>
  mode: 'mock' | 'live'
  pipelineReady: boolean
  runActive: boolean
  /** Topics already chosen and waiting for a run, so this page can point at them. */
  waitingCount: number
}

export function TopicDiscoveryPage({
  templates,
  mode,
  pipelineReady,
  runActive,
  waitingCount,
}: Props) {
  return (
    <div className="datum-ops">
      <div className="datum-ops__header">
        <h1>Find topics</h1>
        <div className="datum-ops__pills">
          <span className="datum-ops__pill">Step 1 of 2</span>
          {waitingCount > 0 ? (
            <span className="datum-ops__pill">{waitingCount} waiting to run</span>
          ) : null}
        </div>
      </div>
      <p className="datum-ops__lede">
        Pick what to write about. Nothing is researched, written, or paid for here — topics you add
        land on the article board, and you start the pipeline from there when you are ready.
      </p>

      <TopicDiscovery mode={mode} templates={templates} />

      <section className="datum-ops__panel">
        <h2>Or let Datum find the gaps</h2>
        <div className="datum-ops__panel-body">
          <p className="datum-ops__sub">
            Instead of naming a subject yourself, this looks for keywords your competitors rank for
            and you do not, picks the best few, and runs the whole pipeline on them straight away.
            Useful when you want output without choosing; use <strong>Find topics</strong> above when
            you have something specific in mind.
          </p>
          <p className="datum-ops__hint">
            This one does start a run, so it costs whatever a run costs
            {mode === 'live' ? ' — and this workspace is in live mode.' : ' (nothing, in mock mode).'}
          </p>
          {!pipelineReady ? (
            <p className="datum-ops__hint">
              <Link href="/admin">Finish workspace setup</Link> before starting a run.
            </p>
          ) : null}
          <ContentRunForm
            disabled={!pipelineReady || runActive}
            mode={mode}
            source="admin"
            templates={templates}
          />
        </div>
      </section>

      <section className="datum-ops__panel">
        <h2>What happens next</h2>
        <div className="datum-ops__panel-body">
          <p className="datum-ops__sub">
            {waitingCount > 0
              ? `You have ${waitingCount} topic${waitingCount === 1 ? '' : 's'} chosen and waiting. Go to the article board, tick the ones you want, and start a run — you do not have to run them all.`
              : 'Once you add a topic it appears on the article board under Topic selected. Tick the ones you want and start a run from there.'}
          </p>
          <p>
            <Link className="datum-ops__btn datum-ops__btn--primary" href="/admin/ops/articles">
              Go to the article board
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
