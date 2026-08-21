# Datum

SEO content pipeline built on [Payload CMS](https://payloadcms.com/). Datum helps you discover content-gap keywords, generate articles from templates, and run structural + LLM QA before publish.

## Workspaces

| Path | Role |
| --- | --- |
| [`cms/`](cms/) | Payload CMS 3 app (Next.js 16 + Postgres) — templates, articles, admin UI |
| [`pipeline/`](pipeline/) | Node/TypeScript CLI that advances articles through research → generate → QA |
| [`docs/`](docs/) | Style guide and other content rules consumed by the pipeline |

`cms` and `pipeline` share one Postgres database and generated types (`cms/src/payload-types.ts`). The pipeline imports Payload in-process (not over HTTP).

## Article status flow

```
topic_selected → researched → drafted → qa_passed → approved → published
                                   ↓
                            needs_revision
```

Template assignment on `topic_selected` articles is manual (`pipeline/scripts/assign-template.ts`). `needs_revision` is a dead end until status is reset to `drafted`.

## Prerequisites

- Node.js 22+
- npm (workspaces; do not require pnpm for day-to-day use)
- Docker (Postgres via `docker-compose`)

## Quick start

```bash
# 1. Env files
cp .env.example .env
cp cms/.env.example cms/.env
# Generate a Payload secret:
#   openssl rand -hex 32
# and set PAYLOAD_SECRET in both .env files (or at least cms/.env).

# 2. Database
docker compose up -d

# 3. Install & seed
npm install
npm run seed

# 4. Admin UI
npm run dev
# → http://localhost:3000
```

**Local-dev admin only** (from seed; change before any shared/deployed use):

- Email: `admin@datum.local`
- Password: value of `SEED_ADMIN_PASSWORD`, or `datum-dev-password` if unset

### Pipeline in mock mode (no API keys)

With `MOCK_MODE=true` (default in `.env.example`), Ahrefs and Anthropic calls use fixtures:

```bash
npm run pipeline:fetch -- --count 3
# Assign a template in admin or:
#   npx tsx pipeline/scripts/assign-template.ts <articleId> Listicle
npm run pipeline:run
npm run pipeline:report -- --period week
```

Set `MOCK_MODE=false` and provide `ANTHROPIC_API_KEY` (and optionally `AHREFS_API_KEY`, `TARGET_DOMAIN`, `COMPETITOR_DOMAINS`) for live API calls. See [`.env.example`](.env.example).

## Environment variables

Copy [`.env.example`](.env.example) and [`cms/.env.example`](cms/.env.example). Pipeline loads `cms/.env` first, then root `.env`; real environment variables win over both.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `PAYLOAD_SECRET` | Payload token signing secret |
| `ANTHROPIC_API_KEY` | Claude for generate / QA (not required in mock mode) |
| `AHREFS_API_KEY` | Keyword / SERP research (not required in mock mode) |
| `TARGET_DOMAIN` | Domain articles are written for |
| `COMPETITOR_DOMAINS` | Comma-separated competitors for content-gap fetch |
| `MOCK_MODE` | `true` to use fixtures instead of paid APIs |
| `SEED_ADMIN_PASSWORD` | Password for the seeded admin user |

## Scripts (from repo root)

| Script | Description |
| --- | --- |
| `npm run dev` | CMS Next.js dev server |
| `npm run seed` | Upsert templates + admin user |
| `npm run pipeline:fetch` | Create articles from content-gap keywords |
| `npm run pipeline:run` | Run research → generate → QA for eligible articles |
| `npm run pipeline:report` | QA / spend digest |
| `npm run typecheck` / `lint` / `test` | Workspace checks (see [CONTRIBUTING.md](CONTRIBUTING.md)) |

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, tests, PR expectations
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CLAUDE.md](CLAUDE.md) — deep-dive architecture for humans and coding agents
- [docs/style-guide.md](docs/style-guide.md) — editorial rules (including banned phrases used by QA)
- [docs/open-source-checklist.md](docs/open-source-checklist.md) — maintainer steps to flip the repo public

Agent helpers under `.claude/` and `vendor/claude-plugins/` are optional and not required to run Datum.

## License

[MIT](LICENSE) © 2026 Aj Nieves
