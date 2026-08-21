# cms

Payload CMS workspace for [Datum](../README.md) — Next.js admin UI, Postgres, and collections for templates, articles, media, users, and cost logs.

For install, env setup, seeding, and day-to-day commands, use the [root README](../README.md). Contributor workflow and tests are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Useful scripts (from `cms/` or `npm run … --workspace cms`)

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js + Payload at http://localhost:3000 |
| `npm run seed` | Upsert content templates and local admin user |
| `npm run generate:types` | Regenerate `src/payload-types.ts` after collection changes |
| `npm run lint` / `typecheck` | ESLint and TypeScript |
| `npm run test:int` | Vitest integration tests |
| `npm run test:e2e` | Playwright e2e (start `npm run dev` first, or ensure Playwright’s webServer can start) |
