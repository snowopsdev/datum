# E2E-007 validation

Base:56c073175f12f38b6c861b382a8f197df71b416c. Lane11 worktree; isolated migration-built PostgreSQL database `qa_20260905_lane11`; mock mode. No paid providers or production targets.

Root cause: `loadReportCosts` reads all cost logs through Payload in1000-row batches. Each report request pays per-document hydration overhead. One grouped PostgreSQL query now reads numeric fields in a single snapshot and returns stage/model aggregate rows only. Typed period-start and run-ID filters are parameterized. The existing collection read access callback is evaluated; a future row-scoped access constraint fails closed. No persistent schema changes.

Fail-before focused regression session63048:3 passed,1 failed. The >5000-row assertion expected zero cost-log Payload finds, received7. Totals remained correct; the test detects per-row hydration without machine-dependent timing.

Pass-after focused regression session99715:5/5 tests. Covers5026-row complete totals without hydration, null numeric fields, missing stage/model buckets, `(unknown)` model collision, inclusive date lower bounds, quoted run-ID equality and empty results.

CMS typecheck95358 and scoped ESLint76367 passed. `git diff --check` passed.

Full CMS integration session52088:41 files passed,402 tests passed,36.02seconds. Full Chromium repository suite57337:16/16 passed,22.2seconds. The original reports period-change assertion passed on the populated database. The preserved before/after Chromium samples are in `e2e-007-benchmark.json`. The one-off executable harness was not retained; the reproducible correctness regression is preserved at https://github.com/snowopsdev/datum/blob/f187aab3aa24715aa540cd008c8c16688f543513/cms/tests/int/adminPerformance.int.spec.ts.

Residual risks: report aggregation intentionally uses the configured Postgres adapter. A future row-scoped cost-log access policy will need aggregate-aware filtering; it currently fails closed. Local timings use Chromium and Next development mode with three samples each, not a production SLA. Other reports queries still read article and pipeline-run summaries and may have independent scaling limits at larger volumes. Incidental npm lockfile normalization is excluded and remains uncommitted.
