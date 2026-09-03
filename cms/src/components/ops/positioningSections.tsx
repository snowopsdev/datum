'use client'

import React from 'react'

import type { PositioningContent } from '../../lib/tenant/positioning'
import type { AssetStep } from './AssetStepper'
import { Field, RowsEditor } from './setupFields'

export type PositioningStepId =
  | 'core'
  | 'frame'
  | 'coreClaims'
  | 'pillars'
  | 'identity'
  | 'language'
  | 'openRulings'
  | 'review'

/**
 * The position, asked in the order it is decided: what game you are in, the
 * world it is played in, the three things you say, the pillars that carry
 * them, who you are, the words you use, and finally what you have not settled.
 */
export const POSITIONING_STEPS: readonly AssetStep<PositioningStepId>[] = [
  {
    id: 'core',
    title: 'The core',
    blurb:
      'The category you are in, the one goal, the promise to a customer, the slot you want in their head, and the sentence that ties them together.',
    assist: 'core',
  },
  {
    id: 'frame',
    title: 'The frame',
    blurb: 'The shift in the world that makes this the moment, and who else is on the field.',
    assist: 'frame',
  },
  {
    id: 'coreClaims',
    title: 'Three core claims',
    blurb:
      'Exactly three. A position with a dozen claims has none — sharpen instead of adding. Point each at an evidence-bank ref where one exists.',
    assist: 'coreClaims',
  },
  {
    id: 'pillars',
    title: 'Pillars',
    blurb: 'The few themes every piece ladders back to, and what each one is there to carry.',
    assist: 'pillars',
  },
  {
    id: 'identity',
    title: 'Enemy, archetype, essence',
    blurb: 'What you are against, the character you play, and the idea underneath all of it.',
    assist: 'identity',
  },
  {
    id: 'language',
    title: 'How to describe us',
    blurb:
      'The ladder from broad to specific, and the words to reach for or avoid. Only the ladder itself reaches the writer; the notes are for your team.',
    assist: 'language',
  },
  {
    id: 'openRulings',
    title: 'Open rulings',
    blurb:
      'Questions you have not settled. Open ones are sent to the writer as “take no position on this”; a ruled one is settled and stops being sent.',
    assist: 'openRulings',
  },
  {
    id: 'review',
    title: 'Review',
    blurb: 'What a finished position still needs. None of it blocks a run.',
  },
]

export type PositioningSectionProps = {
  content: PositioningContent
  onChange: (next: PositioningContent) => void
  disabled: boolean
}

export function CoreSection({ content, onChange, disabled }: PositioningSectionProps) {
  const set = (patch: Partial<PositioningContent>) => onChange({ ...content, ...patch })
  return (
    <>
      <Field
        id="pos-category"
        label="Category"
        value={content.category}
        onChange={(category) => set({ category })}
        disabled={disabled}
        placeholder="Content pipelines for teams without writers"
      />
      <Field
        id="pos-goal"
        label="The one goal"
        value={content.goal}
        onChange={(goal) => set({ goal })}
        disabled={disabled}
        placeholder="Be the tool a reviewer trusts enough to publish from."
      />
      <Field
        id="pos-promise"
        label="Customer promise"
        value={content.promise}
        onChange={(promise) => set({ promise })}
        disabled={disabled}
        multiline
        placeholder="Nothing goes out that a person did not approve."
      />
      <Field
        id="pos-activePosition"
        label="The position to own"
        value={content.activePosition}
        onChange={(activePosition) => set({ activePosition })}
        disabled={disabled}
        placeholder="the content pipeline with a reviewer gate"
        hint="Written as a phrase a customer could repeat, not a slogan."
      />
      <Field
        id="pos-statement"
        label="Positioning statement"
        value={content.statement}
        onChange={(statement) => set({ statement })}
        disabled={disabled}
        multiline
        placeholder="For teams that own content but have no writers, Datum is the pipeline that researches first and stops for a human before it writes."
      />
    </>
  )
}

