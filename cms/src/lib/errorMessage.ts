/**
 * The message an unknown thrown value carries, or `fallback` when it carries
 * none.
 *
 * Lives in `lib/` rather than beside one of its callers because both a server
 * action and the run actions it delegates to need it, and a `components → components`
 * import between two `'use server'` modules just to share four lines is worse
 * than a shared function. Deliberately duck-typed rather than
 * `instanceof Error`: Payload's `APIError`, a `pg` driver error and an error
 * that crossed a module realm all carry a usable `message` without passing
 * that check, and those are exactly the failures worth showing an operator
 * instead of a house-brand sentence.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return fallback
}
