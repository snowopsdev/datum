'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { BRAND_VOICE_FIXTURE } from '../../lib/brandVoiceFixture'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Sign in first.')
  return { payload, user }
}

/**
 * Activate the demo brand voice so a new workspace can make its first piece
 * without writing a voice guide first. Same upsert the `--with-brand-voice`
 * seed runs; the single-active cascade on the collection keeps it the only
 * active one. The editor can replace it from the Brand voice page any time.
 */
export async function activateDefaultBrandVoiceAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { payload } = await requireUser()
    // Same shape the seed writes; `source`/`onboardingStep` are what the
    // collection type requires beyond the voice content itself.
    const data = {
      ...BRAND_VOICE_FIXTURE,
      status: 'active' as const,
      source: 'onboarding' as const,
      onboardingStep: 9,
    }
    const existing = await payload.find({
      collection: 'brand-voices',
      where: { name: { equals: data.name } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) {
      await payload.update({ collection: 'brand-voices', id: existing.docs[0].id, data })
    } else {
      await payload.create({ collection: 'brand-voices', data })
    }
    revalidatePath('/admin')
    revalidatePath('/admin/ops/governance/brand-voice')
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not activate the default voice.'
    return { ok: false, error: message }
  }
}

/** What the runtime banner needs: live mode with anything missing. */
export async function runtimeStatusAction(): Promise<{
  mode: 'mock' | 'live'
  missing: string[]
  needsCodexLogin: boolean
}> {
  try {
    const { payload } = await requireUser()
    const { readiness } = await loadWorkspaceSetup(payload)
    return {
      mode: readiness.mode,
      missing: readiness.runtime.missing,
      needsCodexLogin: readiness.runtime.needsCodexLogin,
    }
  } catch {
    return { mode: 'mock', missing: [], needsCodexLogin: false }
  }
}