export function FrameSection({ content, onChange, disabled }: PositioningSectionProps) {
  const set = (patch: Partial<PositioningContent>) => onChange({ ...content, ...patch })
  return (
    <>
      <Field
        id="pos-macroFrame"
        label="Macro frame"
        value={content.macroFrame}
        onChange={(macroFrame) => set({ macroFrame })}
        disabled={disabled}
        multiline
        placeholder="Generated content got cheap; trust in it did not."
      />
      <Field
        id="pos-landscape"
        label="Landscape"
        value={content.landscape}
        onChange={(landscape) => set({ landscape })}
        disabled={disabled}
        multiline
        placeholder="Who else is on this field, and what they are each selling."
      />
    </>
  )
}

export function CoreClaimsSection({ content, onChange, disabled }: PositioningSectionProps) {
  return (
    <RowsEditor
      id="pos-claims"
      rows={content.coreClaims}
      onChange={(coreClaims) => onChange({ ...content, coreClaims })}
      empty={() => ({ claim: '', evidenceRef: '' })}
      addLabel="Add a claim"
      disabled={disabled}
      max={5}
      emptyText="No claims yet. Three is the target."
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-claim`}
            label="Claim"
            value={row.claim}
            onChange={(claim) => patch({ claim })}
            disabled={disabled}
            multiline
          />
          <Field
            id={`${rowId}-ref`}
            label="Evidence ref (optional)"
            value={row.evidenceRef}
            onChange={(evidenceRef) => patch({ evidenceRef })}
            disabled={disabled}
            placeholder="E4"
            hint="A row in the evidence bank. The writer is told to cite it."
          />
        </>
      )}
    />
  )
}

export function PillarsSection({ content, onChange, disabled }: PositioningSectionProps) {
  return (
    <RowsEditor
      id="pos-pillars"
      rows={content.pillars}
      onChange={(pillars) => onChange({ ...content, pillars })}
      empty={() => ({ name: '', oneLine: '', carries: '' })}
      addLabel="Add a pillar"
      disabled={disabled}
      emptyText="No pillars yet."
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-name`}
            label="Pillar"
            value={row.name}
            onChange={(name) => patch({ name })}
            disabled={disabled}
            placeholder="Show your work"
          />
          <Field
            id={`${rowId}-oneLine`}
            label="In one line"
            value={row.oneLine}
            onChange={(oneLine) => patch({ oneLine })}
            disabled={disabled}
          />
          <Field
            id={`${rowId}-carries`}
            label="What it carries"
            value={row.carries}
            onChange={(carries) => patch({ carries })}
            disabled={disabled}
            placeholder="The evidence-bank claims, and the review gates."
          />
        </>
      )}
    />
  )
}

export function IdentitySection({ content, onChange, disabled }: PositioningSectionProps) {
  const set = (patch: Partial<PositioningContent>) => onChange({ ...content, ...patch })
  return (
    <>
      <Field
        id="pos-enemy"
        label="Enemy"
        value={content.enemy}
        onChange={(enemy) => set({ enemy })}
        disabled={disabled}
        multiline
        placeholder="Volume for its own sake."
        hint="A practice or belief, not a company you would rather not name in print."
      />
      <Field
        id="pos-archetype"
        label="Archetype"
        value={content.archetype}
        onChange={(archetype) => set({ archetype })}
        disabled={disabled}
        placeholder="The careful expert"
      />
      <Field
        id="pos-essence"
        label="Essence"
        value={content.essence}
        onChange={(essence) => set({ essence })}
        disabled={disabled}
        placeholder="Earned confidence"
      />
    </>
  )
}

