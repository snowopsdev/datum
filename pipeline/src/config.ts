import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

import { runModeFromEnv } from '../../cms/src/lib/runMode'

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

function buildConfig(): PipelineConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || undefined
  const openaiApiKey = process.env.OPENAI_API_KEY || undefined

  // Per-stage model choice lives in the admin's Models global (see models.ts),
  // so the per-model key check happens there once the run knows its models.
  // The mock/live rule is shared with the CMS (`runMode.ts`) and never throws:
  // this module loads inside the admin, which must stay up on a bad env.
  const mockMode = runModeFromEnv(process.env) === 'mock'

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
    targetDomain,
    competitorDomains,
    ahrefsApiKey,
    ahrefsCountry: process.env.AHREFS_COUNTRY || 'us',
  }
}

export const config: PipelineConfig = buildConfig()
