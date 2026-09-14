import type { BrandVoiceContent } from '../../lib/brandVoice'
import type { AuditTimelineEntry } from './articleStatus'
import type { AssetStep } from './AssetStepper'

export type BrandVoiceStatus = 'draft' | 'active' | 'archived'
export type BrandVoiceSource = 'onboarding' | 'upload'
export type BrandVoiceMode = 'onboarding' | 'review' | 'guide'

export type BrandVoiceDTO = BrandVoiceContent & {
  id: number
  status: BrandVoiceStatus
  source: BrandVoiceSource
  onboardingStep: number
  activatedAt: string | null
  activatedBy: string | null
  sourceFile: { id: number; filename: string; url: string } | null
  updatedAt: string
}

export type BrandVoiceInput = BrandVoiceContent & {
  onboardingStep?: number
}

export type BrandVoiceAuditEntry = AuditTimelineEntry

export type StepId =
  | 'essence'
  | 'values'
  | 'audience'
  | 'persona'
  | 'adjectives'
  | 'notTraits'
  | 'tone'
  | 'words'
  | 'samples'

/**
 * The nine questions the voice is made of.
 *
 * Their count is also the stored `onboardingStep` scale — a draft saved on the
 * third question comes back at the third question — so nothing that is not a
 * question belongs in this list. No step carries an `assist`: the voice is the
 * one setup asset the assistant does not draft.
 */
export const STEPS: readonly AssetStep<StepId>[] = [
  {
    id: 'essence',
    title: 'Brand essence & mission',
    blurb: 'One sentence on what you do and for whom, then the change you are trying to make.',
  },
  {
    id: 'values',
    title: 'Core values',
    blurb: 'Three to five things the business stands for (trust, speed…). Every article should sound like it believes them.',
  },
  {
    id: 'audience',
    title: 'Target audience',
    blurb: 'Who you are talking to. We match their language level, interests, and what they need from you.',
  },
  {
    id: 'persona',
    title: 'Human persona',
    blurb: 'Picture your brand as a real person at a party. How do they talk, joke, or help others?',
  },
  {
    id: 'adjectives',
    title: 'Three adjectives',
    blurb: 'Pick three words that describe how you sound, and show each one with a do and a don’t.',
  },
  {
    id: 'notTraits',
    title: 'What we are NOT',
    blurb: 'Traits to avoid so the team knows the boundaries — “funny, but not sarcastic”.',
  },
  {
    id: 'tone',
    title: 'Tone dials',
    blurb: 'Four sliders. Your voice stays fixed; these dials set where it sits by default.',
  },
  {
    id: 'words',
    title: 'Word choices',
    blurb: 'Words you love, and jargon you want banned. Banned words are enforced on every generated field.',
  },
  {
    id: 'samples',
    title: 'Sample writing',
    blurb: 'Paste up to three pieces you already consider on-voice. They become examples for the writer.',
  },
]

export const STEP_COUNT = STEPS.length

/** The three steps that are not questions: what is missing, and two readouts. */
export type BrandVoiceStepId = StepId | 'review' | 'guide' | 'history'

/**
 * The rail the editor actually renders: the nine questions, then the review
 * gate, then the guide and the history that used to be tabs. The three tail
 * steps sit after `STEP_COUNT`, which is what keeps a stored `onboardingStep`
 * meaning the same thing it meant before they existed.
 */
export const BRAND_VOICE_STEPS: readonly AssetStep<BrandVoiceStepId>[] = [
  ...STEPS,
  {
    id: 'review',
    title: 'Review & activate',
    blurb: 'What is still missing, and whether this voice governs every pipeline run.',
  },
  {
    id: 'guide',
    title: 'Export guide',
    blurb: 'The whole voice as one document — read it here, or download it as Markdown.',
  },
  {
    id: 'history',
    title: 'History',
    blurb: 'Append-only record of who changed this brand voice, when, and what changed.',
  },
]

/** Rail positions the editor jumps to by name rather than by number. */
export const REVIEW_STEP = STEP_COUNT
export const GUIDE_STEP = STEP_COUNT + 1
