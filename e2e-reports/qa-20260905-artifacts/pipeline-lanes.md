# QA campaign qa-20260905 — pipeline lanes 06, 08, 10, 12

Immutable base: `56c073175f12f38b6c861b382a8f197df71b416c`. All worktrees under `<qa-worktree>/laneNN`; all use Node 22.22.3 and separate local migration-built Postgres databases `qa_20260905_laneNN`. No app listeners or paid providers were used. Each ignored env file has a fresh run-owned Payload secret, isolated database, mock default, and blank outbound webhook settings. Fake keys were used only to check the read-only reporting command.

## Lane 06: persistence baseline

Completed: fresh 14-migration schema; full pipeline baseline 801/801; six CMS files covering migration, atomic launches, append-only article audit, corpus snapshots, information-gain history, and scheduled publishing 37/37. No unique defect attributed to this lane. Baseline regression artifact `pipeline/test/qaPersistence.test.ts` was later added untracked here to run the two E2E-002 tests against unchanged baseline production code; both failed as expected. Lane06 remains at the immutable base.

## Lane 08: recovery

E2E-002, major, verified: a successful stage outcome was counted before its article update succeeded. Failed first writes returned a processed article and could make ContentRunTask report success; failed later writes reported an unsaved final status. Moved processed/status/warning accounting after the awaited update. Two deterministic fail-before tests, 13/13 focused after; full pipeline 803/803; wider scoped journey/concurrency/corpus group 64/64; webhook/scheduler/launch CMS tests 13/13; both typechecks passed. Commit `bbafe1d52fc26989c804a58c986c39419d67fb2c`. Draft PR https://github.com/snowopsdev/datum/pull/87. All current-head checks passed, no comments/reviews when inspected.

Evidence in lane08/qa-artifacts: `e2e-002-before.tap`, `e2e-002-after.tap`, `lane08-integration.log`, `pipeline-full.log`, `expansion1.tap`.

## Lane 10: configuration and process lifecycle

E2E-004, minor, verified: reporting saved results incorrectly loads live research prerequisites. A configured Ahrefs key and blank target domain prevent a read-only report. Dispatch report before tenant resolution and Ahrefs construction. The real subprocess regression fails before and succeeds after, checking both beginning and end of piped output within a 15-second timeout. Full pipeline 801/801, provider/configuration matrix 58/58, both typechecks, scoped ESLint and diff checks pass. Commit `800906f`; draft PR https://github.com/snowopsdev/datum/pull/88. All current-head checks passed, no comments/reviews when inspected.

Evidence in lane10/qa-artifacts: `report-live-no-domain-before.log`, `e2e-004-before.log`, `e2e-004-after.log`, `lane10-provider-matrix.tap`, `pipeline-full.log`, `expansion2.json`.

## Lane 12: selected workflow launch concurrency

Candidate awaiting coordinator ID, major, locally verified: concurrent valid selected article runs lose one launch. The second transaction fails SQLSTATE 40001 (serialization dependency). The advisory-lock SELECT establishes a SERIALIZABLE snapshot before waiting for the first transaction; after it acquires the lock it still has the stale snapshot. READ COMMITTED supplies a fresh subsequent snapshot while the same transaction-scoped advisory lock continues to serialize the active-run decision and atomic run/job write. Regression with a real attached article fails before and passes after. Existing admin one-active-run/snapshot/readiness tests plus new selected regression 4/4 pass; both typechecks, scoped ESLint, diff checks pass. Commit `116a212e54d2cbc2ed98de20627edb89ff3a58d2`; not yet pushed or published pending canonical allocation/coordinator checkpoint.

Evidence in lane12/qa-artifacts: `selected-concurrency-before.log`, `selected-concurrency-after.log`, `workflow-stress.log`, `stress-metrics.json`, `expansion3.log`.

Stress target: actual local `createPipelineRun` workflow, real Postgres writes, mock configuration. Ramp 1, 2, 5, 10, 20 concurrent launch attempts. 38 operations per attempt; two attempts, 76 total, no retries. The second attempt was necessary to persist metrics after the reporter omitted successful console output. Measurement: 376.20 ms, 101.01 operations/s; p50 51.11 ms, p95 131.10 ms, p99 136.79 ms, n=38; errors zero; peak client in flight 20; client RSS 254869504 bytes; 38 run rows and 38 jobs match exactly. No saturation detected or stop triggered. All run/job rows created by the harness are removed through exact run-ID filters; later Postgres activity check showed zero remaining connections to this database. Article/template fixtures remain because append-only audit foreign keys intentionally retain them. This is launch throughput, not model-generation throughput or browser rendering load.

Reusable stress harness (untracked): `cms/tests/int/qaWorkflowStress.int.spec.ts`. From any prepared integration worktree, copy to the same relative path and run `QA_STRESS_OUTPUT=<absolute artifact path> npm run test:int --workspace cms -- tests/int/qaWorkflowStress.int.spec.ts`; hard limits 300 seconds, 500 attempts, concurrency 20; stop on any failure.

## Finite expansion contribution

Pass1, three scenarios passed, no new roots: warnings plus failed persistence; mixed-success batch accounting; failure/retry/third-run history preserving the brief and exactly one saved update. Untracked lane08 `pipeline/test/qaExpansion.test.ts`.

Pass2, three scenarios passed, no new roots: mock monthly report, invalid-period boundary, mock-to-live configuration switch preserving report contents.

Pass3, three scenarios passed, no new roots: an admin run already queued accepts a selected run; duplicate run ID creates neither another run nor an orphan job; an injected enqueue failure rolls back the run and permits retry with the same ID. Untracked lane12 `cms/tests/int/qaQueueExpansion.int.spec.ts`.

## Cleanup and coverage gaps

All registered command sessions completed; no run-owned app listeners. Four databases and worktrees retained for coordinator verification. Each worktree contains npm-generated lock metadata changes that were excluded from commits. Lane08, lane10, lane12 retain untracked evidence; lane06 retains the fail-before test. No user checkout edits, shared database writes, secrets in Git, real messages, paid calls, merged PRs, or branch deletion.

Gaps: paid provider behavior, production worker process crashes, delivery through remote provider infrastructure, sustained generation load, and browser concurrency were not exercised by these pipeline lanes. Local task/queue, provider adapters, deterministic fault injection, DB integrity, CLI subprocess lifecycle, and launch concurrency are covered. API/access lanes05/09 remain outside this worker's scope per coordinator instruction. Combined-fix integration remains coordinator-owned; tests on one branch are not claimed to verify other branches.
