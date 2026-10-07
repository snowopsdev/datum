import type { Payload } from 'payload'
import type { SetupSuggestion } from '../../payload-types'
import type { SetupSuggestionDTO } from '../../components/ops/suggestionTypes'
export function suggestionDTO(row: SetupSuggestion): SetupSuggestionDTO {
  return {
    id: row.id,
    kind: row.kind ?? 'banned_word',
    count: row.count ?? 0,
    proposal:
      row.proposal && typeof row.proposal === 'object' && !Array.isArray(row.proposal)
        ? (row.proposal as Record<string, unknown>)
        : {},
    occurrences: Array.isArray(row.occurrences)
      ? row.occurrences.flatMap((raw) => {
          if (
            !raw ||
            typeof raw !== 'object' ||
            !('articleId' in raw) ||
            typeof raw.articleId !== 'number' ||
            !('excerpt' in raw) ||
            typeof raw.excerpt !== 'string' ||
            !('at' in raw) ||
            typeof raw.at !== 'string'
          )
            return []
          return [{ articleId: raw.articleId, excerpt: raw.excerpt, at: raw.at }]
        })
      : [],
  }
}
export async function loadSuggestionForEditor(
  payload: Payload,
  raw: string | string[] | undefined,
  target: 'brand-voice' | 'evidence-bank',
) {
  const id = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(id) || id <= 0) return null
  try {
    const row = await payload.findByID({
      collection: 'setup-suggestions',
      id,
      overrideAccess: true,
    })
    return row.status === 'open' && row.target === target ? suggestionDTO(row) : null
  } catch {
    return null
  }
}
