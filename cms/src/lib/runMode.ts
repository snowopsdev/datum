/**
 * The one mock/live rule. Dependency-free on purpose: the pipeline config, the
 * CMS-side model calls and the readiness check all import it, and none of them
 * may throw at import because of a bad environment.
 *
 * - `MOCK_MODE` true/1/yes -> mock; false/0/no -> live.
 * - Unset or blank -> live only when a provider key is present, else mock. Only
 *   a key lifts mock: nothing else a dev machine carries may start paid runs.
 * - Anything else -> mock (the safe side), and `runModeProblem` says why.
 *
 * `MOCK_MODE=false` with no key is live: the per-stage key check in
 * `pipeline/src/models.ts` refuses the run and readiness lists the missing keys.
 */
export type RunMode = 'mock' | 'live'

type Env = Record<string, string | undefined>

const TRUE_VALUES = ['true', '1', 'yes']
const FALSE_VALUES = ['false', '0', 'no']

function set(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

/** The raw `MOCK_MODE` when it is set but is not one of the accepted spellings. */
function unrecognisedValue(env: Env): string | undefined {
  const raw = env.MOCK_MODE?.trim()
  if (!raw) return undefined
  const value = raw.toLowerCase()
  return TRUE_VALUES.includes(value) || FALSE_VALUES.includes(value) ? undefined : raw
}

export function runModeFromEnv(env: Env): RunMode {
  const value = env.MOCK_MODE?.trim().toLowerCase()
  // Explicit and unrecognised values both resolve here: only a false spelling is live.
  if (value) return FALSE_VALUES.includes(value) ? 'live' : 'mock'
  return set(env.ANTHROPIC_API_KEY) || set(env.OPENAI_API_KEY) ? 'live' : 'mock'
}

/** An operator-facing sentence when `MOCK_MODE` is set to something unusable, else undefined. */
export function runModeProblem(env: Env): string | undefined {
  const raw = unrecognisedValue(env)
  return raw === undefined
    ? undefined
    : `MOCK_MODE has an unrecognised value: "${raw}". Running in mock mode; set it to true or false`
}
