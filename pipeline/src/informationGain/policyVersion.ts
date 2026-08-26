import { createHash } from 'node:crypto'

/**
 * Stable identifier for a resolved policy, stamped onto every stored result so
 * a scorecard can be traced back to the thresholds that produced it. It lives
 * here rather than in the shared lib because that lib must not import `node:*`.
 */
export function policyVersion(canonical: string): string {
  return `ig-v1:${createHash('sha256').update(canonical).digest('hex').slice(0, 16)}`
}
