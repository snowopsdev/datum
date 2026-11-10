// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

import { assertTestDatabase } from './tests/helpers/testDatabaseGuard'

// Runs after `dotenv/config`, so it judges the `DATABASE_URL` the suite will
// really use, including one that only `cms/.env` supplies.
assertTestDatabase()

// The suite never calls a paid API. CI sets this in the workflow; locally the
// mode would otherwise be whatever `cms/.env` or the shell says, and a few
// specs reach real fetch and model paths when it is `false`. A spec that tests
// the live branch stubs the variable itself with `vi.stubEnv`.
process.env.MOCK_MODE = 'true'
