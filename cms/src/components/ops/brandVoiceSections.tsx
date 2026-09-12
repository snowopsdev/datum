'use client'

import React from 'react'

import {
  type BrandVoiceContent,
  LANGUAGE_LEVELS,
  MAX_ADJECTIVES,
  MAX_CORE_VALUES,
  MAX_SAMPLES,
  SHORT_BANNED_WORD_LENGTH,
  TONE_DIALS,
} from '../../lib/brandVoice'
import type { StepId } from './brandVoiceTypes'
import { Field, RowsEditor } from './setupFields'

export type SectionProps = {
  content: BrandVoiceContent
  onChange: (next: BrandVoiceContent) => void
  disabled: boolean
}

/**
 * One component per brand-voice step, keyed by step id at the bottom of this
 * file, on the same `Field`/`RowsEditor` primitives as the other setup assets.
 */

export function EssenceSection({ content, onChange, disabled }: SectionProps) {
  const patch = (essence: Partial<BrandVoiceContent['essence']>) =>
    onChange({ ...content, essence: { ...content.essence, ...essence } })
  return (
    <>
      <Field
        id="bv-name"
        label="Brand voice name"
        value={content.name}
        onChange={(name) => onChange({ ...content, name })}
        disabled={disabled}
        placeholder="Acme brand voice"
      />
      <Field
        id="bv-oneLiner"
        label="Brand essence — what you do and for whom, in one sentence"
        value={content.essence.oneLiner}
        onChange={(oneLiner) => patch({ oneLiner })}
        disabled={disabled}
        placeholder="Acme helps small clinics run their billing without an accountant."
      />
      <Field
        id="bv-mission"
        label="Mission"
        value={content.essence.mission}
        onChange={(mission) => patch({ mission })}
        disabled={disabled}
        multiline
        placeholder="The change you are trying to make for the people you serve."
      />
    </>
  )
}

export function ValuesSection({ content, onChange, disabled }: SectionProps) {
  return (
    <RowsEditor
      id="bv-values"
      rows={content.coreValues}
      onChange={(coreValues) => onChange({ ...content, coreValues })}
      empty={() => ({ value: '', description: '' })}
      addLabel="Add a value"
      max={MAX_CORE_VALUES}
      disabled={disabled}
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-value`}
            label="Value"
            value={row.value}
            onChange={(value) => patch({ value })}
            disabled={disabled}
            placeholder="Trust"
          />
          <Field
            id={`${rowId}-description`}
            label="What it means for how we write"
            value={row.description}
            onChange={(description) => patch({ description })}
            disabled={disabled}
            multiline
            placeholder="Say what we know, what we guessed, and what we did not test."
          />
        </>
      )}
    />
  )
}

export function AudienceSection({ content, onChange, disabled }: SectionProps) {
  const patch = (audience: Partial<BrandVoiceContent['audience']>) =>
    onChange({ ...content, audience: { ...content.audience, ...audience } })
  return (
    <>
      <Field
        id="bv-audience"
        label="Who are you talking to?"
        value={content.audience.description}
        onChange={(description) => patch({ description })}
        disabled={disabled}
        multiline
        placeholder="Founders and marketers at companies under 50 people who own content but are not writers."
      />
      <div className="datum-ops__field">
        <label htmlFor="bv-languageLevel">Language level</label>
        <select
          id="bv-languageLevel"
          value={content.audience.languageLevel ?? ''}
          onChange={(e) =>
            patch({
              languageLevel: (e.target.value || null) as BrandVoiceContent['audience']['languageLevel'],
            })
          }
          disabled={disabled}
        >
          <option value="">Not set</option>
          {LANGUAGE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <p className="datum-ops__hint">
          plain = no assumed knowledge · general = everyday reader · professional = works in the
          field · expert = deep specialist
        </p>
      </div>
      <Field
        id="bv-interests"
        label="Interests"
        value={content.audience.interests}
        onChange={(interests) => patch({ interests })}
        disabled={disabled}
        multiline
      />
      <Field
        id="bv-needs"
        label="Needs and pain points"
        value={content.audience.needs}
        onChange={(needs) => patch({ needs })}
        disabled={disabled}
        multiline
      />
    </>
  )
}

export function PersonaSection({ content, onChange, disabled }: SectionProps) {
  return (
    <Field
      id="bv-persona"
      label="Your brand as a person at a party"
      value={content.persona}
      onChange={(persona) => onChange({ ...content, persona })}
      disabled={disabled}
      multiline
      placeholder="The friend who has already tried the thing you are about to buy. Talks plainly, answers the actual question, cracks a dry joke…"
    />
  )
}

export function AdjectivesSection({ content, onChange, disabled }: SectionProps) {
  return (
    <>
      <RowsEditor
        id="bv-adjectives"
        rows={content.voiceAdjectives}
        onChange={(voiceAdjectives) => onChange({ ...content, voiceAdjectives })}
        empty={() => ({ adjective: '', description: '', doExample: '', dontExample: '' })}
        addLabel="Add an adjective"
        max={MAX_ADJECTIVES}
        disabled={disabled}
        renderRow={({ row, rowId, patch }) => (
          <>
            <Field
              id={`${rowId}-adjective`}
              label="Adjective"
              value={row.adjective}
              onChange={(adjective) => patch({ adjective })}
              disabled={disabled}
              placeholder="Plain-spoken"
            />
            <Field
              id={`${rowId}-description`}
              label="What it means"
              value={row.description}
              onChange={(description) => patch({ description })}
              disabled={disabled}
              multiline
            />
            <Field
              id={`${rowId}-doExample`}
              label="Do — a sentence that sounds like us"
              value={row.doExample}
              onChange={(doExample) => patch({ doExample })}
              disabled={disabled}
              multiline
            />
            <Field
              id={`${rowId}-dontExample`}
              label="Don’t — a sentence that does not"
              value={row.dontExample}
              onChange={(dontExample) => patch({ dontExample })}
              disabled={disabled}
              multiline
            />
          </>
        )}
      />
      <Field
        id="bv-ownWords"
        label="In your own words (optional, longer form)"
        value={content.voiceInOwnWords}
        onChange={(voiceInOwnWords) => onChange({ ...content, voiceInOwnWords })}
        disabled={disabled}
        multiline
      />
    </>
  )
}

export function NotTraitsSection({ content, onChange, disabled }: SectionProps) {
  return (
    <RowsEditor
      id="bv-notTraits"
      rows={content.notTraits}
      onChange={(notTraits) => onChange({ ...content, notTraits })}
      empty={() => ({ trait: '', boundaryNote: '' })}
      addLabel="Add a boundary"
      disabled={disabled}
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-trait`}
            label="We are not…"
            value={row.trait}
            onChange={(trait) => patch({ trait })}
            disabled={disabled}
            placeholder="Sarcastic"
          />
          <Field
            id={`${rowId}-boundaryNote`}
            label="Where the line is"
            value={row.boundaryNote}
            onChange={(boundaryNote) => patch({ boundaryNote })}
            disabled={disabled}
            multiline
            placeholder="Dry humour is fine; jokes at the reader’s expense are not."
          />
        </>
      )}
    />
  )
}

