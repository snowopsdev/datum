import Anthropic from '@anthropic-ai/sdk'
import type { Payload } from 'payload'

import type { CostLog } from '../../cms/src/payload-types'

import { config, type LlmStage } from './config'
import { mockFixture, mockUsage } from './fixtures'
import { costUsd } from './pricing'

export interface LlmRequest {
  system: string
  user: string
  needWebSearch?: boolean
}

export interface LlmResult {
  json: unknown
  usage: { inputTokens: number; outputTokens: number; webSearchRequests: number }
  provider: 'anthropic' | 'mock'
  model: string
}

let anthropicClient: Anthropic | undefined

function getClient(): Anthropic {
  anthropicClient ??= new Anthropic({ apiKey: config.anthropicApiKey })
  return anthropicClient
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
    throw new Error(`[llm:${stage}] model reply was not valid JSON: ${stripped.slice(0, 200)}`)
  }
}

async function completeJSONAnthropic(stage: LlmStage, request: LlmRequest): Promise<LlmResult> {
  const model = config.models[stage]
  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 16000,
      system: `${request.system}\n\nReply with only a single JSON object. No prose, no code fences.`,
      messages: [{ role: 'user', content: request.user }],
      ...(request.needWebSearch
        ? {
            // SDK 0.70 types only know web_search_20250305; the API accepts the
            // newer server-tool version, so cast past the stale union.
            tools: [
              {
                type: 'web_search_20260209',
                name: 'web_search',
                max_uses: 5,
              } as unknown as Anthropic.ToolUnion,
            ],
          }
        : {}),
    })
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )
    const finalText = textBlocks.at(-1)?.text
    if (!finalText) {
      throw new Error(`[llm:${stage}] response contained no text block (stop_reason: ${response.stop_reason})`)
    }
    return {
      json: parseJsonReply(finalText, stage),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        webSearchRequests: response.usage.server_tool_use?.web_search_requests ?? 0,
      },
      provider: 'anthropic',
      model,
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error(`[llm:${stage}] invalid ANTHROPIC_API_KEY: ${error.message}`)
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error(`[llm:${stage}] rate limited by the Claude API — retry later: ${error.message}`)
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

async function completeJSONMock(stage: LlmStage): Promise<LlmResult> {
  return {
    json: mockFixture(stage),
    usage: { ...mockUsage[stage] },
    provider: 'mock',
    model: config.models[stage],
  }
}

/** The single LLM call site: every model-calling stage goes through here. */
export async function completeJSON(stage: LlmStage, request: LlmRequest): Promise<LlmResult> {
  return config.mockMode ? completeJSONMock(stage) : completeJSONAnthropic(stage, request)
}

export interface CostContext {
  payload: Payload
  runId: string
}

function jsonSnapshot(value: unknown): NonNullable<CostLog['request']> {
  return JSON.parse(JSON.stringify(value)) as NonNullable<CostLog['request']>
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
  const result = await completeJSON(stage, request)
  await ctx.payload.create({
    collection: 'cost-log',
    overrideAccess: true,
    data: {
      pipelineRunId: ctx.runId,
      article: articleId,
      stage,
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      webSearchRequests: result.usage.webSearchRequests,
      costUsd: costUsd(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.usage.webSearchRequests,
      ),
      request: jsonSnapshot(request),
      response: jsonSnapshot(result.json),
    },
  })
  return result
}
