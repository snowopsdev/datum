import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { Payload } from 'payload'

import type { CostLog } from '../../cms/src/payload-types'

import { config, type LlmStage } from './config'
import { mockFixture, mockUsage } from './fixtures'
import { type LlmProvider, providerForModel } from './llmProvider'
import { costUsd } from './pricing'

export interface LlmRequest {
  system: string
  user: string
  needWebSearch?: boolean
  /** Mock mode only: selects a sub-fixture when one LlmStage serves several call shapes. */
  fixtureKey?: string
}

export interface LlmResult {
  json: unknown
  usage: {
    inputTokens: number
    outputTokens: number
    webSearchRequests: number
  }
  provider: LlmProvider | 'mock'
  model: string
}

export interface LlmClient {
  completeJSON(stage: LlmStage, request: LlmRequest, model: string): Promise<LlmResult>
}

export interface LlmBilled {
  provider: LlmProvider
  model: string
  usage: LlmResult['usage']
}

export type LlmReplyErrorCode =
  | 'max_tokens'
  | 'refusal'
  | 'pause_turn'
  | 'incomplete'
  | 'no_text'
  | 'invalid_json'

/**
 * The provider answered (and billed) but the reply is unusable: cut off at the
 * token cap, refused, paused, empty, or not JSON. Carries what was billed so
 * `completeJSONLogged` can still write the cost row; without it a retry buys
 * the same call again and nothing records the first.
 */
export class LlmReplyError extends Error {
  constructor(
    message: string,
    public readonly code: LlmReplyErrorCode,
    public readonly billed: LlmBilled,
  ) {
    super(message)
    this.name = 'LlmReplyError'
  }
}

const JSON_ONLY = 'Reply with only a single JSON object. No prose, no code fences.'

let anthropicClient: Anthropic | undefined
let openaiClient: OpenAI | undefined

function getClient(): Anthropic {
  anthropicClient ??= new Anthropic({ apiKey: config.anthropicApiKey })
  return anthropicClient
}

function getOpenAI(): OpenAI {
  openaiClient ??= new OpenAI({ apiKey: config.openaiApiKey })
  return openaiClient
}

function parseJsonReply(text: string, stage: LlmStage): unknown {
  // Models sometimes wrap JSON in code fences despite instructions not to.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  try {
    return JSON.parse(stripped)
  } catch {
    // The web-search stages cannot use JSON mode (see `completeJSONOpenAI`), so
    // the prompt is the only thing holding the model to a bare object and it
    // sometimes adds a sentence either side. Fall back to the outermost braces
    // before giving up.
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1))
      } catch {
        // fall through to the error below
      }
    }
    throw new Error(`[llm:${stage}] model reply was not valid JSON: ${stripped.slice(0, 200)}`)
  }
}

/**
 * `web_search_20260209` (dynamic filtering) is served by the Fable/Mythos
 * models, Opus 4.6 and later, Sonnet 4.6 and later. Older models, Haiku
 * included, only know the basic `web_search_20250305`.
 */
const DYNAMIC_WEB_SEARCH_MODEL =
  /^claude-(?:(?:fable|mythos)-|opus-(?:5|4-[6-9])|sonnet-(?:5|4-[6-9]))/

export function webSearchToolFor(model: string) {
  const type = DYNAMIC_WEB_SEARCH_MODEL.test(model.trim())
    ? ('web_search_20260209' as const)
    : ('web_search_20250305' as const)
  return { type, name: 'web_search' as const, max_uses: 5 }
}

/**
 * The reply text: the text blocks after the last non-text block, joined. A
 * search reply interleaves narration, tool calls and results, and the answer
 * is whatever follows the last of them; cited text is split across several
 * blocks (one per citation), so taking only the final block would keep a
 * fragment of the JSON.
 */
export function anthropicReplyText(content: readonly { type: string; text?: string }[]): string {
  let start = 0
  content.forEach((block, index) => {
    if (block.type !== 'text' && block.type !== 'thinking' && block.type !== 'redacted_thinking') {
      start = index + 1
    }
  })
  return content
    .slice(start)
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
}

function parseOrThrow(text: string, stage: LlmStage, billed: LlmBilled): unknown {
  try {
    return parseJsonReply(text, stage)
  } catch (error) {
    throw new LlmReplyError(
      error instanceof Error ? error.message : String(error),
      'invalid_json',
      billed,
    )
  }
}

/** Provider SDK clients, injectable so tests can supply fakes. */
export interface LlmSdkClients {
  anthropic?: Pick<Anthropic, 'messages'>
  openai?: Pick<OpenAI, 'responses'>
}

