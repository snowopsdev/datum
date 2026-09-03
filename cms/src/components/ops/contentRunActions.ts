'use server'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { ActivePipelineRunError, createPipelineRun } from '../../lib/createPipelineRun'
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
      error: `Configure the required environment variables: ${readiness.runtime.blockers.join(', ')}.`,
    }
  }
  if (!readiness.governance.ready) {
    return {
      ok: false,
      error: `Finish setup before starting a content run: ${readiness.governance.problems.join('; ')}.`,
    }
  }
  if (!setup.templates.some((template) => template.id === input.templateId)) {
    return { ok: false, error: 'Choose an existing content template.' }
  }
  if (readiness.mode === 'live' && input.confirmLiveCost !== true) {
    return { ok: false, error: 'Confirm the live provider cost before starting this run.' }
  }

  const runId = randomUUID()
  const requestedBy = user.email || String(user.id)
  try {
    await createPipelineRun(payload, user, {
      runId,
      source: input.source,
      templateId: input.templateId,
      count: input.count,
      requestedBy,
      readiness,
    })
  } catch (error) {
    if (error instanceof ActivePipelineRunError) return { ok: false, error: error.message }
    return { ok: false, error: 'Another content run started at the same time. Try again shortly.' }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/ops/content')
  return { ok: true, runId }
}
