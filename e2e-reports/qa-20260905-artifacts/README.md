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
