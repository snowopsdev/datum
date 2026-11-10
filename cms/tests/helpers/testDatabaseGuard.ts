/**
 * The test suites rewrite workspace state (audiences, profile, brand voice,
 * webhook settings, run rows) and append cost and audit rows that are never
 * removed. Pointed at a developer's working database they destroy it, and
 * `cms/.env` is loaded by default, so that is where they would point. This
 * module is the one rule that stops it: the database name must say it is for
 * tests, or the person running the suite must say so explicitly.
 */

/** Set to `true` to run against a database whose name does not contain `test`. */
export const TEST_DATABASE_OPT_IN = 'DATUM_TEST_DATABASE_OK'

/** The database name in a Postgres connection string, or null if there is none. */
export function databaseNameFromUrl(connectionString: string): string | null {
  try {
    const name = decodeURIComponent(new URL(connectionString).pathname.replace(/^\/+/, ''))
    return name === '' ? null : name
  } catch {
    return null
  }
}

/**
 * Throws unless the suite may use `env.DATABASE_URL`. A missing one is refused
 * too: Payload would then connect with libpq's defaults (`PGDATABASE`, or a
 * database named after the OS user), which can be a working database.
 */
export function assertTestDatabase(env: Record<string, string | undefined> = process.env): void {
  if (env[TEST_DATABASE_OPT_IN] === 'true') return
  const url = env.DATABASE_URL
  const name = url ? databaseNameFromUrl(url) : null
  if (name !== null && name.toLowerCase().includes('test')) return
  throw new Error(
    `Refusing to run the tests against ${!url ? 'the default database (DATABASE_URL is not set)' : name === null ? 'a database whose name cannot be read from DATABASE_URL' : `the database "${name}"`}. ` +
      'The suites rewrite workspace state and add rows that are never removed. ' +
      'Either point DATABASE_URL at a database whose name contains "test" (for example datum_test), ' +
      `or set ${TEST_DATABASE_OPT_IN}=true to accept that this database will be modified.`,
  )
}