async function completeJSONAnthropic(
  stage: LlmStage,
  request: LlmRequest,
  model: string,
  sdk: LlmSdkClients,
): Promise<LlmResult> {
  try {
    const response = await (sdk.anthropic ?? getClient()).messages.create({
      model,
      max_tokens: 16000,
      system: `${request.system}\n\n${JSON_ONLY}`,
      messages: [{ role: 'user', content: request.user }],
      ...(request.needWebSearch ? { tools: [webSearchToolFor(model)] } : {}),
    })
    const billed: LlmBilled = {
      provider: 'anthropic',
      model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        webSearchRequests: response.usage.server_tool_use?.web_search_requests ?? 0,
      },
    }
    if (response.stop_reason === 'max_tokens') {
      throw new LlmReplyError(
        `[llm:${stage}] reply truncated at max_tokens (16000) before it was complete`,
        'max_tokens',
        billed,
      )
    }
    if (response.stop_reason === 'refusal') {
      const details = response.stop_details
      throw new LlmReplyError(
        `[llm:${stage}] the model refused this request (stop_reason: refusal` +
          `${details?.category ? `, category: ${details.category}` : ''}` +
          `${details?.explanation ? `, ${details.explanation}` : ''})`,
        'refusal',
        billed,
      )
    }
    if (response.stop_reason === 'pause_turn') {
      throw new LlmReplyError(
        `[llm:${stage}] the model paused its turn (stop_reason: pause_turn) before answering; resuming a paused turn is not supported`,
        'pause_turn',
        billed,
      )
    }
    const finalText = anthropicReplyText(response.content)
    if (!finalText) {
      throw new LlmReplyError(
        `[llm:${stage}] response contained no text block (stop_reason: ${response.stop_reason})`,
        'no_text',
        billed,
      )
    }
    return { json: parseOrThrow(finalText, stage, billed), usage: billed.usage, provider: 'anthropic', model }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error(`[llm:${stage}] invalid ANTHROPIC_API_KEY: ${error.message}`)
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error(
        `[llm:${stage}] rate limited by the Claude API — retry later: ${error.message}`,
      )
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new Error(`[llm:${stage}] could not reach the Claude API: ${error.message}`)
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`[llm:${stage}] Claude API error ${error.status}: ${error.message}`)
    }
    throw error
  }
}

async function completeJSONOpenAI(
  stage: LlmStage,
  request: LlmRequest,
  model: string,
  sdk: LlmSdkClients,
): Promise<LlmResult> {
  try {
    const response = await (sdk.openai ?? getOpenAI()).responses.create({
      model,
      instructions: `${request.system}\n\n${JSON_ONLY}`,
      // `JSON_ONLY` is repeated on the input, not just the instructions:
      // `text.format: json_object` is rejected outright unless the word "json"
      // appears in the *input messages*, and `instructions` does not count.
      // Without this the call fails with a 400 for every prompt whose user text
      // does not happen to mention JSON — which is most of them.
      input: `${request.user}\n\n${JSON_ONLY}`,
      // The web-search stages answer for a whole batch of claims and cite full
      // URLs per claim, which runs far longer than the non-search stages; at
      // 16k they get cut off mid-object and the truncated text then fails to
      // parse. Give them room rather than losing the whole (paid) call.
      max_output_tokens: request.needWebSearch ? 32000 : 16000,
      // JSON mode and the web-search tool are mutually exclusive — the API
      // rejects the pair with "Web Search cannot be used with JSON mode". The
      // search stages therefore fall back to the same contract the Anthropic
      // path uses everywhere: ask for JSON in the prompt and parse defensively.
      ...(request.needWebSearch
        ? { tools: [{ type: 'web_search' as const }] }
        : { text: { format: { type: 'json_object' as const } } }),
    })
    const finalText = response.output_text
    const billed: LlmBilled = {
      provider: 'openai',
      model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        webSearchRequests: response.output.filter((item) => item.type === 'web_search_call').length,
      },
    }
    // A reply cut off at the token cap is still *text*, and valid JSON right up
    // to the point it stops — so it slips past the empty check below and dies in
    // the parser as "not valid JSON", which sends whoever reads the log hunting
    // for a prompt bug that isn't there. Name the real cause.
    if (response.status === 'incomplete') {
      throw new LlmReplyError(
        `[llm:${stage}] reply truncated before it was complete ` +
          `(reason: ${response.incomplete_details?.reason ?? 'unknown'}, ` +
          `max_output_tokens: ${response.max_output_tokens ?? 'n/a'})`,
        'incomplete',
        billed,
      )
    }
    if (!finalText) {
      throw new LlmReplyError(
        `[llm:${stage}] response contained no text (status: ${response.status}, reason: ${response.incomplete_details?.reason ?? 'n/a'})`,
        'no_text',
        billed,
      )
    }
    return {
      json: parseOrThrow(finalText, stage, billed),
      usage: billed.usage,
      provider: 'openai',
      model,
    }
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      throw new Error(`[llm:${stage}] invalid OPENAI_API_KEY: ${error.message}`)
    }
    if (error instanceof OpenAI.RateLimitError) {
      throw new Error(
        `[llm:${stage}] rate limited by the OpenAI API — retry later: ${error.message}`,
      )
    }
    if (error instanceof OpenAI.APIConnectionError) {
      throw new Error(`[llm:${stage}] could not reach the OpenAI API: ${error.message}`)
    }
    if (error instanceof OpenAI.APIError) {
      throw new Error(`[llm:${stage}] OpenAI API error ${error.status}: ${error.message}`)
    }
    throw error
  }
}

