import { describe, expect, it } from 'vitest'

import {
  assertTestDatabase,
  databaseNameFromUrl,
  TEST_DATABASE_OPT_IN,
} from '../helpers/testDatabaseGuard'

const url = (name: string) => `postgresql://datum:datum@127.0.0.1:5432/${name}`

describe('databaseNameFromUrl', () => {
  it('reads the name, ignoring credentials and query', () => {
    expect(databaseNameFromUrl(url('datum_test'))).toBe('datum_test')
    expect(databaseNameFromUrl('postgres://u@h:5433/db?sslmode=require')).toBe('db')
  })

  it('returns null when there is no name or the URL is unreadable', () => {
    expect(databaseNameFromUrl('postgresql://u@h:5432')).toBeNull()
    expect(databaseNameFromUrl('postgresql://u@h:5432/')).toBeNull()
    expect(databaseNameFromUrl('not a url')).toBeNull()
  })
})

describe('assertTestDatabase', () => {
  it('allows a database whose name contains "test", in any case', () => {
    expect(() => assertTestDatabase({ DATABASE_URL: url('datum_test') })).not.toThrow()
    expect(() => assertTestDatabase({ DATABASE_URL: url('datum_test_ws_g') })).not.toThrow()
    expect(() => assertTestDatabase({ DATABASE_URL: url('Datum_TEST') })).not.toThrow()
  })

  it('refuses a working database and names both ways out', () => {
    expect(() => assertTestDatabase({ DATABASE_URL: url('datum') })).toThrow(/"datum"/)
    expect(() => assertTestDatabase({ DATABASE_URL: url('datum') })).toThrow(/contains "test"/)
    expect(() => assertTestDatabase({ DATABASE_URL: url('datum') })).toThrow(
      new RegExp(`${TEST_DATABASE_OPT_IN}=true`),
    )
  })

  it('refuses a URL whose database name cannot be read', () => {
    expect(() => assertTestDatabase({ DATABASE_URL: 'postgresql://u@h:5432' })).toThrow(/cannot be read/)
    expect(() => assertTestDatabase({ DATABASE_URL: 'garbage' })).toThrow(/cannot be read/)
  })

  it('does not match "test" in the host or user, only the database name', () => {
    expect(() =>
      assertTestDatabase({ DATABASE_URL: 'postgresql://testuser@testhost:5432/datum' }),
    ).toThrow()
  })

  it('accepts any database with the explicit opt-in, and only the exact value "true"', () => {
    expect(() =>
      assertTestDatabase({ DATABASE_URL: url('datum'), [TEST_DATABASE_OPT_IN]: 'true' }),
    ).not.toThrow()
    expect(() =>
      assertTestDatabase({ DATABASE_URL: url('datum'), [TEST_DATABASE_OPT_IN]: '1' }),
    ).toThrow()
  })

  // Without one, Payload connects with libpq's defaults (PGDATABASE, or the OS
  // user's name), which can be a working database.
  it('refuses a missing DATABASE_URL unless opted in', () => {
    expect(() => assertTestDatabase({})).toThrow(/DATABASE_URL is not set/)
    expect(() => assertTestDatabase({ DATABASE_URL: '' })).toThrow(/DATABASE_URL is not set/)
    expect(() => assertTestDatabase({ [TEST_DATABASE_OPT_IN]: 'true' })).not.toThrow()
  })
})
