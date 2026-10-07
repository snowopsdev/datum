import type { SuggestionKind, Occurrence } from '../../lib/setupSuggestions/types'
export interface SetupSuggestionDTO {
  id: number
  kind: SuggestionKind
  proposal: Record<string, unknown>
  count: number
  occurrences: Occurrence[]
}
export type SuggestionActionResult =
  { ok: true; editorHref?: string } | { ok: false; error: string }