async function completeJSONMock(
  stage: LlmStage,
  model: string,
  fixtureKey?: string,
): Promise<LlmResult> {
  return {
    json: mockFixture(stage, fixtureKey),
    usage: { ...mockUsage[stage] },
    provider: 'mock',
    model,
  }
}

function completeJSONLive(
  stage: LlmStage,
  request: LlmRequest,
  model: string,
  sdk: LlmSdkClients,
): Promise<LlmResult> {
  switch (providerForModel(model)) {
    case 'openai':
      return completeJSONOpenAI(stage, request, model, sdk)
    case 'anthropic':
      return completeJSONAnthropic(stage, request, model, sdk)
    // `loadStageModels` rejects these before a run starts; this is the second
    // line of the same fence, for any caller that did not go through it.
    case 'unknown':
      return Promise.reject(
        new Error(`[llm:${stage}] "${model}" is not an Anthropic or OpenAI model id`),
      )
  }
}

/** Build a run-scoped adapter so queued runs do not depend on mutable module state. */
export function createLlmClient(mode: 'mock' | 'live', sdk: LlmSdkClients = {}): LlmClient {
  return {
    completeJSON(stage, request, model) {
      // `fixtureKey` must survive: a `claimExtraction` request without it gets
      // the whole `{ page, facets }` fixture object instead of the one it asked
      // for, and the parsers reject that.
      if (mode === 'mock') return completeJSONMock(stage, model, request.fixtureKey)
      return completeJSONLive(stage, request, model, sdk)
    },
  }
}

export interface CostContext {
  payload: Payload
  runId: string
  /** Model per stage for this run, from the admin's Models global / env / default. */
  models: Record<LlmStage, string>
  /** The run's mode. Decides the fallback client when `llm` is not supplied. */
  mode?: 'mock' | 'live'
  llm?: LlmClient
  /** The run's lease signal; an aborted run makes no further model calls. */
  signal?: AbortSignal
}

function jsonSnapshot(value: unknown): NonNullable<CostLog['request']> {
  return JSON.parse(JSON.stringify(value)) as NonNullable<CostLog['request']>
}

/**
 * The model call succeeded but its cost row could not be written.
 *
 * Its own type so a caller that tolerates a failed *model* call — falling back
 * to something deterministic — can still let this one through: a paid call
 * with no cost row, or a missing migration behind it, must stop the stage.
 */
export class CostLogWriteError extends Error {
  /** `afterFailure`: the unusable-reply error this row was being written for, if any. */
  constructor(stage: LlmStage, cause: unknown, afterFailure?: Error) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    super(
      `cost-log write failed for ${stage}: ${reason}` +
        (afterFailure ? ` (the model call had also failed: ${afterFailure.message})` : ''),
      { cause },
    )
    this.name = 'CostLogWriteError'
  }
}

/**
 * completeJSON plus the one CostLog row every LLM call must leave behind.
 * Stages call this so cost tracking cannot be forgotten at individual call sites.
 */
export async function completeJSONLogged(
  ctx: CostContext,
  stage: LlmStage,
  articleId: number,
  request: LlmRequest,
): Promise<LlmResult> {
  ctx.signal?.throwIfAborted()
  const mode = ctx.mode ?? (config.mockMode ? 'mock' : 'live')
  let result: LlmResult
  try {
    result = await (ctx.llm ?? createLlmClient(mode)).completeJSON(stage, request, ctx.models[stage])
  } catch (error) {
    // The provider answered and billed, but the reply was unusable. The row
    // goes in before the error is rethrown so the spend is on record and the
    // retry does not look free; a row that cannot be written stops the stage
    // the same way it does after a good reply.
    if (error instanceof LlmReplyError) {
      await writeCostRow(ctx, stage, articleId, request, error.billed, { error: error.message }, error)
    }
    throw error
  }
  await writeCostRow(ctx, stage, articleId, request, result, result.json)
  return result
}

async function writeCostRow(
  ctx: CostContext,
  stage: LlmStage,
  articleId: number,
  request: LlmRequest,
  billed: LlmBilled | LlmResult,
  response: unknown,
  afterFailure?: Error,
): Promise<void> {
  try {
    await ctx.payload.create({
      collection: 'cost-log',
      overrideAccess: true,
      data: {
        pipelineRunId: ctx.runId,
        article: articleId,
        stage,
        provider: billed.provider,
        model: billed.model,
        inputTokens: billed.usage.inputTokens,
        outputTokens: billed.usage.outputTokens,
        webSearchRequests: billed.usage.webSearchRequests,
        costUsd: costUsd(
          billed.model,
          billed.usage.inputTokens,
          billed.usage.outputTokens,
          billed.usage.webSearchRequests,
        ),
        request: jsonSnapshot(request),
        response: jsonSnapshot(response),
      },
    })
  } catch (error) {
    throw new CostLogWriteError(stage, error, afterFailure)
  }
}
