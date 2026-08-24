import Anthropic from '@anthropic-ai/sdk'
import type { Payload } from 'payload'

import {
  type BrandVoiceContent,
  LANGUAGE_LEVELS,
  MAX_ADJECTIVES,
  MAX_SAMPLES,
  parseBrandVoiceContent,
} from './brandVoice'
import { BRAND_VOICE_FIXTURE } from './brandVoiceFixture'
import { costUsd } from './pricing'

export const DEFAULT_EXTRACT_MODEL = 'claude-opus-5'

export interface ExtractionResult {
  content: BrandVoiceContent
  warnings: string[]
  provider: 'anthropic' | 'mock'
  model: string
  usage: { inputTokens: number; outputTokens: number }
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false
  return undefined
}

/**
 * Same rule as `pipeline/src/config.ts`: `MOCK_MODE` wins when set, otherwise
 * mock whenever there is no API key. Never throws — the admin flow must work
 * in a keyless dev environment.
 */
export function extractionMockMode(env: Record<string, string | undefined> = process.env): boolean {
  return parseBool(env.MOCK_MODE) ?? !env.ANTHROPIC_API_KEY
}

export function extractionModel(env: Record<string, string | undefined> = process.env): string {
  return env.BRAND_VOICE_EXTRACT_MODEL || DEFAULT_EXTRACT_MODEL
}

const EXTRACTION_SYSTEM_PROMPT = [
  'You extract a structured brand voice from a company brand or style guide.',
  'Read the whole document, then return ONE JSON object with exactly these keys and shapes (use "" or [] when the document is silent — never invent facts):',
  '{',
  '  "name": string (the brand or company name),',
  '  "essence": { "oneLiner": string (what they do and for whom, one sentence), "mission": string },',
  '  "coreValues": [{ "value": string, "description": string }] (3–5 entries),',
  `  "audience": { "description": string, "languageLevel": one of ${LANGUAGE_LEVELS.map((l) => `"${l}"`).join(' | ')}, "interests": string, "needs": string },`,
  '  "persona": string (the brand as a person at a party: how they talk, joke, help),',
  `  "voiceAdjectives": [{ "adjective": string, "description": string, "doExample": string, "dontExample": string }] (exactly ${MAX_ADJECTIVES}),`,
  '  "voiceInOwnWords": string (a longer-form description of the voice, quoting the guide where possible),',
  '  "notTraits": [{ "trait": string, "boundaryNote": string }] (what the brand is NOT, e.g. "funny, but not sarcastic"),',
  '  "tone": { "formality": 1-5 (1 formal, 5 casual), "warmth": 1-5 (1 warm, 5 neutral), "boldness": 1-5 (1 bold, 5 careful), "energy": 1-5 (1 enthusiastic, 5 matter-of-fact) } (integers),',
  '  "preferredWords": [{ "word": string, "note": string }],',
  '  "bannedWords": [{ "word": string, "note": string }] (single words or short phrases the guide forbids),',
  `  "samples": [{ "title": string, "text": string }] (up to ${MAX_SAMPLES} passages quoted verbatim from the document that best show the voice)`,
  '}',
  'Reply with only the JSON object. No prose, no code fences.',
].join('\n')

/**
 * Thrown when the (billed) model call succeeded but its reply could not be
 * used. Carries the usage so the caller can still log the cost.
 */
export class BrandVoiceExtractionError extends Error {
  constructor(
    message: string,
    public readonly billed: Pick<ExtractionResult, 'provider' | 'model' | 'usage'>,
  ) {
    super(message)
    this.name = 'BrandVoiceExtractionError'
  }
}

function parseJsonReply(text: string): unknown {
  // Models sometimes wrap JSON in code fences despite instructions not to.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  return JSON.parse(stripped)
}

function mockExtraction(filename: string): ExtractionResult {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
  return {
    content: { ...BRAND_VOICE_FIXTURE, name: base ? `${base} (extracted)` : BRAND_VOICE_FIXTURE.name },
    warnings: ['Mock mode: returned the demo brand voice instead of calling the model'],
    provider: 'mock',
    model: extractionModel(),
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

/**
 * One model call that fills the same fields the onboarding stepper produces.
 * The result is always run through `parseBrandVoiceContent`, so callers get a
 * clean record plus the list of anything that had to be fixed.
 */
export async function extractBrandVoiceFromText(input: {
  text: string
  filename: string
}): Promise<ExtractionResult> {
  if (extractionMockMode()) return mockExtraction(input.filename)

  const model = extractionModel()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Source file: ${input.filename}\n\n<document>\n${input.text}\n</document>`,
      },
    ],
  })
  const billed = {
    provider: 'anthropic' as const,
    model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  }
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .at(-1)?.text
  if (!text) {
    throw new BrandVoiceExtractionError(
      `Brand voice extraction returned no text (stop_reason: ${response.stop_reason})`,
      billed,
    )
  }
  let json: unknown
  try {
    json = parseJsonReply(text)
  } catch {
    throw new BrandVoiceExtractionError(
      `Brand voice extraction reply was not valid JSON: ${text.trim().slice(0, 200)}`,
      billed,
    )
  }
  const { content, warnings } = parseBrandVoiceContent(json)
  return { content, warnings, ...billed }
}

/**
 * The one cost-log row every extraction leaves behind (mirrors
 * `completeJSONLogged` in the pipeline). Accepts a failed call's `billed`
 * details too, so a malformed reply still has its spend recorded.
 */
export async function logExtractionCost(
  payload: Payload,
  runId: string,
  result: Pick<ExtractionResult, 'provider' | 'model' | 'usage'> &
    Partial<Pick<ExtractionResult, 'content' | 'warnings'>>,
  request: { filename: string; sourceChars: number },
): Promise<void> {
  await payload.create({
    collection: 'cost-log',
    overrideAccess: true,
    data: {
      pipelineRunId: runId,
      stage: 'brandVoiceExtract',
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      webSearchRequests: 0,
      costUsd: costUsd(result.model, result.usage.inputTokens, result.usage.outputTokens),
      request,
      response: result.content
        ? { warnings: result.warnings ?? [], name: result.content.name }
        : { error: 'reply unusable; see server log' },
    },
  })
}
