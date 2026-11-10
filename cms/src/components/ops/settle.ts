import { errorMessage } from '../../lib/errorMessage'

/**
 * Run an editor's server-action call from a transition, showing a failure
 * where the editor shows its other errors.
 *
 * A server action that cannot be reached (offline, a 5xx, an action id gone
 * stale after a deploy) rejects instead of returning `{ ok: false }`; inside a
 * transition that rejection goes to the error boundary and blanks the page.
 */
export async function settle(
  run: () => Promise<void>,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await run()
  } catch (e) {
    onError(errorMessage(e, 'Something went wrong. Check your connection and try again.'))
  }
}
