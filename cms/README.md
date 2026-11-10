# cms

Payload CMS workspace for [Datum](../README.md) — Next.js admin UI, Postgres, the collections and globals in `src/collections/` and `src/globals/`, and the job queue.

For install, env setup, seeding, and day-to-day commands, use the [root README](../README.md). Contributor workflow and tests are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Useful scripts (from `cms/` or `npm run … --workspace cms`)

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js + Payload at http://localhost:3000 |
| `npm run seed` | Upsert content templates, evidence-source rules, and the local admin user |
| `npm run generate:types` | Regenerate `src/payload-types.ts` after collection changes |
| `npm run lint` / `typecheck` | ESLint and TypeScript |
| `npm run test:int` | Vitest integration tests |
| `npm run test:e2e` | Playwright e2e. Starts its own dev server; set `TEST_BASE_URL` to drive one that is already running |
| `npm run jobs:run` | Process one queued `content` pipeline job (use from a production worker/scheduler) |
