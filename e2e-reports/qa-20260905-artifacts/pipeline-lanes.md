# QA campaign qa-20260905 — pipeline lanes 06, 08, 10, 12

Immutable base: `56c073175f12f38b6c861b382a8f197df71b416c`. This worker packet has been reconciled to the final campaign state. Original isolated lane worktrees all use Node 22.22.3 and separate local migration-built Postgres databases `qa_20260905_laneNN`. No app listeners or paid providers were used. Each ignored env file has a fresh run-owned Payload secret, isolated database, mock default, and blank outbound webhook settings. Fake keys were used only to check the read-only reporting command.

## Lane 06: persistence baseline

Completed: fresh 14-migration schema; full pipeline baseline 801/801; six CMS files covering migration, atomic launches, append-only article audit, corpus snapshots, information-gain history, and scheduled publishing 37/37. No unique defect attributed to this lane. The preserved `pipeline-persistence-regression.test.ts` artifact ran the two E2E-002 tests against unchanged baseline production code; both failed as expected. Lane06 remains at the immutable base.

## Lane 08: recovery

E2E-002, major, verified: a successful stage outcome was counted before its article update succeeded. Failed first writes returned a processed article and could make ContentRunTask report success; failed later writes reported an unsaved final status. Moved processed/status/warning accounting after the awaited update. Two deterministic fail-before tests, 13/13 focused after; full pipeline 803/803; wider scoped journey/concurrency/corpus group 64/64; webhook/scheduler/launch CMS tests 13/13; both typechecks passed. Commit `bbafe1d52fc26989c804a58c986c39419d67fb2c`; PR https://github.com/snowopsdev/datum/pull/87 is ready, green, and Codex-reviewed with no unresolved conversation.

Committed evidence in this directory: `e2e-002-before.tap`, `e2e-002-after.tap`, `lane08-integration.log`, `pipeline-persistence-regression.test.ts`, and `pipeline-expansion.test.ts`. The broader full-suite log was not retained; its totals remain in the canonical report and CI validates the repair head.

## Lane 10: configuration and process lifecycle

E2E-004, minor, verified: reporting saved results incorrectly loads live research prerequisites. A configured Ahrefs key and blank target domain prevent a read-only report. Dispatch report before tenant resolution and Ahrefs construction. The real subprocess regression fails before and succeeds after, checking both beginning and end of piped output within a 15-second timeout. Full pipeline 801/801, provider/configuration matrix 58/58, both typechecks, scoped ESLint and diff checks pass. Commit `800906f`; PR https://github.com/snowopsdev/datum/pull/88 is ready, green, and Codex-reviewed with no unresolved conversation.

Committed evidence in this directory: `e2e-004-live-before.log`, `e2e-004-before.log`, and `e2e-004-after.log`. The provider-matrix and full-suite logs were not retained; their totals remain in the canonical report and CI validates the repair head.

## Lane 12: selected workflow launch concurrency

E2E-006, major, verified: concurrent valid selected article runs lost one launch because the waiting SERIALIZABLE transaction kept a stale snapshot after acquiring the advisory lock. READ COMMITTED supplies a fresh subsequent snapshot while the same transaction-scoped advisory lock continues to serialize the active-run decision and atomic run/job write. The real attached-article regression failed before and passed after; the existing launch checks plus the new regression passed 4/4. Commit `116a212e54d2cbc2ed98de20627edb89ff3a58d2`; PR https://github.com/snowopsdev/datum/pull/89 is ready, green, and Codex-reviewed with no unresolved conversation. Combined integration passed at `2b474b7`.

Committed evidence in this directory: `e2e-006-before.log`, `e2e-006-after.log`, `workflow-stress-metrics.json`, `workflow-stress-harness.int.spec.ts`, and `queue-expansion.int.spec.ts`. The immutable PR #89 regression source is https://github.com/snowopsdev/datum/blob/116a212e54d2cbc2ed98de20627edb89ff3a58d2/cms/tests/int/selectedRunConcurrency.int.spec.ts.

Stress target: actual local `createPipelineRun` workflow, real Postgres writes, mock configuration. Ramp 1, 2, 5, 10, 20 concurrent launch attempts. 38 operations per attempt; two attempts, 76 total, no retries. The second attempt was necessary to persist metrics after the reporter omitted successful console output. Measurement: 376.20 ms, 101.01 operations/s; p50 51.11 ms, p95 131.10 ms, p99 136.79 ms, n=38; errors zero; peak client in flight 20; client RSS 254869504 bytes; 38 run rows and 38 jobs match exactly. No saturation detected or stop triggered. The original campaign run removed its run/job rows through exact run-ID filters, and a later Postgres activity check showed zero remaining connections. The preserved harness now intentionally retains uniquely identified run, job, article, and template evidence so uncancellable database calls cannot race cleanup; discard its dedicated isolated database after inspection. This is launch throughput, not model-generation throughput or browser rendering load.

Preserved stress harness: `workflow-stress-harness.int.spec.ts` in this directory. From a prepared integration worktree with a dedicated isolated database, copy it to `cms/tests/int/qaWorkflowStress.int.spec.ts` and run `QA_STRESS_OUTPUT=<artifact path> npm run test:int --workspace cms -- tests/int/qaWorkflowStress.int.spec.ts`; hard limits 300 seconds, 500 attempts, concurrency 20; stop on any failure. Reruns retain their uniquely identified evidence rows in that database.

## Finite expansion contribution

Pass1, three scenarios passed, no new roots: warnings plus failed persistence; mixed-success batch accounting; failure/retry/third-run history preserving the brief and exactly one saved update. Preserved as `pipeline-expansion.test.ts` in this directory.

Pass2, three scenarios passed, no new roots: mock monthly report, invalid-period boundary, mock-to-live configuration switch preserving report contents.

Pass3, three scenarios passed, no new roots: an admin run already queued accepts a selected run; duplicate run ID creates neither another run nor an orphan job; an injected enqueue failure rolls back the run and permits retry with the same ID. Preserved as `queue-expansion.int.spec.ts` in this directory.

## Cleanup and coverage gaps

All registered command sessions completed; no run-owned app listeners. Four databases and worktrees were retained for coordinator verification. Raw lane worktrees retain npm-generated lock metadata and additional untracked evidence; the harnesses and outputs named above are committed in this evidence directory. No user checkout edits, shared database writes, secrets in Git, real messages, paid calls, merged PRs, or branch deletion occurred during the campaign run.

Gaps: paid provider behavior, production worker process crashes, delivery through remote provider infrastructure, sustained generation load, and browser concurrency were not exercised by these pipeline lanes. Local task/queue, provider adapters, deterministic fault injection, DB integrity, CLI subprocess lifecycle, and launch concurrency are covered. API/access lanes05/09 remain outside this worker's scope per coordinator instruction. Combined-fix integration remains coordinator-owned; tests on one branch are not claimed to verify other branches.
