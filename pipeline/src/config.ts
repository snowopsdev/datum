import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(here, '..', '..')

// Load env before anything reads process.env (cms/payload.config.ts reads
// DATABASE_URL/PAYLOAD_SECRET at import time). dotenv never overrides vars
// that are already set, so real env wins over files, cms/.env over root .env.
dotenv.config({ path: path.join(repoRoot, 'cms', '.env') })
dotenv.config({ path: path.join(repoRoot, '.env') })

export type { PipelineStage as LlmStage } from '../../cms/src/lib/llmSettings'

export interface PipelineConfig {
  mockMode: boolean
  anthropicApiKey: string | undefined
  openaiApiKey: string | undefined
  targetDomain: string
  competitorDomains: string[]
  ahrefsApiKey: string | undefined
  ahrefsCountry: string
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false
  throw new Error(`Cannot parse boolean env value: ${value}`)
}

function buildConfig(): PipelineConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || undefined
  const openaiApiKey = process.env.OPENAI_API_KEY || undefined

  // Per-stage model choice lives in the admin's Models global (see models.ts),
  // so the per-model key check happens there once the run knows its models.
  const mockMode =
    parseBool(process.env.MOCK_MODE) ?? (anthropicApiKey === undefined && openaiApiKey === undefined)
  if (!mockMode && anthropicApiKey === undefined && openaiApiKey === undefined) {
    throw new Error('MOCK_MODE=false requires ANTHROPIC_API_KEY or OPENAI_API_KEY to be set')
  }

  const ahrefsApiKey = process.env.AHREFS_API_KEY || undefined
  const targetDomain = process.env.TARGET_DOMAIN || (mockMode || !ahrefsApiKey ? 'datum.example.com' : '')
  if (!targetDomain) {
    throw new Error('TARGET_DOMAIN is required when AHREFS_API_KEY is set')
  }
  const competitorDomains = (
    process.env.COMPETITOR_DOMAINS ||
    (mockMode || !ahrefsApiKey ? 'competitor-one.com,competitor-two.com' : '')
  )
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
  if (competitorDomains.length === 0) {
    throw new Error('COMPETITOR_DOMAINS is required when AHREFS_API_KEY is set')
  }

  return {
    mockMode,
    anthropicApiKey,
    openaiApiKey,
    targetDomain,
    competitorDomains,
    ahrefsApiKey,
    ahrefsCountry: process.env.AHREFS_COUNTRY || 'us',
  }
}

export const config: PipelineConfig = buildConfig()
