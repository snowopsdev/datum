import { errorMessage } from '../../lib/errorMessage'

/**
 * How a reviewer-facing server action answers.
 *
 * Next replaces the message of an error thrown from a server action with a
 * generic one in a production build, so a refusal that is *expected* — a gate
 * saying why a write was refused, a missing justification, an article in an
 * active run — has to travel as a return value to reach the person who needs
 * to read it. `briefActions`, `boardActions` and `tenantActions` already do
 * this; this is the same shape for the actions that used to throw.
 */
export type ActionFailure = { ok: false; error: string }
export type ActionResult<T extends object = object> = ({ ok: true } & T) | ActionFailure

/**
 * Runs a server action's body and turns whatever it throws into `{ ok: false }`.
 *
 * The body keeps throwing for its refusals — that reads best where the check
 * sits — and this is the one place they become data. An unexpected failure (a
 * database outage) is caught too, so the reviewer sees its message rather than
 * a redacted one; `fallback` covers a thrown value that carries none.
 */
export async function attempt<T extends object>(
  fallback: string,
  body: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await body()) }
  } catch (error) {
    return { ok: false, error: errorMessage(error, fallback) }
  }
}

/**
 * The client half: the success value, or a thrown `Error` carrying the
 * server's message. The throw happens in the browser, so it is not redacted.
 */
export function unwrap<T extends { ok: true }>(result: T | ActionFailure): T {
  if (!result.ok) throw new Error(result.error)
  return result
}
