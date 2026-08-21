# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Datum is an SEO content pipeline built on Payload CMS. It has two npm workspaces:

- **`cms/`** — Payload CMS 3 app (Next.js 16 + Postgres) that stores `templates` and `articles` and serves the admin panel.
- **`pipeline/`** — a standalone Node/TypeScript CLI that drives articles through the content pipeline (research → generate → QA) by calling Payload's local API directly against `cms/src/payload.config.ts`. It is not an HTTP client of the CMS; it imports Payload in-process (see `pipeline/src/payloadClient.ts`), so `cms` and `pipeline` share one Postgres database and one set of generated types (`cms/src/payload-types.ts`).

Root `package.json` scripts just delegate into the workspaces (`npm run dev`, `npm run seed`, `npm run pipeline:fetch|run|report`).

## Commands

Install once from the repo root: `npm install` (npm workspaces; installs both `cms` and `pipeline`).

Database: `docker-compose up -d` starts Postgres (`datum`/`datum`/`datum` on 5432). Copy `.env.example` to `.env` at the repo root (and `cms/.env.example` to `cms/.env`) before running anything — `pipeline/src/config.ts` loads `cms/.env` first, then root `.env`, and real environment variables always win over both files.

**CMS** (`cms/`, or `npm run <script> --workspace cms` from root):
- `npm run dev` — Next dev server at `http://localhost:3000`
- `npm run seed` — upserts the three content templates (Listicle, How-To, Comparison) and a dev admin user (`admin@datum.local`, password from `SEED_ADMIN_PASSWORD` or `datum-dev-password`)
- `npm run generate:types` — regenerate `src/payload-types.ts` after changing a collection; both `cms` and `pipeline` import types from this file, so run it after any collection schema change
- `npm run lint` / `npm run typecheck`
- `npm run test:int` — Vitest integration tests (`tests/int/**/*.int.spec.ts`)
- `npm run test:e2e` — Playwright e2e tests (`tests/e2e/`); starts the dev server itself
- `npm test` — runs both test suites in sequence

**Pipeline** (`pipeline/`, or `npm run pipeline:<cmd>` from root):
- `npm run fetch -- --count N` (or `npm run pipeline:fetch -- --count N`) — pull content-gap keywords from Ahrefs and create up to N new `topic_selected` articles
- `npm run run` (`pipeline:run`) — advance every article that has a `template` assigned through research → generate → QA, one stage at a time across all eligible articles
- `npm run report -- --period week|month` (`pipeline:report`) — print QA pass rates, spend, and a failure digest
- `npx tsx scripts/assign-template.ts <articleId> <templateName>` — stands in for the human step of tagging a `topic_selected` article with a template (there is no admin UI action for this yet)
- `npm run typecheck`
- `npm test` — Node's built-in test runner (`tsx --test test/*.test.ts`); to run a single file: `tsx --test test/structuralChecks.test.ts`

Both workspaces resolve `cms/src/payload.config.ts` at runtime, so pipeline commands need the same env vars as the CMS (`DATABASE_URL`, `PAYLOAD_SECRET`) in addition to pipeline-specific ones.

## Environment / mock mode

`MOCK_MODE` (see root `.env.example`) governs whether the pipeline hits real paid APIs:
- `MOCK_MODE=true` (or unset with no `ANTHROPIC_API_KEY`) — `pipeline/src/llm.ts` returns canned fixtures from `pipeline/src/fixtures.ts` instead of calling Claude, and `pipeline/src/ahrefs.ts` uses `MockAhrefsClient` instead of the real Ahrefs API. This is the default for local dev and lets `pipeline:fetch`/`pipeline:run` work with zero API keys.
- `MOCK_MODE=false` requires `ANTHROPIC_API_KEY`; `AHREFS_API_KEY` additionally requires `TARGET_DOMAIN` and `COMPETITOR_DOMAINS` to be set (see `pipeline/src/config.ts` for the exact validation).

Model IDs for each LLM stage are individually overridable via `PIPELINE_MODEL_GENERATE`, `PIPELINE_MODEL_FACT_CHECK`, `PIPELINE_MODEL_QUALITATIVE_REVIEW` (default: `claude-opus-5`). If you add a new model ID, also add its per-token price to `PRICES` in `pipeline/src/pricing.ts` — an unrecorded model logs cost as $0 with a console warning, which silently breaks the spend reporting.

## Pipeline architecture

An article moves through a fixed status state machine, driven entirely by `status` — not by any queue or scheduler:

```
topic_selected → researched → drafted → qa_passed → approved → published
                                   ↓
                            needs_revision
```

`pipeline/src/stages.ts` defines `stages: Stage[] = [researchStage, generateStage, qaStage]`. `runPipeline()` walks that array in order; for each stage it queries Payload for every article whose `status` equals the stage's `entryStatus` and has a `template` assigned, runs the stage, and writes back `status` + the stage's output data. This makes reruns idempotent/convergent: an article only advances once per run through each stage it's currently eligible for, and a fresh `pipeline:run` naturally picks up wherever articles are stuck.

