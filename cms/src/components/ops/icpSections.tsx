'use client'

import React from 'react'

import type { IcpContent } from '../../lib/tenant/icp'
import { ConfidenceSelect } from './ConfidenceSelect'
import type { IcpStepId } from './icpTypes'
import { Field, RowsEditor, TextRows } from './setupFields'

export type IcpSectionProps = {
  content: IcpContent
  onChange: (next: IcpContent) => void
  disabled: boolean
}

/**
 * One component per audience step, keyed the way `brandVoiceSections.tsx` keys
 * its own — so the editor is a lookup rather than a switch, and adding a step
 * is one entry in `ICP_STEPS` and one here.
 */

export function WhoSection({ content, onChange, disabled }: IcpSectionProps) {
  return (
    <>
      <Field
        id="icp-name"
        label="Audience name"
        value={content.name}
        onChange={(name) => onChange({ ...content, name })}
        disabled={disabled}
        placeholder="Growth marketer at a Series B SaaS"
        hint="What your team would call this group in a meeting."
      />
      <Field
        id="icp-who"
        label="Who are they, in one line?"
        value={content.who}
        onChange={(who) => onChange({ ...content, who })}
        disabled={disabled}
        multiline
        placeholder="Owns pipeline for a 50–200 person company, has a content budget and no writers."
      />
    </>
  )
}

export function PainsSection({ content, onChange, disabled }: IcpSectionProps) {
  return (
    <RowsEditor
      id="icp-pains"
      rows={content.pains}
      onChange={(pains) => onChange({ ...content, pains })}
      empty={() => ({ statement: '', evidence: [], confidence: null })}
      addLabel="Add a pain"
      disabled={disabled}
      emptyText="No pains yet. An audience needs at least one before it can be activated."
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-statement`}
            label="What hurts"
            value={row.statement}
            onChange={(statement) => patch({ statement })}
            disabled={disabled}
            multiline
            placeholder="Publishing five pieces a month that nobody can tell apart from a competitor’s."
          />
          <RowsEditor
            id={`${rowId}-evidence`}
            rows={row.evidence}
            onChange={(evidence) => patch({ evidence })}
            empty={() => ({ ref: '', note: '' })}
            addLabel="Add evidence"
            disabled={disabled}
            emptyText="No evidence recorded — the confidence below is all the writer has to go on."
            renderRow={({ row: ev, rowId: evId, patch: patchEv }) => (
              <>
                <Field
                  id={`${evId}-ref`}
                  label="Where it came from"
                  value={ev.ref}
                  onChange={(ref) => patchEv({ ref })}
                  disabled={disabled}
                  placeholder="Interview 12, or a URL"
                />
                <Field
                  id={`${evId}-note`}
                  label="Note"
                  value={ev.note}
                  onChange={(note) => patchEv({ note })}
                  disabled={disabled}
                  placeholder="Said it unprompted, twice."
                />
              </>
            )}
          />
          <ConfidenceSelect
            id={`${rowId}-confidence`}
            value={row.confidence}
            onChange={(confidence) => patch({ confidence })}
            disabled={disabled}
          />
        </>
      )}
    />
  )
}

export function MotivationSection({ content, onChange, disabled }: IcpSectionProps) {
  const patch = (motivation: Partial<IcpContent['motivation']>) =>
    onChange({ ...content, motivation: { ...content.motivation, ...motivation } })
  return (
    <>
      <Field
        id="icp-motivation"
        label="Why would they act now?"
        value={content.motivation.text}
        onChange={(text) => patch({ text })}
        disabled={disabled}
        multiline
        placeholder="A board asking where the pipeline is going to come from next quarter."
      />
      <div className="datum-ops__field">
        <label htmlFor="icp-motivation-hypothesis">
          <input
            id="icp-motivation-hypothesis"
            type="checkbox"
            checked={content.motivation.hypothesis}
            onChange={(e) => patch({ hypothesis: e.target.checked })}
            disabled={disabled}
          />{' '}
          This is a hypothesis, not something we have confirmed
        </label>
        <p className="datum-ops__hint">
          Marked in the prompt heading. An unmarked guess reads to the writer as a finding.
        </p>
      </div>
      <ConfidenceSelect
        id="icp-motivation-confidence"
        value={content.motivation.confidence}
        onChange={(confidence) => patch({ confidence })}
        disabled={disabled}
      />
    </>
  )
}

export function SolutionSection({ content, onChange, disabled }: IcpSectionProps) {
  const patch = (solution: Partial<IcpContent['solution']>) =>
    onChange({ ...content, solution: { ...content.solution, ...solution } })
  return (
    <>
      <Field
        id="icp-mechanism"
        label="The mechanism — how we actually fix it"
        value={content.solution.mechanism}
        onChange={(mechanism) => patch({ mechanism })}
        disabled={disabled}
        multiline
        placeholder="A pipeline that researches first and stops for a human before it writes."
      />
      <TextRows
        id="icp-samplelines"
        label="Lines that land"
        rows={content.solution.sampleLines}
        onChange={(sampleLines) => patch({ sampleLines })}
        disabled={disabled}
        addLabel="Add a line"
        placeholder="Research first, write second."
        hint="Phrasings the writer may reuse verbatim."
      />
      <ConfidenceSelect
        id="icp-solution-confidence"
        value={content.solution.confidence}
        onChange={(confidence) => patch({ confidence })}
        disabled={disabled}
      />
    </>
  )
}

export function CompetitionSection({ content, onChange, disabled }: IcpSectionProps) {
  return (
    <RowsEditor
      id="icp-competition"
      rows={content.competition}
      onChange={(competition) => onChange({ ...content, competition })}
      empty={() => ({ competitor: '', claim: '', claimedAt: '', source: '', confidence: null })}
      addLabel="Add a competitor claim"
      disabled={disabled}
      emptyText="Nothing recorded. A claim with no date beside it ages invisibly."
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-competitor`}
            label="Competitor"
            value={row.competitor}
            onChange={(competitor) => patch({ competitor })}
            disabled={disabled}
            placeholder="Competitor Inc"
          />
          <Field
            id={`${rowId}-claim`}
            label="What they claim"
            value={row.claim}
            onChange={(claim) => patch({ claim })}
            disabled={disabled}
            multiline
            placeholder="“The fastest way to publish.”"
          />
          <Field
            id={`${rowId}-claimedAt`}
            label="Seen claiming it on"
            value={row.claimedAt ? row.claimedAt.slice(0, 10) : ''}
            onChange={(claimedAt) => patch({ claimedAt })}
            disabled={disabled}
            type="date"
          />
          <Field
            id={`${rowId}-source`}
            label="Source"
            value={row.source}
            onChange={(source) => patch({ source })}
            disabled={disabled}
            placeholder="Their home page"
          />
          <ConfidenceSelect
            id={`${rowId}-confidence`}
            value={row.confidence}
            onChange={(confidence) => patch({ confidence })}
            disabled={disabled}
          />
        </>
      )}
    />
  )
}

