# Contributing to Datum

Thanks for contributing. This guide covers local setup, checks, and how we review changes.

## Development setup

1. Prerequisites: Node.js 22+, Docker, npm.
2. Follow the [Quick start](README.md#quick-start) in the root README (`cp` env files, `docker compose up -d`, `npm install`, `npm run seed`).
3. Use `MOCK_MODE=true` unless you intentionally need live Anthropic/Ahrefs calls.

## Commands

From the **repo root**:

```bash
npm run typecheck   # cms + pipeline
npm run lint        # cms ESLint
npm test            # pipeline unit tests + cms integration tests
```

Workspace-specific:

```bash
# CMS
npm run test:int --workspace cms
npm run test:e2e --workspace cms   # prefer starting `npm run dev` first
npm run generate:types --workspace cms

# Pipeline
npm run typecheck --workspace pipeline
npm test --workspace pipeline
# Single file:
npx tsx --test pipeline/test/structuralChecks.test.ts
```

Prefer **npm** for scripts and CI. The CMS package still has some Payload-template `pnpm` leftovers (e.g. the combined `test` script and Playwright’s optional `webServer`); use the `test:int` / `test:e2e` scripts or start the app with `npm run dev` instead.

## Schema / types

After changing Payload collections under `cms/src/collections/`:

```bash
npm run generate:types --workspace cms
```

Commit the updated `cms/src/payload-types.ts`. Both `cms` and `pipeline` import those types.

## Style guide data

Banned phrases live under `## Banned phrases` in [`docs/style-guide.md`](docs/style-guide.md). The pipeline parses that section at runtime for generate prompts and structural QA — keep the heading and bullet format documented in [CLAUDE.md](CLAUDE.md).

## Pull requests

Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`):

- What changed and why
- User / developer impact
- How you verified (commands + evidence)
- Risks or follow-ups

Keep diffs focused. Do not commit `.env`, secrets, or local media uploads.

## Architecture notes

See [CLAUDE.md](CLAUDE.md) for pipeline stages, cost logging, and rich-text conversion details.

## Code of conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
