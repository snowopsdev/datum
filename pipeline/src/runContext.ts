import type { Payload } from 'payload'

import { createAhrefsClient } from './ahrefs'
import { loadActiveBrandVoice } from './brandVoice'
import { loadEvidenceSources, loadInformationGainPolicy } from './informationGain/policy'
import { createLlmClient } from './llm'
import { loadStageModels } from './models'
import type { StageContext } from './stages'
import { loadStyleGuide } from './styleGuide'
import { loadTenantContext } from './tenant'

/** Resolve the run's independent workspace inputs once, before discovery. */
export async function loadStageInputs(payload: Payload, mode: 'mock' | 'live') {
  const [tenant, models, brandVoice, policy, evidenceSources] = await Promise.all([
    loadTenantContext(payload, { mode }),
    loadStageModels(payload, { env: process.env, mockMode: mode === 'mock' }),
    loadActiveBrandVoice(payload),
    loadInformationGainPolicy(payload),
    loadEvidenceSources(payload),
  ])
  return { tenant, models, brandVoice, policy, evidenceSources }
}

export function buildStageContext(
  payload: Payload,
  runId: string,
  mode: 'mock' | 'live',
  inputs: Awaited<ReturnType<typeof loadStageInputs>>,
): StageContext {
  return {
    payload,
    runId,
    mode,
    ...inputs,
    ahrefs: createAhrefsClient(mode, inputs.tenant.profile),
    styleGuide: loadStyleGuide(),
    llm: createLlmClient(mode),
  }
}
