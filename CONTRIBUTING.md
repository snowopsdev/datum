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

## Commit messages and PR titles

We use [Conventional Commits](https://www.conventionalcommits.org/) — `type(scope): subject`, e.g. `feat(cms): add article export`, `fix(pipeline): handle empty SERP results`. Common scopes: `cms`, `pipeline`, `docs`, `deps`, `ci`.

PRs are **squash-merged**, so your PR title becomes the commit message on `main` — CI checks that it's a valid conventional commit. [release-please](https://github.com/googleapis/release-please) reads those commits to compute version bumps and changelog entries (`fix` → patch, `feat` → minor, `feat!` → major — mark breaking changes with `!` in the PR title; `BREAKING CHANGE:` footers don't survive title-only squash merging); see [RELEASING.md](RELEASING.md). Don't edit `CHANGELOG.md`, the root `package.json` version, or `.release-please-manifest.json` by hand, and don't create tags or GitHub releases manually.

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
