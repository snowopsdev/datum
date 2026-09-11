'use server'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { ActivePipelineRunError, createPipelineRun } from '../../lib/createPipelineRun'
import { errorMessage } from '../../lib/errorMessage'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { gateRunReadiness } from '../../lib/queueRunForArticles'

export interface StartContentRunInput {
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
  // The one gate every run goes through, so a gap run is refused in the same
  // words as a run queued from the board or an article page.
  const refusal = gateRunReadiness(readiness, input.confirmLiveCost)
  if (refusal) return { ok: false, error: refusal }
  if (!setup.templates.some((template) => template.id === input.templateId)) {
    return { ok: false, error: 'Choose an existing content template.' }
  }

  const runId = randomUUID()
  const requestedBy = user.email || String(user.id)
  try {
    await createPipelineRun(payload, user, {
      runId,
      source: 'admin',
      templateId: input.templateId,
      count: input.count,
      requestedBy,
      readiness,
    })
  } catch (error) {
    if (error instanceof ActivePipelineRunError) return { ok: false, error: error.message }
    // Anything else is not a race — it is a transaction that failed, a job
    // queue that refused, or a database that went away. Guessing "try again
    // shortly" at all of those sent people retrying a run that could never
    // start.
    return { ok: false, error: `Could not start the run: ${errorMessage(error, 'unknown error')}` }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/ops/content')
  return { ok: true, runId }
}
