import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

import { codexAuthFilePresent } from './codexAuth'

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
  codexAuthPresent: boolean
  /**
   * `TARGET_DOMAIN` verbatim. The workspace profile owns the policy now
   * (`cms/src/lib/tenant/workspaceProfile.ts`); this is only its env fallback,
   * so it is undefined rather than defaulted and never throws here.
   */
  targetDomain: string | undefined
  /** `COMPETITOR_DOMAINS` verbatim; `[]` when unset. Same story as `targetDomain`. */
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
  const codexAuthPresent = codexAuthFilePresent(process.env)

  // Per-stage model choice lives in the admin's Models global (see models.ts),
  // so the per-model key check happens there once the run knows its models.
  // A Codex login is deliberately not part of this inference: mock is the local
  // default, and a dev machine that happens to carry a login must not be flipped
  // into live runs by it.
  const mockMode =
    parseBool(process.env.MOCK_MODE) ?? (anthropicApiKey === undefined && openaiApiKey === undefined)
  const noCredential =
    anthropicApiKey === undefined && openaiApiKey === undefined && !codexAuthPresent
  if (!mockMode && noCredential) {
    throw new Error(
      'MOCK_MODE=false requires ANTHROPIC_API_KEY or OPENAI_API_KEY to be set, or a Codex login (codex login)',
    )
  }

  const ahrefsApiKey = process.env.AHREFS_API_KEY || undefined
  // Domain and competitors are workspace facts, not deployment facts: the
  // `workspace-profile` global owns them and these env vars are its fallback.
  // Config therefore stays synchronous and opinion-free — the "you need a
  // target domain" check moved to `loadWorkspaceProfile`, which is the first
  // place that can see both the global and the env.
  const targetDomain = process.env.TARGET_DOMAIN?.trim() || undefined
  const competitorDomains = (process.env.COMPETITOR_DOMAINS || '')
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0)

  return {
    mockMode,
    anthropicApiKey,
    openaiApiKey,
    codexAuthPresent,
    targetDomain,
    competitorDomains,
    ahrefsApiKey,
    ahrefsCountry: process.env.AHREFS_COUNTRY || 'us',
  }
}

export const config: PipelineConfig = buildConfig()
