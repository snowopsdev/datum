'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import {
  matchEvidenceRule,
  normaliseDomain,
  SOURCE_QUALITY_CLASSES,
  type EvidenceSourceRule,
  type SourceQualityClass,
} from '../../lib/informationGain'

const VIEW_PATH = '/admin/ops/governance/source-review'
const SOURCES_PATH = '/admin/collections/evidence-sources'

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Unauthorized')
  return { payload, user }
}

function governanceAuditContext(
  user: { email?: string | null; id: number | string },
  event: string,
  summary: string,
  details?: Record<string, unknown>,
) {
  return {
    governanceAudit: {
      actor: typeof user.email === 'string' ? user.email : String(user.id),
      actorType: 'user' as const,
      event,
      summary,
      details,
    },
  }
}

const actorOf = (user: { email?: string | null; id: number | string }): string =>
  typeof user.email === 'string' ? user.email : String(user.id)

function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message
  }
  return fallback
}

const isQualityClass = (value: string): value is SourceQualityClass =>
  (SOURCE_QUALITY_CLASSES as readonly string[]).includes(value)

/**
 * Rate a domain and take it off the queue.
 *
 * The rating is the whole point: the `evidence-sources` row is what the next
 * scoring run reads, and the candidate row is only the note that somebody
 * should decide. So the rule is written first and the candidate is marked
 * afterwards — if the second write fails, the rating still stands and the
 * candidate simply reappears as pending, which is the harmless direction.
 *
 * The audit trail comes from the `evidence-sources` afterChange hook rather
 * than from anything here; passing the event and the candidate id through
 * `context` is what ties the audit row back to this queue.
 */
export async function approveCandidateAction(input: {
  candidateId: number
  qualityClass: string
  note?: string
}): Promise<ActionResult> {
  try {
    const { payload, user } = await requireUser()
    if (!isQualityClass(input.qualityClass)) {
      return { ok: false, error: `"${input.qualityClass}" is not a source quality class.` }
    }

    const candidate = await payload.findByID({
      collection: 'evidence-source-candidates',
      id: input.candidateId,
      depth: 0,
    })
    const domain = normaliseDomain(candidate.domain)

    const { docs: ruleDocs } = await payload.find({
      collection: 'evidence-sources',
      pagination: false,
      depth: 0,
      overrideAccess: false,
      user,
    })
    const rules: EvidenceSourceRule[] = ruleDocs.map((doc) => ({
      domain: doc.domain,
      qualityClass: doc.qualityClass as SourceQualityClass,
      active: doc.active ?? false,
    }))

    // An active rule already covering this domain means the decision was made
    // elsewhere; creating a second row would collide on the unique domain, and
    // silently editing the existing one would be a different, unasked-for act.
    const covered = matchEvidenceRule(domain, rules)
    if (covered) {
      return {
        ok: false,
        error: `Already rated as ${covered.qualityClass} under ${covered.domain}. Edit that rule instead.`,
      }
    }

    const context = governanceAuditContext(
      user,
      'evidence_source_approved',
      'Approved from the source review queue',
      {
        domain,
        qualityClass: input.qualityClass,
        candidateId: candidate.id,
        citationCount: candidate.citationCount ?? 0,
        serpCount: candidate.serpCount ?? 0,
      },
    )
    const data = {
      domain,
      qualityClass: input.qualityClass,
      note: input.note?.trim() || undefined,
      active: true,
    }

    // A deactivated row for this exact domain is not "covered" above, but it
    // still owns the unique domain, so it has to be revived rather than recreated.
    const dormant = ruleDocs.find((doc) => normaliseDomain(doc.domain) === domain)
    const rule = dormant
      ? await payload.update({
          collection: 'evidence-sources',
          id: dormant.id,
          data,
          user,
          overrideAccess: false,
          context,
        })
      : await payload.create({
          collection: 'evidence-sources',
          data,
          user,
          overrideAccess: false,
          context,
        })

    await payload.update({
      collection: 'evidence-source-candidates',
      id: candidate.id,
      overrideAccess: true,
      data: {
        status: 'approved',
        resolvedSource: rule.id,
        resolvedAt: new Date().toISOString(),
        resolvedBy: actorOf(user),
      },
    })

    revalidatePath(VIEW_PATH)
    revalidatePath(SOURCES_PATH)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not rate this domain.') }
  }
}

/**
 * Set a candidate's status without touching `evidence-sources`.
 *
 * Dismissing rates nothing: the domain stays unrated and is scored exactly as
 * it was, capped at the unknown-domain ceiling. It only says "stop asking me",
 * which is why the pipeline never reopens a dismissal on its own.
 */
async function setStatus(
  candidateId: number,
  status: 'dismissed' | 'pending',
  fallback: string,
): Promise<ActionResult> {
  try {
    const { payload, user } = await requireUser()
    const resolved = status === 'dismissed'
    await payload.update({
      collection: 'evidence-source-candidates',
      id: candidateId,
      overrideAccess: true,
      data: {
        status,
        resolvedAt: resolved ? new Date().toISOString() : null,
        resolvedBy: resolved ? actorOf(user) : null,
        ...(status === 'pending' ? { resolvedSource: null } : {}),
      },
    })
    revalidatePath(VIEW_PATH)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, fallback) }
  }
}

export async function dismissCandidateAction(candidateId: number): Promise<ActionResult> {
  return setStatus(candidateId, 'dismissed', 'Could not dismiss this domain.')
}

export async function reopenCandidateAction(candidateId: number): Promise<ActionResult> {
  return setStatus(candidateId, 'pending', 'Could not reopen this domain.')
}
