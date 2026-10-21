/**
 * What changed between the evidence bank as last saved and the copy an
 * operator is typing into, and how a proposed claim is recognised as one the
 * bank already holds.
 *
 * Pure and dependency-free so the editor and a later dirty-guard can share it.
 * The comparison follows `saveEvidenceBankAction`: a row whose text is blank is
 * dropped on save, dates are kept to the day, and a row is compared by its
 * fields rather than by anything the browser attaches to it.
 */

import type { ClearedSurface, Fact, RejectedClaim, VerifiedClaim } from './evidenceBank'

type Row<T extends { ref: string }> = Omit<T, 'ref'> & { ref?: string }

export type EvidenceBankDraftLike = {
  verifiedClaims: Row<VerifiedClaim>[]
  facts: Row<Fact>[]
  rejectedClaims: Row<RejectedClaim>[]
}

export type EvidenceChanges = {
  added: number
  changed: number
  removed: number
  total: number
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const day = (value: unknown): string => text(value).trim().slice(0, 10)

/** JSON with object keys in sorted order, so equal values give equal strings. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** The fields a claim row saves, in the form the save would send them. */
const claimShape = (row: Row<VerifiedClaim>) => ({
  claim: text(row.claim).trim(),
  primarySource: text(row.primarySource),
  sourceUrl: text(row.sourceUrl),
  sourceDate: day(row.sourceDate),
  sampleOrMethod: text(row.sampleOrMethod),
  verificationDepth: text(row.verificationDepth),
  limits: text(row.limits),
  clearedSurfaces: [...(row.clearedSurfaces ?? [])].sort() as ClearedSurface[],
  recheckAt: day(row.recheckAt),
})

const factShape = (row: Row<Fact>) => ({
  fact: text(row.fact).trim(),
  source: text(row.source),
  owner: text(row.owner),
  lastConfirmedAt: day(row.lastConfirmedAt),
})

const rejectedShape = (row: Row<RejectedClaim>) => ({
  claim: text(row.claim).trim(),
  status: row.status === 'expired' ? 'expired' : 'rejected',
  reason: text(row.reason),
  replacement: text(row.replacement),
})

function diffRows<T extends { ref?: string }, S extends Record<string, unknown>>(
  saved: T[],
  current: T[],
  shape: (row: T) => S,
  primary: keyof S,
): { added: number; changed: number; removed: number } {
  // Rows the save would drop for having no text are not part of the document.
  const live = (rows: T[]) => rows.filter((row) => shape(row)[primary])
  const savedByRef = new Map<string, string>()
  for (const row of live(saved)) {
    if (row.ref) savedByRef.set(row.ref, stableStringify(shape(row)))
  }
  let added = 0
  let changed = 0
  const kept = new Set<string>()
  for (const row of live(current)) {
    const before = row.ref ? savedByRef.get(row.ref) : undefined
    if (before === undefined) added += 1
    else {
      kept.add(row.ref as string)
      if (before !== stableStringify(shape(row))) changed += 1
    }
  }
  return { added, changed, removed: savedByRef.size - kept.size }
}

/** How many rows are added, edited or removed relative to the saved bank. */
export function evidenceBankChanges(
  saved: EvidenceBankDraftLike,
  current: EvidenceBankDraftLike,
): EvidenceChanges {
  const parts = [
    diffRows(saved.verifiedClaims, current.verifiedClaims, claimShape, 'claim'),
    diffRows(saved.facts, current.facts, factShape, 'fact'),
    diffRows(saved.rejectedClaims, current.rejectedClaims, rejectedShape, 'claim'),
  ]
  const sum = (key: 'added' | 'changed' | 'removed') =>
    parts.reduce((total, part) => total + part[key], 0)
  const added = sum('added')
  const changed = sum('changed')
  const removed = sum('removed')
  return { added, changed, removed, total: added + changed + removed }
}

/** True when this claim row differs from the saved row with the same ref. */
export function isClaimDirty(
  row: Row<VerifiedClaim>,
  savedClaims: Row<VerifiedClaim>[],
): boolean {
  if (!row.ref) return true
  const before = savedClaims.find((saved) => saved.ref === row.ref)
  return !before || stableStringify(claimShape(before)) !== stableStringify(claimShape(row))
}

/**
 * Indexes of `rows` an editor shows while a filter is on.
 *
 * A row stays visible while it holds unsaved work, so editing it cannot make
 * it vanish from under the cursor.
 */
export function visibleClaimIndexes(
  rows: Row<VerifiedClaim>[],
  savedClaims: Row<VerifiedClaim>[],
  matchesFilter: (row: Row<VerifiedClaim>) => boolean,
): number[] {
  const indexes: number[] = []
  rows.forEach((row, index) => {
    if (matchesFilter(row) || isClaimDirty(row, savedClaims)) indexes.push(index)
  })
  return indexes
}

/**
 * Fold an edited visible list back into the full list it was drawn from.
 *
 * `edited` is what a list editor hands back: the visible rows patched in place,
 * one of them removed, or new rows appended. Rows are matched by position
 * unless one is missing, in which case the missing one is found by identity.
 * Hidden rows are never touched, and appended rows go to the end of the full
 * list rather than being counted twice.
 */
export function spliceVisible<T>(full: T[], visible: number[], edited: T[]): T[] {
  if (edited.length < visible.length) {
    const shown = visible.map((index) => full[index])
    const gone = shown.findIndex((row) => !edited.includes(row))
    const drop = visible[gone === -1 ? shown.length - 1 : gone]
    return full.filter((_, index) => index !== drop)
  }
  const position = new Map(visible.map((index, p) => [index, p]))
  const next = full.map((row, index) => {
    const p = position.get(index)
    return p === undefined ? row : edited[p]
  })
  return [...next, ...edited.slice(visible.length)]
}

/**
 * A claim reduced to what makes two phrasings the same claim: case, spacing
 * and punctuation do not count.
 */
export const normaliseClaimKey = (claim: unknown): string =>
  text(claim)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