export function ToneSection({ content, onChange, disabled }: SectionProps) {
  return (
    <div className="datum-ops__sliders">
      {TONE_DIALS.map((dial) => {
        const id = `bv-tone-${dial.key}`
        const value = content.tone[dial.key]
        return (
          <div className="datum-ops__slider" key={dial.key}>
            <label htmlFor={id}>
              {dial.label} <span>{value}/5</span>
            </label>
            <div className="datum-ops__slider-track">
              <span>{dial.low}</span>
              <input
                id={id}
                type="range"
                min={1}
                max={5}
                step={1}
                value={value}
                onChange={(e) =>
                  onChange({
                    ...content,
                    tone: { ...content.tone, [dial.key]: Number(e.target.value) },
                  })
                }
                disabled={disabled}
              />
              <span>{dial.high}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WordsSection({ content, onChange, disabled }: SectionProps) {
  return (
    <>
      <h3 className="datum-ops__section-title">Words we love</h3>
      <RowsEditor
        id="bv-preferred"
        rows={content.preferredWords}
        onChange={(preferredWords) => onChange({ ...content, preferredWords })}
        empty={() => ({ word: '', note: '' })}
        addLabel="Add a preferred word"
        disabled={disabled}
        renderRow={({ row, rowId, patch }) => (
          <>
            <Field
              id={`${rowId}-word`}
              label="Word"
              value={row.word}
              onChange={(word) => patch({ word })}
              disabled={disabled}
              placeholder="pick"
            />
            <Field
              id={`${rowId}-note`}
              label="Note (optional)"
              value={row.note}
              onChange={(note) => patch({ note })}
              disabled={disabled}
              placeholder="instead of “select”"
            />
          </>
        )}
      />
      <h3 className="datum-ops__section-title">Words we ban</h3>
      <p className="datum-ops__hint" style={{ marginBottom: 10 }}>
        Enforced by a deterministic check on every generated field — an article that uses one goes
        to needs revision.
      </p>
      <RowsEditor
        id="bv-banned"
        rows={content.bannedWords}
        onChange={(bannedWords) => onChange({ ...content, bannedWords })}
        empty={() => ({ word: '', note: '' })}
        addLabel="Add a banned word"
        disabled={disabled}
        renderRow={({ row, rowId, patch }) => (
          <>
            <Field
              id={`${rowId}-word`}
              label="Word or phrase"
              value={row.word}
              onChange={(word) => patch({ word })}
              disabled={disabled}
              placeholder="synergy"
            />
            <Field
              id={`${rowId}-note`}
              label="Why (optional)"
              value={row.note}
              onChange={(note) => patch({ note })}
              disabled={disabled}
              placeholder="corporate filler"
            />
            {row.word.trim() && row.word.trim().length < SHORT_BANNED_WORD_LENGTH ? (
              <p className="datum-ops__warn">
                “{row.word.trim()}” is very short and will match a lot of ordinary text. Consider a
                longer phrase.
              </p>
            ) : null}
          </>
        )}
      />
    </>
  )
}

export function SamplesSection({ content, onChange, disabled }: SectionProps) {
  return (
    <RowsEditor
      id="bv-samples"
      rows={content.samples}
      onChange={(samples) => onChange({ ...content, samples })}
      empty={() => ({ title: '', text: '' })}
      addLabel="Add a sample"
      max={MAX_SAMPLES}
      disabled={disabled}
      renderRow={({ row, rowId, patch }) => (
        <>
          <Field
            id={`${rowId}-title`}
            label="Title (optional)"
            value={row.title}
            onChange={(title) => patch({ title })}
            disabled={disabled}
            placeholder="Product pick intro"
          />
          <Field
            id={`${rowId}-text`}
            label="Sample text"
            value={row.text}
            onChange={(text) => patch({ text })}
            disabled={disabled}
            multiline
          />
        </>
      )}
    />
  )
}

export const SECTION_COMPONENTS: Record<StepId, (props: SectionProps) => React.JSX.Element> = {
  essence: EssenceSection,
  values: ValuesSection,
  audience: AudienceSection,
  persona: PersonaSection,
  adjectives: AdjectivesSection,
  notTraits: NotTraitsSection,
  tone: ToneSection,
  words: WordsSection,
  samples: SamplesSection,
}
