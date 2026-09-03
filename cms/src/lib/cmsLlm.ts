/**
 * The CMS-side equivalent of the pipeline's `completeJSONLogged`: one JSON
 * model call plus one cost-log row. Admin-triggered features (brand-voice
 * extraction, "Draft with AI" on the onboarding steps) run inside Next, not
 * the pipeline CLI, so they cannot reach `pipeline/src/llm.ts` — this module
 * keeps them on the same provider routing, mock rule and billing record
 * instead of each growing its own copy.
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { Payload } from 'payload'

import type { CostLog } from '../payload-types'
import {
  type CodexTextRequest,
  type CodexTextResult,
  completeTextViaCodex,
} from './codexCompletion'
import {
  apiKeyForModel,
  type LlmProvider,
  providerForModel,
  requirementForModel,
} from './llmProvider'
import { costUsd } from './pricing'

export interface CmsLlmRequest {
  system: string
  user: string
  model: string
  maxTokens?: number
  /**
   * How the call names itself in failure messages ("Brand voice extraction
   * returned no text…"). Callers surface these to admins, so each feature
   * gets to say what failed rather than a generic "model call".
   */
  label?: string
}

export interface CmsLlmResult {
  json: unknown
  text: string
  provider: LlmProvider | 'mock'
  model: string
  usage: { inputTokens: number; outputTokens: number }
}

/** Billing details of a call that was charged, whether or not its reply was usable. */
export type CmsLlmBilled = Pick<CmsLlmResult, 'provider' | 'model' | 'usage'>

/**
 * Thrown when the (billed) model call succeeded but its reply could not be
 * used. Carries the usage so the caller can still log the cost.
 */
export class CmsLlmError extends Error {
  constructor(
    message: string,
    public readonly billed: CmsLlmBilled,
  ) {
    super(message)
    this.name = 'CmsLlmError'
  }
}

const DEFAULT_MAX_TOKENS = 8000

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false
  return undefined
}

/**
 * Same rule as `pipeline/src/config.ts`: `MOCK_MODE` wins when set, otherwise
 * mock whenever the model's credential is absent — an API key for the key
 * providers, a Codex CLI login for `codex/*`. Never throws — the admin flow
 * must work in a keyless dev environment.
 */
export function cmsMockMode(
  env: Record<string, string | undefined> = process.env,
  model: string,
): boolean {
  const explicit = parseBool(env.MOCK_MODE)
  if (explicit !== undefined) return explicit
  // A Codex login is not consent to spend the plan, so it never activates a
  // live call on its own. `pipeline/src/config.ts` and `modeFromEnv` make the
  // same call; if this one differed, an upload would bill quota while the rest
  // of the workspace still reported mock.
  return requirementForModel(model).kind === 'codex-login'
    ? true
    : apiKeyForModel(model, env) === undefined
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

/**
 * One JSON-returning model call, routed by model id: `codex/*` through the
 * local Codex CLI, `gpt-*` through OpenAI's Responses API, everything else
 * through Anthropic Messages.
 *
 * Deliberately refuses to run in mock mode rather than inventing a reply: the
 * shape of a useful mock is the caller's business (brand-voice extraction
 * returns a demo record, a draft step returns placeholder copy), so callers
 * check `cmsMockMode` and pick their own fixture first.
 */
export async function completeJsonCms(
  request: CmsLlmRequest,
  deps: {
    completeViaCodex?: (req: CodexTextRequest) => Promise<CodexTextResult>
    env?: Record<string, string | undefined>
  } = {},
): Promise<CmsLlmResult> {
  const env = deps.env ?? process.env
  const { model, system, user } = request
  const label = request.label ?? 'Model call'
  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS
  if (cmsMockMode(env, model)) {
    throw new Error(`${label} was attempted in mock mode; callers must supply their own fixture`)
  }

  const provider = providerForModel(model)

  let text: string | undefined
  let stopReason: string
  let usage: { inputTokens: number; outputTokens: number }
  if (provider === 'codex') {
    const response = await (deps.completeViaCodex ?? completeTextViaCodex)({ system, user, model })
    text = response.text || undefined
    stopReason = 'completed'
    usage = {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    }
  } else if (provider === 'openai') {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const response = await client.responses.create({
      model,
      instructions: system,
      input: user,
      max_output_tokens: maxTokens,
      text: { format: { type: 'json_object' } },
    })
    text = response.output_text || undefined
    stopReason = response.incomplete_details?.reason ?? response.status ?? 'unknown'
    usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    }
  } else {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })
    text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .at(-1)?.text
    stopReason = response.stop_reason ?? 'unknown'
    usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }

  const billed = { provider, model, usage }
  if (!text) {
    throw new CmsLlmError(`${label} returned no text (stop_reason: ${stopReason})`, billed)
  }
  let json: unknown
  try {
    json = parseJsonReply(text)
  } catch {
    throw new CmsLlmError(`${label} reply was not valid JSON: ${text.trim().slice(0, 200)}`, billed)
  }
  return { json, text, ...billed }
}

/** The stages a CMS-side call may bill against; `cost-log` rejects anything else. */
export type CmsCostStage = NonNullable<CostLog['stage']>

/**
 * The one cost-log row every CMS-side model call leaves behind (mirrors
 * `completeJSONLogged` in the pipeline). Accepts a failed call's `billed`
 * details too, so a malformed reply still has its spend recorded.
 */
export async function logCmsCost(
  payload: Payload,
  entry: CmsLlmBilled & {
    runId: string
    stage: CmsCostStage
    request: CostLog['request']
    response: CostLog['response']
  },
): Promise<void> {
  await payload.create({
    collection: 'cost-log',
    overrideAccess: true,
    data: {
      pipelineRunId: entry.runId,
      stage: entry.stage,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.usage.inputTokens,
      outputTokens: entry.usage.outputTokens,
      webSearchRequests: 0,
      costUsd: costUsd(entry.model, entry.usage.inputTokens, entry.usage.outputTokens),
      request: entry.request,
      response: entry.response,
    },
  })
}
