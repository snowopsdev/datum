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

export type SectionProps = {
  content: BrandVoiceContent
  onChange: (next: BrandVoiceContent) => void
  disabled: boolean
}

type RowField<T> = {
  key: keyof T & string
  label: string
  multiline?: boolean
  placeholder?: string
}

type RowsEditorProps<T extends Record<string, string>> = {
  id: string
  rows: T[]
  onChange: (rows: T[]) => void
  fields: RowField<T>[]
  empty: () => T
  addLabel: string
  max?: number
  disabled: boolean
  warn?: (row: T) => string | null
}

function RowsEditor<T extends Record<string, string>>({
  id,
  rows,
  onChange,
  fields,
  empty,
  addLabel,
  max,
  disabled,
  warn,
}: RowsEditorProps<T>) {
  const update = (index: number, key: keyof T & string, value: string) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index))
  const atMax = typeof max === 'number' && rows.length >= max

  return (
    <div className="datum-ops__rows">
      {rows.length === 0 ? <p className="datum-ops__empty">Nothing added yet.</p> : null}
      {rows.map((row, index) => {
        const warning = warn?.(row) ?? null
        return (
          <div className="datum-ops__row-card" key={`${id}-${index}`}>
            <div className="datum-ops__row-head">
              <span>#{index + 1}</span>
              <button
                type="button"
                className="datum-ops__link-btn"
                onClick={() => remove(index)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
            {fields.map((field) => {
              const inputId = `${id}-${index}-${field.key}`
              return (
                <div className="datum-ops__field" key={field.key}>
                  <label htmlFor={inputId}>{field.label}</label>
                  {field.multiline ? (
                    <textarea
                      id={inputId}
                      value={row[field.key]}
                      onChange={(e) => update(index, field.key, e.target.value)}
                      disabled={disabled}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      id={inputId}
                      type="text"
                      value={row[field.key]}
                      onChange={(e) => update(index, field.key, e.target.value)}
                      disabled={disabled}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              )
            })}
            {warning ? <p className="datum-ops__warn">{warning}</p> : null}
          </div>
        )
      })}
      <button
        type="button"
        className="datum-ops__btn"
        onClick={() => onChange([...rows, empty()])}
        disabled={disabled || atMax}
      >
        {atMax ? `Maximum ${max}` : addLabel}
      </button>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  multiline,
  placeholder,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  multiline?: boolean
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="datum-ops__field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
      {hint ? <p className="datum-ops__hint">{hint}</p> : null}
    </div>
  )
}

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
      fields={[
        { key: 'value', label: 'Value', placeholder: 'Trust' },
        {
          key: 'description',
          label: 'What it means for how we write',
          multiline: true,
          placeholder: 'Say what we know, what we guessed, and what we did not test.',
        },
      ]}
      empty={() => ({ value: '', description: '' })}
      addLabel="Add a value"
      max={MAX_CORE_VALUES}
      disabled={disabled}
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
        fields={[
          { key: 'adjective', label: 'Adjective', placeholder: 'Plain-spoken' },
          { key: 'description', label: 'What it means', multiline: true },
          { key: 'doExample', label: 'Do — a sentence that sounds like us', multiline: true },
          { key: 'dontExample', label: 'Don’t — a sentence that does not', multiline: true },
        ]}
        empty={() => ({ adjective: '', description: '', doExample: '', dontExample: '' })}
        addLabel="Add an adjective"
        max={MAX_ADJECTIVES}
        disabled={disabled}
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
      fields={[
        { key: 'trait', label: 'We are not…', placeholder: 'Sarcastic' },
        {
          key: 'boundaryNote',
          label: 'Where the line is',
          multiline: true,
          placeholder: 'Dry humour is fine; jokes at the reader’s expense are not.',
        },
      ]}
      empty={() => ({ trait: '', boundaryNote: '' })}
      addLabel="Add a boundary"
      disabled={disabled}
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
        fields={[
          { key: 'word', label: 'Word', placeholder: 'pick' },
          { key: 'note', label: 'Note (optional)', placeholder: 'instead of “select”' },
        ]}
        empty={() => ({ word: '', note: '' })}
        addLabel="Add a preferred word"
        disabled={disabled}
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
        fields={[
          { key: 'word', label: 'Word or phrase', placeholder: 'synergy' },
          { key: 'note', label: 'Why (optional)', placeholder: 'corporate filler' },
        ]}
        empty={() => ({ word: '', note: '' })}
        addLabel="Add a banned word"
        disabled={disabled}
        warn={(row) =>
          row.word.trim() && row.word.trim().length < SHORT_BANNED_WORD_LENGTH
            ? `“${row.word.trim()}” is very short and will match a lot of ordinary text. Consider a longer phrase.`
            : null
        }
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
      fields={[
        { key: 'title', label: 'Title (optional)', placeholder: 'Product pick intro' },
        { key: 'text', label: 'Sample text', multiline: true },
      ]}
      empty={() => ({ title: '', text: '' })}
      addLabel="Add a sample"
      max={MAX_SAMPLES}
      disabled={disabled}
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
