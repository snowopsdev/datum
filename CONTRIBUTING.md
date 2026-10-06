# Contributing to Datum

Thanks for contributing. This guide covers local setup, checks, and how we review changes.

## Development setup

1. Prerequisites: Node.js 22+, Docker, npm.
2. Follow the [Quick start](README.md#quick-start) in the root README (`cp` env files, `docker compose up -d`, `npm install`, `npm run seed`).
3. Use `MOCK_MODE=true` unless you intentionally need live Anthropic/Ahrefs calls.

## Shared code graph

Datum uses [Graphify's team setup](https://github.com/Graphify-Labs/graphify#team-setup).
The Codex skill and query-first instructions are checked into `.codex/` and
`AGENTS.md`. Install the CLI and Git hooks once per clone from the repo root
(Python 3.10+ and [uv](https://docs.astral.sh/uv/) are required):

```bash
uv tool install graphifyy==0.9.77
graphify hook install
graphify hook status
```

The hooks rebuild the code graph in the background after commits and branch
switches, and register a merge driver for `graph.json`. Re-run `graphify hook
install` after upgrading or reinstalling the CLI to refresh its interpreter
path. If `graphify` is not found, run `uv tool update-shell` and open a new terminal.

The checked-in `.codex/skills/graphify/SKILL.md` bootstrap only detects an
existing installation; it never installs or upgrades packages automatically.
`graphify install` regenerates the skill and can overwrite these local changes.
After reinstalling the skill, re-apply the detection-only bootstrap and the
`graphifyy==0.9.77` pins (including optional extras in the references), then
review the generated diff before committing it. Do not restore `uv tool run
--from graphifyy`, automatic install/upgrade commands, or
`--break-system-packages` fallbacks.

Teammates can query the shared graph immediately after cloning:

```bash
graphify query "articleReviewGate brief approval"
graphify explain "completeJSONLogged"
graphify update . # after code changes, git pull, or a merge; local AST only
```

The graph covers code relationships without paid API calls. Documentation and
media need a separate semantic pass through `$graphify --update` in Codex;
`graphify update .` does not perform that pass. `.graphifyignore` excludes
vendored plugins, agent state, dependency lockfiles, and generated migration
JSON snapshots; migration TypeScript remains indexed. The AST parser may omit
unsupported files or files without symbols, so use source files to verify details.
Initial validation found no missing or dangling edge endpoints. It flagged three
self-links: `sameValue` and `upsertDomain` recurse, while the `create` test helper's
call to `payload.create` was misidentified as recursion. Treat graph edges as
navigation hints and confirm ambiguous calls in source.

Share only the queryable graph, report, and portable manifest. The rest of
`graphify-out/` stays ignored, including caches, local HTML, and machine paths:

```bash
git add -f graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
```

The hooks finish asynchronously, so run `graphify update .` before staging these
files when the latest code changes must be included. A new clone must install
its own hooks; `.git/hooks/` and the merge-driver Git configuration are local.

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

Use **npm** for scripts and CI. `npm test --workspace cms` runs both CMS suites; Playwright starts an npm dev server unless `TEST_BASE_URL` points to an existing one.

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

PRs are **squash-merged**, so your PR title becomes the commit message on `main` — CI checks that it's a valid conventional commit. [release-please](https://github.com/googleapis/release-please) reads those commits to compute version bumps and changelog entries (`fix` → patch, `feat` → minor, `feat!` → major — mark breaking changes with `!` in the PR title; `BREAKING CHANGE:` footers don't survive title-only squash merging). While the version is still 0.x, breaking changes bump the minor instead of cutting `1.0.0` — still mark them with `!`; see [RELEASING.md](RELEASING.md). Don't edit `CHANGELOG.md`, the root `package.json` version, or `.release-please-manifest.json` by hand, and don't create tags or GitHub releases manually.

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
