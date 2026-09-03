import type { EvidenceBankContent, Fact, RejectedClaim, VerifiedClaim } from '../../lib/tenant/evidenceBank'

/**
 * What the setup editors send to their save actions.
 *
 * They live outside `tenantActions.ts` because that file is `'use server'`:
 * every export there is a server action, and a client component that imported
 * a type from it would be importing the action module to get something the
 * compiler erases anyway.
 */

export type WorkspaceProfileInput = {
  companyName: string
  targetDomain: string
  competitors: { domain: string; name: string }[]
  siteNotes: string
}

/**
 * A row the operator has just typed has no ref yet: the global's
 * `assignEvidenceRefs` hook mints one on save and never reuses it. Sending an
 * invented ref would either collide with a published article's citation or be
 * overwritten, so new rows carry none and saved rows carry theirs unchanged.
 */
export type NewRow<T extends { ref: string }> = Omit<T, 'ref'> & { ref?: string }

export type EvidenceBankInput = {
  verifiedClaims: NewRow<VerifiedClaim>[]
  facts: NewRow<Fact>[]
  rejectedClaims: NewRow<RejectedClaim>[]
}

/** The editor's working copy: the saved bank, with unsaved rows mixed in. */
export type EvidenceBankDraft = {
  verifiedClaims: NewRow<VerifiedClaim>[]
  facts: NewRow<Fact>[]
  rejectedClaims: NewRow<RejectedClaim>[]
}

export const emptyEvidenceBankDraft = (bank: EvidenceBankContent): EvidenceBankDraft => ({
  verifiedClaims: bank.verifiedClaims.map((row) => ({ ...row })),
  facts: bank.facts.map((row) => ({ ...row })),
  rejectedClaims: bank.rejectedClaims.map((row) => ({ ...row })),
})
