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
import {
  COMPETITOR_DOMAINS_ENV_VAR,
  type EvidenceBankContent,
  type EvidenceBankSummary,
  evidenceBankSummary,
  positioningCompletenessProblems,
  type PositioningContent,
  type PositioningStatus,
  positioningStatus,
  type ResolvedWorkspaceProfile,
  TARGET_DOMAIN_ENV_VAR,
  tenantFingerprint,
  type WorkspaceProfileSource,
} from './tenant'

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
  /**
   * The workspace profile as the pipeline will resolve it — admin global first,
   * then env. Passed in rather than read from `env` here so this evaluator and
   * the run agree on one answer about which site we write for.
   */
  profile: ResolvedWorkspaceProfile
  /**
   * The workspace's *active* audiences. Drafts are deliberately invisible here:
   * readiness answers "can this workspace write", and an unfinished audience
   * cannot govern a piece.
   */
  icps: (ReadinessEntity & { name: string; primary: boolean })[]
  /**
   * The positioning global as saved, and when. Recommended rather than
   * required: it never gates a run, but editing it changes every prompt, so it
   * joins the fingerprint.
   */
  positioning: { content: PositioningContent | null; updatedAt: string | null }
  /**
   * The evidence bank as saved, and when. Recommended like positioning: an
   * empty bank never blocks a run, it only means the writer may state nothing
   * about the workspace itself. `asOf` decides which claims have expired.
   */
  evidenceBank: {
    content: EvidenceBankContent | null
    updatedAt: string | null
    /** `YYYY-MM-DD`. Defaults to today when the caller does not pin one. */
    asOf?: string
  }
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

export interface TenantReadiness {
  profile: {
    /** A run can be researched: the workspace knows which site it writes for. */
    ready: boolean
    targetDomain: string | null
    competitorCount: number
    source: { targetDomain: WorkspaceProfileSource; competitors: WorkspaceProfileSource }
  }
  icps: {
    /** A draft can be written for somebody: at least one audience is active. */
    ready: boolean
    count: number
    primaryId: number | string | null
  }
  /**
   * Recommended, never blocking. `partial` is still injected into prompts —
   * the renderer omits empty sections — so this is a nudge about sharpening,
   * not a gate.
   */
  positioning: { status: PositioningStatus; problems: string[] }
  /**
   * Recommended, never blocking. `ready` means there is at least one thing a
   * draft could cite — one unexpired claim, or one plain fact.
   */
  evidenceBank: { status: 'missing' | 'ready' } & EvidenceBankSummary
  /**
   * What is worth doing next but nothing waits on, in the words an operator
   * acts on. Kept apart from `governance.problems` so a caller cannot turn a
   * recommendation into a blocker by rendering the two lists together.
   */
  recommendations: string[]
}