export function WhyUsSection({ content, onChange, disabled }: IcpSectionProps) {
  const patch = (whyUs: Partial<IcpContent['whyUs']>) =>
    onChange({ ...content, whyUs: { ...content.whyUs, ...whyUs } })
  return (
    <>
      <Field
        id="icp-whyus"
        label="Why you, for this audience?"
        value={content.whyUs.text}
        onChange={(text) => patch({ text })}
        disabled={disabled}
        multiline
        placeholder="The only one that shows its work: every claim carries the evidence it came from."
      />
      <ConfidenceSelect
        id="icp-whyus-confidence"
        value={content.whyUs.confidence}
        onChange={(confidence) => patch({ confidence })}
        disabled={disabled}
      />
    </>
  )
}

export function ChannelsSection({ content, onChange, disabled }: IcpSectionProps) {
  return (
    <RowsEditor
      id="icp-channels"
      rows={content.channels}
      onChange={(channels) => onChange({ ...content, channels })}
      empty={() => ({ channel: '', note: '', confidence: null })}
      addLabel="Add a channel"
      disabled={disabled}
      emptyText="No channels recorded."
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-channel`}
            label="Where"
            value={row.channel}
            onChange={(channel) => patch({ channel })}
            disabled={disabled}
            placeholder="A weekly marketing-ops newsletter"
          />
          <Field
            id={`${rowId}-note`}
            label="What they go there for"
            value={row.note}
            onChange={(note) => patch({ note })}
            disabled={disabled}
            placeholder="Tactics they can run this week."
          />
          <ConfidenceSelect
            id={`${rowId}-confidence`}
            value={row.confidence}
            onChange={(confidence) => patch({ confidence })}
            disabled={disabled}
          />
        </>
      )}
    />
  )
}

export function BoundariesSection({ content, onChange, disabled }: IcpSectionProps) {
  return (
    <>
      <TextRows
        id="icp-notouruser"
        label="Not our user"
        rows={content.notOurUser}
        onChange={(notOurUser) => onChange({ ...content, notOurUser })}
        disabled={disabled}
        addLabel="Add a boundary"
        placeholder="Agencies publishing for twenty clients at once."
        hint="People a draft should not be written for, even when the topic fits."
      />
      <TextRows
        id="icp-churn"
        label="Churn triggers"
        rows={content.churnTriggers}
        onChange={(churnTriggers) => onChange({ ...content, churnTriggers })}
        disabled={disabled}
        addLabel="Add a trigger"
        placeholder="A reviewer who never has time to approve a brief."
        hint="What makes an existing customer leave. The writer avoids promising past these."
      />
    </>
  )
}

export const ICP_SECTION_COMPONENTS: Record<
  Exclude<IcpStepId, 'review'>,
  (props: IcpSectionProps) => React.JSX.Element
> = {
  who: WhoSection,
  pains: PainsSection,
  motivation: MotivationSection,
  solution: SolutionSection,
  competition: CompetitionSection,
  whyUs: WhyUsSection,
  channels: ChannelsSection,
  boundaries: BoundariesSection,
}
