# QA campaign artifacts

These files provide durable, repository-relative evidence for the 2026-09-05 full-application QA campaign. Local worktree and temporary-directory prefixes were sanitized; test output and measured values are unchanged.

- `browser-lanes.md` and `writing-stage.png`: browser coverage and the visual regression evidence.
- `pipeline-lanes.md`: pipeline lane coverage and reproduction notes.
- `api-lanes.md`, the `lane05-*` and `lane09-*` harness/output files, `combined-api-http.json`, and `combined-webhook-http.json`: API, GraphQL, webhook, and authorization evidence.
- `pipeline-persistence-regression.test.ts`, `pipeline-expansion.test.ts`, `workflow-stress-harness.int.spec.ts`, and `queue-expansion.int.spec.ts`: preserved one-off pipeline and concurrency harnesses; copy them to the original test paths documented in `pipeline-lanes.md` before running.
- `e2e-002-*`, `e2e-004-*`, and `e2e-006-*`: before-and-after reproductions for the corresponding defects.
- `e2e-007-validation.md` and `e2e-007-benchmark.json`: information-gain correctness and performance evidence.
- `workflow-stress-metrics.json` and `service-stress-metrics.json`: bounded stress results.
- `service-stress-harness.mjs`: the preserved read-only service ramp and recovery harness.
- `expansion-matrix.md`: the finite 6/6/3 scenario lists, required classes, and results.
- `lane08-integration.log`: focused integration verification for E2E-002.

The campaign used mock mode, configured test credentials, and isolated databases. These artifacts contain no live API credentials.

## Running the preserved harnesses

These commands validate repaired behavior and must not run against PR #94 by itself, because that PR contains the campaign record rather than the application fixes. Use a checkout containing the repair head listed for each harness:

| Harness | Required repair head |
| --- | --- |
| `pipeline-persistence-regression.test.ts`, `pipeline-expansion.test.ts` | PR [#87](https://github.com/snowopsdev/datum/pull/87), `bbafe1d52fc26989c804a58c986c39419d67fb2c` |
| `workflow-stress-harness.int.spec.ts`, `queue-expansion.int.spec.ts` | PR [#89](https://github.com/snowopsdev/datum/pull/89), `116a212e54d2cbc2ed98de20627edb89ff3a58d2` |
| `lane05-http-harness.mjs` | PR [#95](https://github.com/snowopsdev/datum/pull/95), `4a78ff7ae6f0ffc60dadaa2c0bd0e3148dd213c4` |
| `lane09-http-harness.mjs` | PR [#96](https://github.com/snowopsdev/datum/pull/96), `53924378264f5f22f303e71cd0096e9242f1b33a` |

The combined campaign checkout contained all four heads. The merge sequence places PR #94 last, so a fresh `main` checkout after the campaign merges also satisfies every prerequisite.

Run these commands from the repository root. Use a migration-built isolated test database and the configured ignored environment file. Remove each copied test after its run so the campaign harnesses do not become part of the permanent test suite.

```bash
cp e2e-reports/qa-20260905-artifacts/pipeline-persistence-regression.test.ts pipeline/test/qaPersistence.test.ts
npx tsx --test pipeline/test/qaPersistence.test.ts
rm pipeline/test/qaPersistence.test.ts

cp e2e-reports/qa-20260905-artifacts/pipeline-expansion.test.ts pipeline/test/qaExpansion.test.ts
npx tsx --test pipeline/test/qaExpansion.test.ts
rm pipeline/test/qaExpansion.test.ts

cp e2e-reports/qa-20260905-artifacts/workflow-stress-harness.int.spec.ts cms/tests/int/qaWorkflowStress.int.spec.ts
QA_STRESS_OUTPUT=../workflow-stress-metrics.repro.json npm run test:int --workspace cms -- tests/int/qaWorkflowStress.int.spec.ts
rm cms/tests/int/qaWorkflowStress.int.spec.ts
rm workflow-stress-metrics.repro.json

cp e2e-reports/qa-20260905-artifacts/queue-expansion.int.spec.ts cms/tests/int/qaQueueExpansion.int.spec.ts
npm run test:int --workspace cms -- tests/int/qaQueueExpansion.int.spec.ts
rm cms/tests/int/qaQueueExpansion.int.spec.ts
```

The HTTP harnesses accept the target URL and output path as arguments. Provide the configured test password through the environment:

```bash
SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" node e2e-reports/qa-20260905-artifacts/lane05-http-harness.mjs http://127.0.0.1:3000 lane05-http.repro.json
SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" node e2e-reports/qa-20260905-artifacts/lane09-http-harness.mjs http://127.0.0.1:3000 lane09-http.repro.json
rm lane05-http.repro.json lane09-http.repro.json
```
