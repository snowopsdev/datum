/**
 * What a save says it did, for the actions that quietly drop input: a row with
 * no text, a competitor that is not a domain. Pure, so the wording is tested
 * without a database; the actions return the counts and the editor words them.
 */

export const countOf = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

export type EvidenceSaveCounts = {
  claims: number
  facts: number
  rejected: number
  /** Rows with no text, left out of the saved bank. */
  skipped: number
}

export function evidenceSaveMessage(counts: EvidenceSaveCounts): string {
  const parts = [countOf(counts.claims, 'claim')]
  if (counts.facts > 0) parts.push(countOf(counts.facts, 'fact'))
  if (counts.rejected > 0) parts.push(`${counts.rejected} rejected or expired`)
  if (counts.skipped > 0) parts.push(`${countOf(counts.skipped, 'empty row')} skipped`)
  return `Saved · ${parts.join(', ')}`
}

export type WorkspaceSaveCounts = {
  competitors: number
  /** Rows whose domain was not a domain. */
  invalid: number
  /** Rows repeating a domain already listed. */
  duplicate: number
}

export function workspaceSaveMessage(counts: WorkspaceSaveCounts): string {
  const dropped: string[] = []
  if (counts.invalid > 0) dropped.push(`${counts.invalid} invalid removed`)
  if (counts.duplicate > 0) dropped.push(`${counts.duplicate} duplicate removed`)
  if (counts.competitors === 0 && dropped.length === 0) return 'Saved'
  const kept = counts.competitors > 0 ? [`${countOf(counts.competitors, 'competitor')} kept`] : []
  return `Saved · ${[...kept, ...dropped].join(', ')}`
}

const rowTotal = (value: unknown): number => {
  if (Array.isArray(value)) return value.reduce<number>((n, row) => n + 1 + rowTotal(row), 0)
  if (value && typeof value === 'object') {
    return Object.values(value).reduce<number>((n, field) => n + rowTotal(field), 0)
  }
  return 0
}

/** How many list rows (at any depth) a parser left out of what it was handed. */
export const droppedRows = (sent: unknown, kept: unknown): number =>
  Math.max(0, rowTotal(sent) - rowTotal(kept))

/** `done` when nothing was left out; else say what was. */
export function parsedSaveMessage(done: string, dropped: number): string {
  return dropped > 0 ? `Saved · ${countOf(dropped, 'incomplete row')} removed` : done
}
