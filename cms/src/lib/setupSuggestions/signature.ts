import { createHash } from 'node:crypto'
export function claimSignature(tokens: string[]): string {
  return `unbacked_claim:${createHash('sha1')
    .update([...new Set(tokens)].sort().join(' '))
    .digest('hex')}`
}
