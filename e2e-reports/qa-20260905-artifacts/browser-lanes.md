# Browser lane evidence — qa-20260905

Immutable base: `56c073175f12f38b6c861b382a8f197df71b416c`.
Owned lanes: 01, 02, 03, 04, 07, executed sequentially with isolated local databases and Chromium.
No paid-provider calls. All app targets use ignored lane-specific environment files, mock mode, fresh Payload secrets, disabled development schema push, and cleared outbound webhook environment settings. Tests configure only a loopback webhook receiver.

## Baseline coverage

- Lane01: npm install, all 14 migrations, baseline seed, development startup, homepage HTTP200 in1.63s. Production build passed compilation, type checking and static generation; generated routes include homepage, admin catchall, API, GraphQL, article slug, webhook revalidation, custom route.
- Repository browser suite: 16/16 passed in24.4s at immutable base on4211.
- Lane02: configured seeded credential login, unauthenticated admin redirect, five setup assets and four setup editor pages, demo onboarding and idempotent replay, account identity rendering, logout completion followed by rejected admin navigation.
- Lane03: Listicle selection, manual keyword topic creation, automatic research, brief checkpoint, keyboard-added section and saved/reloaded outline, approval queues writing, generation audit and QA terminal `needs_revision`. This is an expected QA result for the generated fixture and edited outline, not a defect.
- Lane04: model evidence lazy loading, reports period switch, machine-owned edit rejection, approved article publication, signed loopback webhook and public article rendering, users list/create rendering.
- Lane07: Chromium390px viewport homepage, setup, new content, content list and reports each have document scrollWidth390. Chromium320px workspace, positioning, evidence and voice pages each have document scrollWidth320. Keyboard Enter adds brief sections. Template radio arrow behavior finding below.

## E2E-003: finished short runs leave an article showing the old stage

Severity: major. Root: `GlobalRunBar` refreshed only if the previous poll had seen the same run queued/running. A run beginning and ending during the15s idle polling gap never met that condition.

Reproduction at base on4211, `qa_20260905_lane01`:

1. Seed baseline, login, activate demo workspace.
2. New content, Listicle, manual keyword `qa-20260905 coffee brewing methods`, Create.
3. Article60 opens as Research. Worker logs confirm transition to `brief_review`; SQL `select id,status from articles where id=60` returns `60 | brief_review`.
4. Wait60s for `Approve and write`: absent. Accessibility snapshot still shows `Stage 1 of 5: Research`, `Datum is working`, and `Start research`.

Repeatable component regression at base: three tests failed because refresh call count was0 instead of1: run completed between idle polls, different completed run, completed before initial poll. Existing two run-bar tests passed.

Fix commit: `11e81b663da522c1cdb2a6780e9edd66150eac80`, published as PR [#90](https://github.com/snowopsdev/datum/pull/90). Refresh each newly observed settled run once; unchanged settled polling does not refresh repeatedly. Focused run-bar and polling tests8/8 passed; CMS typecheck and scoped lint passed.

Original browser journey retest on4231, `qa_20260905_lane03`, article1: automatic brief appeared without reloading; keyboard section editing persisted; approval led to generation audit without reloading. SQL confirmed both runs succeeded and article was `needs_revision`.

Broader regression at the fix: populated-workspace suite initially15/16 passed because the dashboard test assumed `/admin` even after the documented redirect to Content. The final harness maintenance head `8855deab98e411c4c55b811628044f6e660609de`, published as PR [#92](https://github.com/snowopsdev/datum/pull/92), derives the expected destination from database readiness and serializes the shared-database browser suite. This is excluded from app defect counts. The full suite then16/16 passed, including the final combined 30.4-second run; scoped lint passed.

## E2E-005: template radio controls ignore arrow keys

Severity: minor; verified and published as PR [#91](https://github.com/snowopsdev/datum/pull/91). At the base, select a template on New content, focus its `role=radio` button and press ArrowRight. The next template is neither selected nor focused; all template buttons are in the Tab sequence. The declared radiogroup lacks its expected keyboard interaction.

Regression: `cms/tests/int/newContentKeyboard.int.spec.ts` on lane07. Fail-before: expected `[0,-1,-1]` tabindex values, got `[0,0,0]`. Browser fail-before on4231: `secondSelected=false, secondFocused=false`.

Fix commit `7e7f3b9504d5a8142f4a3372d84f808e6c55e4e0` on `codex/qa-20260905-lane07`: one tab stop, wrapping arrow movement, Home/End boundaries, focus and selected template updated together. Native button Enter/Space activation remains intact. Regression1/1 passed, CMS typecheck and scoped lint passed. Original browser retest on4271: `secondSelected=true, secondFocused=true`. Full repository Chromium suite16/16 passed18.4s. The lane07 server used isolated database `qa_20260905_lane07`,14 migrations and baseline seed.

## Expansion results

Finite pass1 selected before execution: mobile template/manual keyword whitespace guard; unknown public slug404; content tabs Back/Forward history. All three passed; zero new roots.

Finite pass2 selected before execution:320px setup editors;300character search then clear recovery; written article/generation audit persists after reload. All three passed; zero new roots. No third browser pass required after two zero-new-root passes; this is only the browser contribution, not campaign-wide exhaustion.

## Exclusions and gaps

- Early scratch-script brief selector matched `New section heading`; fixed to exact matching. Excluded harness error.
- Early scratch-script logout immediately navigated away before its client effect ran. Awaiting Login control before revisiting admin confirmed logout works. Excluded harness error.
- No email adapter configured: recovery screen can be inspected but external reset email delivery is unavailable. No real email requests were made.
- Live providers, non-Chromium platforms, and screen-reader operation remain untested in these lanes. No access-scope/API authorization tests were taken over from blocked lanes.

## Resources and retained evidence

- Lane01 app session45699,4211, database `qa_20260905_lane01`.
- Lane03 app session80938,4231, database `qa_20260905_lane03`.
- Ignored browser artifacts: lane03 `test-results/qa-20260905/{journeys.mjs,ui-boundaries.mjs,expansion.mjs,writing.png,mobile-reports.png}`; analogous scratch journey under lane01.
- npm install changed only uncommitted lockfile normalization in lane01/lane03; excluded from fix commits and retained pending coordinator cleanup.
- Coordinator publication completed as PRs #90, #91, and #92 at the heads recorded above; all checks and final Codex reviews passed with no unresolved conversations.
- Cleanup: exact app sessions45699,80938,26309 interrupted normally and each returned exit0. Browsers closed by script `finally` blocks. Build/install/migration/test sessions completed. No unknown listeners stopped. Local databases retained for coordinator integration/evidence; no remote test data remains. Worktrees retained because their npm install lockfile normalization is intentionally uncommitted and ignored artifacts contain evidence.
