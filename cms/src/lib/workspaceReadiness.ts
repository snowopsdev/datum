import { createHash } from 'node:crypto'

import {
  type LlmProvider,
  providerForModel,
  type ProviderRequirement,
  requirementForModel,
} from './llmProvider'
import {
  type LlmSettingsDoc,
  PIPELINE_STAGES,
  type PipelineStage,
  resolveStageModels,
} from './llmSettings'

export type PipelineMode = 'mock' | 'live'

export interface ReadinessEntity {
  id: number | string
  updatedAt: string
}

export interface ReadinessTemplate extends ReadinessEntity {
  name: string
}

export interface VerificationSnapshot {
  runId: string
  status: 'failed' | 'queued' | 'running' | 'succeeded'
  articleStatus: string | null
  configFingerprint: string
  completedAt: string | null
}

export interface WorkspaceReadinessInput {
  env: Record<string, string | undefined>
  models: LlmSettingsDoc | null
  activeVoice: ReadinessEntity | null
  templates: ReadinessTemplate[]
  verification: VerificationSnapshot | null
  codexLoggedIn?: boolean
}

export interface ModelReadiness {
  stage: PipelineStage
  model: string
  source: 'admin' | 'default' | 'env'
  provider: LlmProvider
  requirement: ProviderRequirement['kind']
  envVar: string | null
  configured: boolean
}

export interface WorkspaceReadiness {
  ready: boolean
  mode: PipelineMode
  configFingerprint: string
  runtime: {
    ready: boolean
    missing: string[]
    needsCodexLogin: boolean
    /**
     * Everything unmet, in the words an operator acts on. `missing` holds
     * environment variable names only, so callers that interpolate it render an
     * empty sentence when the sole blocker is a Codex login.
     */
    blockers: string[]
  }
  governance: {
    ready: boolean
    activeVoiceId: number | string | null
  }
  content: {
    ready: boolean
    templateCount: number
    models: ModelReadiness[]
  }
  verification: {
    ready: boolean
    stale: boolean
    runId: string | null
    articleStatus: string | null
    completedAt: string | null
  }
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

// A Codex login is deliberately absent here, matching `pipeline/src/config.ts`:
// a dev machine that happens to carry one must not be flipped into live runs by
// it. A codex-only workspace reaches live by setting MOCK_MODE=false.
function modeFromEnv(env: Record<string, string | undefined>): PipelineMode {
  const value = env.MOCK_MODE?.trim().toLowerCase()
  if (value === 'false' || value === '0' || value === 'no') return 'live'
  if (value === 'true' || value === '1' || value === 'yes') return 'mock'
  return configured(env.ANTHROPIC_API_KEY) || configured(env.OPENAI_API_KEY) ? 'live' : 'mock'
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function evaluateWorkspaceReadiness(input: WorkspaceReadinessInput): WorkspaceReadiness {
  const mode = modeFromEnv(input.env)
  const codexLoggedIn = input.codexLoggedIn ?? false
  const resolved = resolveStageModels(input.models, input.env)
  const models: ModelReadiness[] = PIPELINE_STAGES.map((stage) => {
    const selection = resolved[stage]
    const requirement = requirementForModel(selection.model)
    return {
      stage,
      model: selection.model,
      source: selection.source,
      provider: providerForModel(selection.model),
      requirement: requirement.kind,
      envVar: requirement.kind === 'env' ? requirement.envVar : null,
      configured:
        mode === 'mock' ||
        (requirement.kind === 'env' ? configured(input.env[requirement.envVar]) : codexLoggedIn),
    }
  })
  const needsCodexLogin = models.some(
    (model) => model.requirement === 'codex-login' && !model.configured,
  )

  const missing = new Set<string>()
  if (mode === 'live') {
    for (const name of ['AHREFS_API_KEY', 'TARGET_DOMAIN', 'COMPETITOR_DOMAINS'] as const) {
      if (!configured(input.env[name])) missing.add(name)
    }
    for (const model of models) {
      if (!model.configured && model.envVar) missing.add(model.envVar)
    }
  }

  const configFingerprint = fingerprint({
    mode,
    runtime: {
      ahrefs: configured(input.env.AHREFS_API_KEY),
      target: configured(input.env.TARGET_DOMAIN),
      competitors: configured(input.env.COMPETITOR_DOMAINS),
      providers: [...new Set(models.map((model) => model.envVar ?? 'codex-login'))]
        .sort()
        .map((name) => [
          name,
          name === 'codex-login' ? codexLoggedIn : configured(input.env[name]),
        ]),
    },
    voice: input.activeVoice ? [input.activeVoice.id, input.activeVoice.updatedAt] : null,
    templates: input.templates
      .map((template) => [template.id, template.updatedAt])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    models: models.map(({ stage, model, source }) => [stage, model, source]),
  })

  const terminalArticle =
    input.verification?.articleStatus === 'qa_passed' ||
    input.verification?.articleStatus === 'needs_revision'
  const verificationCurrent = input.verification?.configFingerprint === configFingerprint
  const verificationReady =
    input.verification?.status === 'succeeded' && terminalArticle && verificationCurrent
  const runtimeReady = missing.size === 0 && !needsCodexLogin
  const governanceReady = input.activeVoice !== null
  const contentReady = input.templates.length > 0

  return {
    // What making content actually requires. Runtime problems surface as a
    // banner for whoever deploys; the verification run is no longer a gate.
    ready: governanceReady && contentReady,
    mode,
    configFingerprint,
    runtime: {
      ready: runtimeReady,
      missing: [...missing].sort(),
      needsCodexLogin,
      blockers: [...[...missing].sort(), ...(needsCodexLogin ? ['`codex login` on this host'] : [])],
    },
    governance: {
      ready: governanceReady,
      activeVoiceId: input.activeVoice?.id ?? null,
    },
    content: {
      ready: contentReady,
      templateCount: input.templates.length,
      models,
    },
    verification: {
      ready: verificationReady,
      stale: Boolean(input.verification && !verificationCurrent),
      runId: input.verification?.runId ?? null,
      articleStatus: input.verification?.articleStatus ?? null,
      completedAt: input.verification?.completedAt ?? null,
    },
  }
}