export function LanguageSection({ content, onChange, disabled }: PositioningSectionProps) {
  return (
    <>
      <RowsEditor
        id="pos-ladder"
        rows={content.descriptorLadder}
        onChange={(descriptorLadder) => onChange({ ...content, descriptorLadder })}
        empty={() => ({ descriptor: '', note: '' })}
        addLabel="Add a rung"
        disabled={disabled}
        emptyText="No ladder yet. Broad first, specific last — the order is the ladder."
        renderRow={({ row, rowId, patch }) => (
          <>
            <Field
              id={`${rowId}-descriptor`}
              label="Descriptor"
              value={row.descriptor}
              onChange={(descriptor) => patch({ descriptor })}
              disabled={disabled}
              placeholder="software"
            />
            <Field
              id={`${rowId}-note`}
              label="When to use it (your team only)"
              value={row.note}
              onChange={(note) => patch({ note })}
              disabled={disabled}
            />
          </>
        )}
      />
      <h3 className="datum-ops__section-title">Reach for</h3>
      <RowsEditor
        id="pos-reach"
        rows={content.vocabularyReachFor}
        onChange={(vocabularyReachFor) => onChange({ ...content, vocabularyReachFor })}
        empty={() => ({ term: '', note: '' })}
        addLabel="Add a word"
        disabled={disabled}
        emptyText="Nothing listed."
        renderRow={({ row, rowId, patch }) => (
          <>
            <Field
              id={`${rowId}-term`}
              label="Word"
              value={row.term}
              onChange={(term) => patch({ term })}
              disabled={disabled}
            />
            <Field
              id={`${rowId}-note`}
              label="Why"
              value={row.note}
              onChange={(note) => patch({ note })}
              disabled={disabled}
            />
          </>
        )}
      />
      <h3 className="datum-ops__section-title">Avoid</h3>
      <RowsEditor
        id="pos-avoid"
        rows={content.vocabularyAvoid}
        onChange={(vocabularyAvoid) => onChange({ ...content, vocabularyAvoid })}
        empty={() => ({ term: '', note: '' })}
        addLabel="Add a word"
        disabled={disabled}
        emptyText="Nothing listed."
        renderRow={({ row, rowId, patch }) => (
          <>
            <Field
              id={`${rowId}-term`}
              label="Word"
              value={row.term}
              onChange={(term) => patch({ term })}
              disabled={disabled}
            />
            <Field
              id={`${rowId}-note`}
              label="Why not"
              value={row.note}
              onChange={(note) => patch({ note })}
              disabled={disabled}
            />
          </>
        )}
      />
    </>
  )
}

export function OpenRulingsSection({ content, onChange, disabled }: PositioningSectionProps) {
  return (
    <RowsEditor
      id="pos-rulings"
      rows={content.openRulings}
      onChange={(openRulings) => onChange({ ...content, openRulings })}
      empty={() => ({ question: '', status: 'open' as const, ruling: '', ruledAt: '' })}
      addLabel="Add a question"
      disabled={disabled}
      emptyText="Nothing open. Anything you have not settled belongs here rather than in a draft."
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-question`}
            label="Question"
            value={row.question}
            onChange={(question) => patch({ question })}
            disabled={disabled}
            placeholder="Do we say “agent” or “pipeline”?"
          />
          <div className="datum-ops__field">
            <label htmlFor={`${rowId}-status`}>Status</label>
            <select
              id={`${rowId}-status`}
              value={row.status}
              onChange={(e) => patch({ status: e.target.value === 'ruled' ? 'ruled' : 'open' })}
              disabled={disabled}
            >
              <option value="open">Open — the writer takes no position</option>
              <option value="ruled">Ruled — settled, no longer sent</option>
            </select>
          </div>
          <Field
            id={`${rowId}-ruling`}
            label="Ruling"
            value={row.ruling}
            onChange={(ruling) => patch({ ruling })}
            disabled={disabled}
            multiline
          />
          <Field
            id={`${rowId}-ruledAt`}
            label="Ruled on"
            value={row.ruledAt ? row.ruledAt.slice(0, 10) : ''}
            onChange={(ruledAt) => patch({ ruledAt })}
            disabled={disabled}
            type="date"
          />
        </>
      )}
    />
  )
}

export const POSITIONING_SECTION_COMPONENTS: Record<
  Exclude<PositioningStepId, 'review'>,
  (props: PositioningSectionProps) => React.JSX.Element
> = {
  core: CoreSection,
  frame: FrameSection,
  coreClaims: CoreClaimsSection,
  pillars: PillarsSection,
  identity: IdentitySection,
  language: LanguageSection,
  openRulings: OpenRulingsSection,
}