export interface WorkspaceReadiness {
  ready: boolean
  mode: PipelineMode
  configFingerprint: string
  tenant: TenantReadiness
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
    /**
     * Everything still missing, in the words an operator acts on. Callers
     * interpolate this rather than writing their own copy, so the setup hub,
     * the content-run action, and the brief all say the same thing.
     */
    problems: string[]
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
export function modeFromEnv(env: Record<string, string | undefined>): PipelineMode {
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

  const profile = input.profile
  const missing = new Set<string>()
  if (mode === 'live') {
    if (!configured(input.env.AHREFS_API_KEY)) missing.add('AHREFS_API_KEY')
    // The env vars are the fallback, not the source of truth: a workspace whose
    // Workspace global names the domain has nothing missing, so naming the
    // variable would send an operator to fix something that is already set.
    if (!profile.targetDomain) missing.add(TARGET_DOMAIN_ENV_VAR)
    if (profile.competitors.length === 0) missing.add(COMPETITOR_DOMAINS_ENV_VAR)
    for (const model of models) {
      if (!model.configured && model.envVar) missing.add(model.envVar)
    }
  }

  const configFingerprint = fingerprint({
    mode,
    runtime: {
      ahrefs: configured(input.env.AHREFS_API_KEY),
      // The resolved values, not the env vars: moving the domain from
      // TARGET_DOMAIN into the Workspace global changes nothing about the run,
      // so it must not stale a verification, but changing the domain itself
      // changes every gap report and must.
      target: profile.targetDomain,
      competitors: profile.competitors.map((competitor) => competitor.domain),
      providers: [...new Set(models.map((model) => model.envVar ?? 'codex-login'))]
        .sort()
        .map((name) => [
          name,
          name === 'codex-login' ? codexLoggedIn : configured(input.env[name]),
        ]),
    },
    voice: input.activeVoice ? [input.activeVoice.id, input.activeVoice.updatedAt] : null,
    // Editing an audience or the position changes every prompt the next run
    // sends, so either stales a verification exactly the way editing the brand
    // voice does.
    tenant: tenantFingerprint({
      profile,
      icps: input.icps,
      positioningUpdatedAt: input.positioning.updatedAt,
      evidenceBankUpdatedAt: input.evidenceBank.updatedAt,
    }),
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
  const primaryIcp = input.icps.find((icp) => icp.primary) ?? input.icps[0] ?? null
  const icpsReady = input.icps.length > 0
  const profileReady = profile.targetDomain !== null
  // Governance is now three assets, not one. A workspace with a voice but no
  // domain researches the wrong site; one with no audience writes for nobody.
  const governanceProblems = [
    ...(input.activeVoice === null ? ['Activate a brand voice'] : []),
    ...(profileReady ? [] : ['Set the target domain']),
    ...(icpsReady ? [] : ['Add and activate at least one audience (ICP)']),
  ]
  const governanceReady = governanceProblems.length === 0
  const contentReady = input.templates.length > 0

  // Recommendations, not problems: a workspace with no position writes fine,
  // it just writes less like itself.
  const positioning = positioningStatus(input.positioning.content)
  const positioningProblems =
    positioning === 'missing' || !input.positioning.content
      ? []
      : positioningCompletenessProblems(input.positioning.content)
  // The bank's own clock. Anything that expires is judged against the day the
  // question is asked, so an operator who opens the hub tomorrow sees the claim
  // that went stale overnight.
  const bankAsOf = input.evidenceBank.asOf ?? new Date().toISOString().slice(0, 10)
  const bank = evidenceBankSummary(input.evidenceBank.content, bankAsOf)
  const bankReady = bank.usable > 0 || bank.facts > 0
  const recommendations = [
    ...(positioning === 'missing' ? ['Add positioning'] : []),
    ...(positioning === 'partial'
      ? [`Finish positioning: ${positioningProblems.join('; ')}`]
      : []),
    ...(bankReady ? [] : ['Add an evidence bank']),
    // Separate from "add one", because a workspace with expired claims has done
    // the work once and needs a different, smaller thing done to it.
    ...(bank.expired > 0
      ? [`Re-check ${bank.expired} expired claim${bank.expired === 1 ? '' : 's'}`]
      : []),
  ]

  return {
    // What making content actually requires. Runtime problems surface as a
    // banner for whoever deploys; the verification run is no longer a gate.
    ready: governanceReady && contentReady,
    mode,
    configFingerprint,
    tenant: {
      profile: {
        ready: profileReady,
        targetDomain: profile.targetDomain,
        competitorCount: profile.competitors.length,
        source: profile.source,
      },
      icps: {
        ready: icpsReady,
        count: input.icps.length,
        primaryId: primaryIcp?.id ?? null,
      },
      positioning: { status: positioning, problems: positioningProblems },
      evidenceBank: { status: bankReady ? 'ready' : 'missing', ...bank },
      recommendations,
    },
    runtime: {
      ready: runtimeReady,
      missing: [...missing].sort(),
      needsCodexLogin,
      blockers: [...[...missing].sort(), ...(needsCodexLogin ? ['`codex login` on this host'] : [])],
    },
    governance: {
      ready: governanceReady,
      activeVoiceId: input.activeVoice?.id ?? null,
      problems: governanceProblems,
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