- **research** (`pipeline/src/research.ts`) — Ahrefs SERP research for the article's keyword, no LLM call.
- **generate** (`pipeline/src/generate.ts`) — one LLM call that returns a JSON object (title, slug, SEO fields, FAQ items, markdown body) built from the assigned `template`'s outline/dos/donts/SEO spec plus the research data; markdown is converted to Payload's Lexical rich text via `pipeline/src/richtext.ts`.
- **qa** (`pipeline/src/qa/index.ts`) — three independent checks that must all pass to reach `qa_passed`, else the article goes to `needs_revision`:
  1. `runStructuralChecks` (`pipeline/src/qa/structuralChecks.ts`) — pure, deterministic, zero-LLM: title/meta length limits from the template's `seoSpec`, heading structure (exactly one H1 via the title, no skipped levels, required H2 sections present), FAQ count range, OG tag presence, Flesch-Kincaid reading grade ≤ 11, and banned-phrase scanning against `docs/style-guide.md`.
  2. `factCheck` — LLM call with the web-search tool enabled (`needWebSearch: true` in `llm.ts`).
  3. `qualitativeReview` — LLM call judging style-guide and template dos/don'ts adherence.

`fetchTopics()` (`pipeline/src/fetchTopics.ts`) is the entry point that creates new `topic_selected` articles: it pulls Ahrefs content-gap keywords (competitor terms the target domain doesn't rank for), scores them by `volume / difficulty`, and creates the top N — skipping keywords that already have an article.

Template assignment (`topic_selected` → having a `template`) is a manual step (`scripts/assign-template.ts`); nothing in the pipeline auto-assigns templates.

## Cost tracking

Every LLM call must go through `completeJSONLogged()` in `pipeline/src/llm.ts` — it wraps `completeJSON()` and unconditionally writes one `cost-log` row (tokens, provider, model, computed `costUsd`) per call, keyed by `pipelineRunId` and `article`. Stages should never call `completeJSON()` directly for anything that should be cost-tracked. `qaStage` sums that article's `cost-log` rows into `totalCostUsd` after its own LLM calls, so it always includes the current run's `factCheck`/`qualitativeReview` cost. `pipeline/src/report.ts` reads `cost-log` for spend-by-stage/spend-by-model and a "cost per published article" / "waste on unpublished articles" breakdown.

## Rich text conversion

Payload stores article/template body content as Lexical JSON. `pipeline/src/richtext.ts` and `cms/src/seed.ts` both hand-build/walk that JSON shape directly (no Lexical runtime dependency) — `lexicalToMarkdown`/`markdownToLexical`/`lexicalToPlainText`/`extractHeadings` convert between it and plain markdown/text for LLM prompts and structural QA. When adding new node types to article bodies, both `richtext.ts` (pipeline) and any seed helpers (cms) need matching node builders.

## Style guide as data

`docs/style-guide.md` is not just documentation — `pipeline/src/styleGuide.ts` parses its `## Banned phrases` section into a `bannedPhrases: string[]` array at runtime, which both the `generate` LLM prompt (as instructions) and `runStructuralChecks`'s `BANNED_PHRASE` check (as a regex scan) consume. Keep new banned phrases under that exact heading, one per bullet, in the format `phrase (optional parenthetical note)` — the parenthetical is stripped before matching.

## CMS collections (`cms/src/collections/`)

- **`Templates`** — content templates (`Listicle`, `How-To`, `Comparison` are seeded); holds the outline (rich text), dos/don'ts arrays, `requiredSections` (H2s enforced by structural QA — the outline itself is prose guidance, not enforced directly), and `seoSpec`.
- **`Articles`** — one row per article; `status` drives the pipeline; `research`, `qaResults`, `qaModels`, `generationModel`, `totalCostUsd` are all pipeline-written fields, not admin-editable content.
- **`CostLog`** — append-only, one row per LLM call (see Cost tracking above).
- **`Users`** / **`Media`** — stock Payload auth/upload collections, unmodified from the Payload blank template.

After changing any collection's fields, run `npm run generate:types --workspace cms` — `pipeline` imports `Article`/`Template`/`CostLog` types straight from `cms/src/payload-types.ts` via relative path (`../../cms/src/payload-types`), so stale types there will silently drift from the actual schema.

## Conventions

- CMS code: 2-space, single quotes, no semicolons, `printWidth: 100`, trailing commas (`cms/.prettierrc.json`) — run through the CMS ESLint config (`cms/eslint.config.mjs`), not a separate pipeline linter (pipeline has no lint script, only `typecheck`).
- `cms/CLAUDE.md` is `@AGENTS.md`, which is regenerated by `next dev` (Next.js 16's agent-guidance file) — don't hand-edit `cms/AGENTS.md`'s content expecting it to persist; treat it as informational, not as project-specific conventions.
- The CMS package.json's `test` script and `playwright.config.ts`'s `webServer.command` reference `pnpm`, a holdover from the Payload blank template; the rest of this repo (root scripts, CI-equivalent workflows) uses npm workspaces — use `npm run test:int` / `npm run test:e2e` directly inside `cms/` rather than `pnpm test` unless pnpm is actually installed.
- `cms/README.md` is the unedited Payload blank-template README (mentions MongoDB/S3 cloud hosting) — it does not reflect this project's actual Postgres/docker-compose setup; prefer this file and `docker-compose.yml`/`.env.example` for setup instructions.
