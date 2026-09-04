'use server'

import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { readAuditDetails } from '../../lib/readAuditDetails'
import type { AuditSource, AuditDetailResult } from './auditTypes'

export async function auditDetailsAction(
  input: AuditSource & { articleId: number },
): Promise<AuditDetailResult> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return { ok: false, error: 'Sign in to read evidence.' }
    return await readAuditDetails(payload, user, input)
  } catch {
    return { ok: false, error: 'Could not load evidence. Try again.' }
  }
}
