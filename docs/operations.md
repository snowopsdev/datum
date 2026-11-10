# Operations

The documented operational contracts of a running Datum instance: queues, limits, event delivery, caching, and scheduling. If a number or behavior here drifts from the code, the code wins — file the drift as a bug against this page.

## Job queues

All background work runs on Payload's jobs queue. In development every queue auto-runs (`payload.config.ts` `jobs.autoRun`); in production nothing runs in-process — an external scheduler must invoke each queue:

| Queue | Invocation | Cadence | What runs |
|---|---|---|---|
| `content` | `npm run jobs:run --workspace cms` (`payload jobs:run --queue content --limit 1`) | your call (each invocation processes one job) | `content-run`: a full pipeline run |
| `webhooks` | `npm run jobs:webhooks --workspace cms` (`payload jobs:run --queue webhooks`) | every minute or faster | `webhook-deliver`: signed status-event POSTs |
| `scheduled` | `npm run jobs:scheduled --workspace cms` (`payload jobs:run --queue scheduled --handle-schedules --limit 1`) | every minute or faster | `publish-due`: publishes due `approved` articles (cron-scheduled every 5 minutes). `collect-setup-suggestions`: the daily 03:00 scan behind the setup suggestions (see [setup-suggestions.md](setup-suggestions.md)). `--handle-schedules` is what enqueues the next occurrence of each |

Invoke the npm scripts, or set `NODE_ENV=production` yourself if you call `payload jobs:run` directly. The Payload CLI does not set it, and without it the Postgres adapter runs its development schema push against the database on every invocation, outside migrations. The three scripts set `DISABLE_DEV_PUSH=true` so they are safe either way.

### Content runs

- **One active run at a time.** `createPipelineRun` takes a `read committed` transaction plus a Postgres advisory lock (`pg_advisory_xact_lock(424242, 434343)`); a second concurrent launch gets `ActivePipelineRunError`. Runs from the `selected` source are exempt from the one-active-run rule.
- `content-run` has `retries: 0` and concurrency key `content-pipeline`: a failed run stays failed (its articles keep their statuses and the next run retries them), and two runs never execute concurrently.
- One article's failure never fails its batch; it keeps its status and is retried by the next run. A run that advanced nothing and had failures is recorded `failed` with a redacted `errorSummary` on its `pipeline-runs` row.

### Scheduled publishing

- An `approved` article with a `publishAt` in the past is published by the next `publish-due` occurrence: same update path as a manual publish, so gates, the audit row (`scheduled_publish`, actor `scheduler`), the status webhook, and the cache purge all fire.
- Selection is by state (`approved` + due + not archived); reruns converge and never double-publish. Publishing, by the job or by hand, clears `publishAt` and stamps `publishedAt` in a collection hook, so a piece approved a second time waits for a new schedule.
- Worst-case publish latency is one cron interval (5 minutes) plus your scheduler cadence.

## Webhooks

Configured in the admin **Webhooks** global, each field falling back to `WEBHOOK_URL` / `WEBHOOK_SECRET`; nothing sends until both a URL and a secret resolve, and the global's `enabled` checkbox is a kill switch that also silences already-queued deliveries.

- **Event**: every article status transition (creates included, as `from: null`) queues one `article.status_changed` delivery. Body: `event`, `articleId`, `slug`, `previousSlug`, `from`, `to`, `actor`, `actorType`, `pipelineRunId` (when a run caused it), `occurredAt`.
- **Delivery contract**: POST, `content-type: application/json`, 3-second timeout, 5 attempts total (4 retries). Headers:
  - `x-datum-event` — the event name
  - `x-datum-timestamp` — milliseconds since epoch, signed
  - `x-datum-signature` — `sha256=` + hex HMAC-SHA256 of `` `${timestamp}.${rawBody}` `` with the shared secret
- **Verification** (receiver side): recompute the HMAC over the exact raw body, compare constant-time, and reject timestamps older than a few minutes. `verifyWebhookSignature` in `cms/src/jobs/webhookDeliver.ts` is the reference implementation.
- Queueing the event is part of the save: if the queue write fails, the failure is logged and the status transition is aborted, so no article commits a status without its event. Delivery is separate and retried by the `webhooks` queue; a failed delivery never affects the article.

## Cache and revalidation

- The public article route (`/articles/[slug]`, id fallback `/articles/[id]`) is ISR with `revalidate = 300`. Invalidation is per path — per article — so draft churn never purges reader-facing cache.
- Publishing from the admin purges immediately. Worker-side publishes purge through `POST /hooks/revalidate`: point the webhook URL at `<SITE_URL>/hooks/revalidate` and it verifies the signature, then purges on transitions into or out of `published` (anything else is acknowledged and ignored). Responses: `200 {revalidated}` on a verified delivery, `401` for missing/bad signature or a timestamp older than 5 minutes, `400` for an unparseable body.
- Editing an already-published article without a status change is served stale for at most 300 seconds.

## Modes and money

- Mock mode is the default whenever no LLM provider key is present (`MOCK_MODE` can force it); mock runs make no outbound LLM or Ahrefs calls but still write cost-log rows, so reports work locally.
- Every pipeline LLM call goes through `completeJSONLogged()` and writes an append-only `cost-log` row (provider, model, tokens, USD). Ahrefs live mode requires `AHREFS_API_KEY`; without it, topic discovery and research fail with a message naming the key (the admin's readiness check lists it as missing before a run can start). Live runs never fall back to the demo SERP.

## Fixed limits worth knowing

| Limit | Value | Where |
|---|---|---|
| Content-run retries | 0 | `cms/src/jobs/contentRun.ts` |
| Webhook timeout / attempts | 3 s / 5 | `cms/src/jobs/webhookDeliver.ts` |
| Revalidate signature window | 5 min | `cms/src/app/hooks/revalidate/route.ts` |
| Publish-due cron | every 5 min | `cms/src/jobs/publishDue.ts` |
| Public page ISR window | 300 s | `cms/src/app/(frontend)/articles/[slug]/page.tsx` |
| Content page | 50 articles; search and tab counts cover all non-archived articles | `cms/src/components/ops/contentListData.ts` |
| Reports queries | All articles and period runs; cost logs aggregated in Postgres by stage and model, one query | `cms/src/lib/reportQueries.ts` |
| Article audit timeline | Latest 100 article events and 100 model calls; evidence fetched when opened | `cms/src/components/ops/ArticleReviewView.tsx` |
| Run status polling | 3 seconds active, 15 seconds idle, measured after each response; paused in hidden tabs | `cms/src/components/ops/runPolling.ts` |
| Rendered scorecard claims | 60 | `cms/src/components/ops/articleStatus.ts` |
| Read-only statuses | `drafted`, `qa_passed` | `cms/src/lib/articleStatusMeta.ts` |
