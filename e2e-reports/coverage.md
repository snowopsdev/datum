# QA campaign coverage

Base: `56c073175f12f38b6c861b382a8f197df71b416c`. Repository: `snowopsdev/datum`.
Source checkout was clean and remains excluded from campaign mutations.

| Lane | Owner | Required scenarios |
|---|---|---|
| 01 | browser_lanes | Build, migration-built boot, homepage, admin, public article, route inventory |
| 02 | browser_lanes | Login, logout, anonymous redirect, invalid login, setup/demo readiness, account controls |
| 03 | browser_lanes | Template selection, manual keyword, research, editable brief, explicit approval, writing |
| 04 | browser_lanes | Review gates, override, send back, approval, publication, governance, reports |
| 05 | api_lanes | REST and GraphQL contracts, malformed requests, revalidation webhook signature/body/freshness |
| 06 | pipeline_lanes | Migrations, audit immutability, queue execution, scheduling, corpus and score persistence |
| 07 | browser_lanes | Mobile overflow, keyboard navigation, accessible names, errors/empty states, public rendering |
| 08 | pipeline_lanes | Failures, timeout/retry, cancellation/restart, idempotency and batch isolation |
| 09 | api_lanes | Anonymous/authenticated access matrix, protected fields, input boundaries and privacy |
| 10 | pipeline_lanes | Mock/live configuration guards, provider selection, callbacks, process lifecycle |
| 11 | api_lanes | Local API ramp from concurrency 1, read/burst, error capture, and recovery |
| 12 | pipeline_lanes | Local workflow races, overlapping launches, replay, integrity and regression auditing |

This app has one workspace per deployment. Cross-tenant SaaS accounts, payments,
and third-party user messaging are absent and are reassigned to workspace access,
editorial review and webhook boundaries. Real provider stress is excluded because
no request/cost allowance is configured. Mock adapters cover provider contracts;
live provider behavior remains an explicit coverage gap.

## Finite budgets

- Each lane records a finite scenario list before exercising it.
- Each stress run: at most 300 seconds, 500 total operations including retries,
  concurrency at most 20, ramp from 1. Stop on sustained errors, integrity risk,
  throttling or unexpected cost.
- Startup: 180 seconds and one evidenced setup retry.
- Expansion: at most three campaign-wide passes. Each pass selects a finite list
  covering pairwise journeys, boundaries/recovery, and concurrency/historical risk.
  The skill sets no fixed scenario count per pass.
- Discovery exhaustion requires complete applicable critical boundaries and two
  consecutive complete passes without a new root cause. Gaps cannot be exhaustion.
- Actual execution: pass 1 covered six scenarios, pass 2 covered six, and pass 3
  covered three. The detailed matrix is in
  `qa-20260905-artifacts/expansion-matrix.md`. Because the target was not reached
  and documented gaps remain after the third allowed pass, the campaign records an
  expansion-budget stop rather than claiming exhaustion.
- CI: two attempts at the same failure before reassessment, ten-minute observation
  allowance per published head. External reviewers are not presumed approved.

## Resource inventory

Canonical state and generated report: `qa-20260905.state.json`, `qa-20260905.md`.
Full authoritative port plan: `ports-v1.json`. Ports are probes, not reservations.
Workers own their exact process handles and report them before testing.
Databases use `qa_20260905_laneNN`; no existing database is a campaign target.
Ignored environment files contain isolated database/mode/secret configuration.
The worktree hook copies local configuration; workers replace these run-owned
files before app execution and never print credential values.

The reporting worktree and all dirty/evidence-bearing lane worktrees are retained
until their artifacts and commits are durably referenced. Unknown processes and
pre-existing worktrees are never cleaned by this campaign.
