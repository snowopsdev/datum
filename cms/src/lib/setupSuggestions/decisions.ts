import type { Payload } from 'payload'
import type { SetupSuggestion } from '../../payload-types'
import { governanceAuditContext } from '../governanceAudit'
import { suggestionAssets, suggestionSatisfied } from './collect'
/** The existing users auth collection is the admin identity; no role field exists. */
export function requireSuggestionAdmin(user: { collection?: string } | null | undefined) {
  if (!user || user.collection !== 'users')
    throw new Error('Sign in as an admin to change setup suggestions.')
}
export async function decideSuggestion(
  payload: Payload,
  user: { id: number | string; email?: string | null },
  row: SetupSuggestion,
  status: 'accepted' | 'dismissed',
  reason = '',
) {
  const event = status === 'accepted' ? 'setup_suggestion_accepted' : 'setup_suggestion_dismissed'
  await payload.update({
    collection: 'setup-suggestions',
    id: row.id,
    overrideAccess: true,
    data: {
      status,
      decidedBy: user.email ?? String(user.id),
      decidedAt: new Date().toISOString(),
      decisionReason: reason,
    },
    context: governanceAuditContext(user, event, `Setup suggestion ${status}: ${row.signature}`, {
      suggestionId: row.id,
      kind: row.kind,
      signature: row.signature,
      ...(reason ? { reason } : {}),
    }),
  })
}
export async function completeSuggestionAfterEdit(
  payload: Payload,
  user: { id: number | string; email?: string | null },
  id: number | undefined,
  target: 'brand-voice' | 'evidence-bank',
) {
  if (!id) return
  const row = await payload.findByID({ collection: 'setup-suggestions', id, overrideAccess: true })
  if (
    row.status !== 'open' ||
    row.target !== target ||
    !['not_trait', 'rejected_ref'].includes(row.kind ?? '')
  )
    return
  const assets = await suggestionAssets(payload)
  if (suggestionSatisfied(row, assets.voiceContent, assets.bank))
    await decideSuggestion(payload, user, row, 'accepted')
}
