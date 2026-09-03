import type { Payload } from 'payload'

import {
  type BrandVoiceContent,
  LANGUAGE_LEVELS,
  MAX_ADJECTIVES,
  MAX_SAMPLES,
  parseBrandVoiceContent,
} from './brandVoice'
import { BRAND_VOICE_FIXTURE } from './brandVoiceFixture'
import {
  type CmsLlmBilled,
  CmsLlmError,
  cmsMockMode,
  completeJsonCms,
  logCmsCost,
} from './cmsLlm'
import type { CodexTextRequest, CodexTextResult } from './codexCompletion'
import type { LlmProvider } from './llmProvider'
import { type LlmSettingsDoc, resolveExtractionModel } from './llmSettings'

export interface ExtractionResult {
  content: BrandVoiceContent
  warnings: string[]
  provider: LlmProvider | 'mock'
  model: string
  usage: { inputTokens: number; outputTokens: number }
}

/** Admin Models global → BRAND_VOICE_EXTRACT_MODEL → default. */
export function extractionModel(
  env: Record<string, string | undefined> = process.env,
  settings: LlmSettingsDoc | null = null,
): string {
  return resolveExtractionModel(settings, env).model
}

/** The shared CMS rule (`cmsMockMode`), defaulted to the extraction model. */
export function extractionMockMode(
  env: Record<string, string | undefined> = process.env,
  model: string = extractionModel(env),
): boolean {
  return cmsMockMode(env, model)
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

const EXTRACTION_LABEL = 'Brand voice extraction'

/**
 * Thrown when the (billed) model call succeeded but its reply could not be
 * used. A `CmsLlmError` narrowed to this feature, so callers can tell an
 * extraction failure apart from any other CMS-side model call.
 */
export class BrandVoiceExtractionError extends CmsLlmError {
  constructor(message: string, billed: CmsLlmBilled) {
    super(message, billed)
    this.name = 'BrandVoiceExtractionError'
  }
}

function mockExtraction(filename: string, model: string): ExtractionResult {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
  return {
    content: { ...BRAND_VOICE_FIXTURE, name: base ? `${base} (extracted)` : BRAND_VOICE_FIXTURE.name },
    warnings: ['Mock mode: returned the demo brand voice instead of calling the model'],
    provider: 'mock',
    model,
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

/**
 * One model call that fills the same fields the onboarding stepper produces.
 * The result is always run through `parseBrandVoiceContent`, so callers get a
 * clean record plus the list of anything that had to be fixed. `model`
 * defaults to the env/default resolution; the server action passes the
 * admin's Models-global choice.
 */
export async function extractBrandVoiceFromText(input: {
  text: string
  filename: string
  model?: string
  completeViaCodex?: (req: CodexTextRequest) => Promise<CodexTextResult>
}): Promise<ExtractionResult> {
  const model = input.model || extractionModel()
  if (extractionMockMode(process.env, model)) return mockExtraction(input.filename, model)

  let result
  try {
    result = await completeJsonCms(
      {
        system: EXTRACTION_SYSTEM_PROMPT,
        user: `Source file: ${input.filename}\n\n<document>\n${input.text}\n</document>`,
        model,
        label: EXTRACTION_LABEL,
      },
      { completeViaCodex: input.completeViaCodex },
    )
  } catch (error) {
    // Re-badge so the long-standing `instanceof BrandVoiceExtractionError`
    // checks in the server action keep working; the message and billed usage
    // are the ones `completeJsonCms` produced.
    if (error instanceof CmsLlmError) throw new BrandVoiceExtractionError(error.message, error.billed)
    throw error
  }

  const { content, warnings } = parseBrandVoiceContent(result.json)
  return { content, warnings, provider: result.provider, model: result.model, usage: result.usage }
}

/**
 * The one cost-log row every extraction leaves behind. Accepts a failed call's
 * `billed` details too, so a malformed reply still has its spend recorded.
 */
export async function logExtractionCost(
  payload: Payload,
  runId: string,
  result: Pick<ExtractionResult, 'provider' | 'model' | 'usage'> &
    Partial<Pick<ExtractionResult, 'content' | 'warnings'>>,
  request: { filename: string; sourceChars: number },
): Promise<void> {
  await logCmsCost(payload, {
    runId,
    stage: 'brandVoiceExtract',
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    request,
    response: result.content
      ? { warnings: result.warnings ?? [], name: result.content.name }
      : { error: 'reply unusable; see server log' },
  })
}
