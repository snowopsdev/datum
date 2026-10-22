/**
 * The reason chips beside Send back. The free-text reason is what the writer
 * reads and is required; a chip only tags it, and its code goes into the audit
 * event's `details` so reasons can be counted later without parsing prose.
 *
 * Here and not in `actions.ts`: a `'use server'` module may only export async
 * functions, and the picker and the action both need this list.
 */
export const SEND_BACK_REASONS = [
  { code: 'weak_evidence', label: 'Weak evidence' },
  { code: 'off_brief', label: 'Off-brief' },
  { code: 'needs_depth', label: 'Needs more depth' },
  { code: 'wrong_audience', label: 'Wrong audience' },
  { code: 'other', label: 'Other' },
] as const

export type SendBackReasonCode = (typeof SEND_BACK_REASONS)[number]['code']

export function isSendBackReasonCode(value: unknown): value is SendBackReasonCode {
  return SEND_BACK_REASONS.some((reason) => reason.code === value)
}
