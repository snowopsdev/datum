# Agent instructions

## Package manager

- Use npm workspaces with Node 22+: `npm install`, `npm run dev`, `npm test`.
- Do not run `npm test --workspace cms`; that script shells out to pnpm. Use `npm run test:int --workspace cms`.
- For CMS E2E, install pnpm for Playwright's server fallback, or start `npm run dev` separately and run `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:e2e --workspace cms`.

## Project map

- `cms/`: Payload CMS 3, Next.js 16, Postgres, admin UI, and content-run jobs.
- `pipeline/`: in-process TypeScript CLI for research, generation, QA, and information gain.
- Both workspaces use `cms/src/payload.config.ts`, one database, and `cms/src/payload-types.ts`.
- Start with `README.md`; use `docs/information-gain.md` for scoring and corpus behavior.

## Commands

```bash
npm run typecheck                    # both workspaces
npm run lint                         # CMS
npm test                             # pipeline unit + CMS integration
npm run generate:types --workspace cms
npm run jobs:run --workspace cms     # production content worker
```

## File-scoped commands

| Task | Command |
|---|---|
| CMS lint | `npm exec --workspace cms -- eslint src/path/to/file.ts` |
| CMS integration test | `npm run test:int --workspace cms -- tests/int/file.int.spec.ts` |
| Pipeline test | `npx tsx --test pipeline/test/file.test.ts` |
| Typecheck | No reliable file-only command; use the CMS or pipeline workspace typecheck script |

## Key conventions

- Article `status` is the pipeline state machine. Its metadata lives in one shared table, `cms/src/lib/articleStatusMeta.ts`; `pipeline/test/statusAlignment.test.ts` asserts `pipeline/src/stages.ts` agrees with it.
- Research stops at `brief_review`. Only approval moves an article to `researched` and queues writing.
- `needs_revision`, `needs_review`, and `blocked` require reviewer action; pipeline runs do not pick them up.
- Route every pipeline LLM call through `completeJSONLogged()` so cost rows are written.
- Keep `cms/src/lib/brandVoice.ts` dependency-free; both workspaces import it.
- Treat `docs/style-guide.md` as runtime data. Preserve its `## Banned phrases` heading and bullet format.
- After collection schema changes, regenerate and commit `cms/src/payload-types.ts` and add a migration.
- Next loads `cms/.env`; the pipeline loads `cms/.env` then root `.env`. Shell variables win.
- Use a per-worktree database for schema work. Decline dev-push prompts that would drop another branch's tables.
- Integration tests need a migration-built database because Payload dev push is disabled under Vitest.
- Preserve append-only audit and information-gain records and the review gates in `articleReviewGate.ts`.
- Mock mode is the local default. Do not trigger paid APIs unless the task explicitly requires live mode.

## Commit attribution

- Follow Conventional Commits and the release rules in `CONTRIBUTING.md` and `RELEASING.md`.
- Do not edit generated release versions, `CHANGELOG.md`, tags, or GitHub releases by hand.
- AI commits MUST include:

```text
Co-Authored-By: (the agent's name and attribution byline)
```
