'use server'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'

export interface StartContentRunInput {
  source: 'onboarding' | 'admin'
  templateId: number
  count: number
  confirmLiveCost?: boolean
}

export type StartContentRunResult = { ok: true; runId: string } | { ok: false; error: string }

export async function startContentRunAction(
  input: StartContentRunInput,
): Promise<StartContentRunResult> {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) return { ok: false, error: 'Sign in to start a content run.' }

  const setup = await loadWorkspaceSetup(payload)
  const { readiness } = setup
  if (!readiness.runtime.ready) {
    return {
      ok: false,
      error: `Configure the required environment variables: ${readiness.runtime.missing.join(', ')}.`,
    }
  }
  if (!readiness.governance.ready) {
    return { ok: false, error: 'Activate a brand voice before starting a content run.' }
  }
  if (!setup.templates.some((template) => template.id === input.templateId)) {
    return { ok: false, error: 'Choose an existing content template.' }
  }
  if (readiness.mode === 'live' && input.confirmLiveCost !== true) {
    return { ok: false, error: 'Confirm the live provider cost before starting this run.' }
  }

  const active = await payload.find({
    collection: 'pipeline-runs',
    where: { status: { in: ['queued', 'running'] } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (active.docs.length > 0) {
    return { ok: false, error: `Run ${active.docs[0].runId} is already in progress.` }
  }

  const runId = randomUUID()
  const requestedCount = input.source === 'onboarding' ? 1 : Math.max(1, Math.min(5, input.count))
  const requestedBy = user.email || String(user.id)
  await payload.create({
    collection: 'pipeline-runs',
    overrideAccess: true,
    data: {
      runId,
      source: input.source,
      status: 'queued',
      mode: readiness.mode,
      template: input.templateId,
      requestedCount,
      configFingerprint: readiness.configFingerprint,
      configSnapshot: {
        mode: readiness.mode,
        requiredEnvironment: readiness.runtime.missing,
        activeVoiceId: readiness.governance.activeVoiceId,
        templateId: input.templateId,
        models: readiness.content.models.map(
          ({ stage, model, source, provider, envVar, configured }) => ({
            stage,
            model,
            source,
            provider,
            envVar,
            configured,
          }),
        ),
      },
      requestedBy,
    },
  })
  await payload.jobs.queue({
    task: 'content-run',
    queue: 'content',
    input: { runId },
    overrideAccess: true,
  })

  revalidatePath('/admin')
  revalidatePath('/admin/ops/articles')
  return { ok: true, runId }
}
