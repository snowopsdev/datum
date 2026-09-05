# API and access QA evidence

Base: 56c073175f12f38b6c861b382a8f197df71b416c. Local mock mode only, no provider calls or external target testing.

## Lane05 — E2E-008 / E2E-009

Execution environment: isolated lane05 worktree retained locally during the campaign
Commit: 4a78ff7
Database retained: qa_20260905_lane05, local Postgres socket, role snow.

Corrected exploratory parameterization (array wrapped in case object); before repair: 13 tests, 7 passed, 6 failed. Signed nonnumeric timestamp and NaN each returned200 instead of401. Signed null threw reading event; numeric slug threw after invalidating the ID path; array and object ID accepted incorrectly. These represent two roots, not six defects.

Repair: finite timestamp validation, JSON object/field validation before any invalidation. 4 suites24 tests passed (api, revalidateHook, webhookDeliver, articleEvents); CMS typecheck, scoped ESLint and diffcheck passed. HTTP9/9 requests passed, including rejected malformed bodies, rejected NaN timestamp and successful signed publish. Mocked Next invalidation assertions prove no path invalidation for rejected events. No auth signature bypass claimed; these require a configured signed sender.

Committed artifacts: `lane05-http-harness.mjs`, `lane05-http.json`, and `lane05-health.json` in this directory. The harness accepts a base URL and output path and requires `SEED_ADMIN_PASSWORD` from the configured test environment.
Servers96559 and3568 stopped by exact handles; HTTP53298 exited0. No active services remain.

## Lane09 — E2E-010

Execution environment: isolated lane09 worktree retained locally during the campaign
Database retained: qa_20260905_lane09, local Postgres socket, role snow.

Before repair POST /api/graphql with {Users{docs{id email}}} returned500/empty body twice. Direct schema-build regression failed GraphQLError: Enum values cannot be named: true. Scoring-policy boolean select labels true/false were used as invalid GraphQL enum identifiers, preventing the whole application schema from being created.

Repair: enabled/disabled stored labels; reversible migration renames all six enum labels; parser supports both names and legacy values; beforeValidate normalizes legacy REST/Local inputs; Payload types regenerated. Existing row id1 with true,false,NULL became enabled,disabled,NULL after migration, preserving choices and null fallback. Append-only audit history untouched.

Final checks: 9 CMS suites164 tests passed; pipeline igPolicy37 passed; both workspace typechecks passed; scoped ESLint and diffcheck passed. New tests restore changed global values in finally and delete their fixture user in afterAll; append-only cost rows remain within the isolated database. An intermediate GraphQL test ESM/CJS realm mismatch was a harness issue, corrected by using the same Node GraphQL instance as Payload.

Coverage: 15 private collection anonymous-denial and authenticated-read pairs; six private-global anonymous denials; public media; five internal collection creation denials; persisted cost update/delete immutability; article review/machine-state gates and governance/brand audit suites. HTTP28/28 checks cover anonymous/authenticated REST, bad password, tampered JWT, session privacy, logout/token revocation, private globals, public media, internal-write denials, anonymous GraphQL without user disclosure and authenticated GraphQL results.

Committed artifacts: `lane09-http-harness.mjs`, `lane09-http.json`, and the intentionally empty `lane09-graphql-before-body.txt` in this directory. The harness accepts a base URL and output path and requires `SEED_ADMIN_PASSWORD` from the configured test environment. The HTTP 500 and schema-build failure are also preserved in the immutable PR #96 regression source linked from the canonical report.
Servers24641 and4033 stopped by exact handles. HTTP84340 failed on the original500; HTTP10633 and final harness invocation exited0. No active services remain.

## Limits and cleanup

No paid integrations tested; intentionally mock-only. Multi-tenant isolation does not apply to this single-workspace application. No external identity providers configured or tested. These lanes do not replace browser, stress or combined integration coverage owned by the coordinator. Lane11 was reassigned and is not claimed here. No extra discovery beyond the finite matrices above. Databases, ignored isolated env configuration, dependency installs and Next build caches retained for campaign integration/reproduction. No user checkout edits, forced cleanup, remote messages, merges or branch rewrites.
