# UI and workflow audit — 2026-09-11

Scope: the Payload admin under `/admin`, the operator journey from first login to a published article, the public reader, and the docs and env files that support them. Method: every screen was driven live on `localhost:3000` (per-worktree database `datum_local_env_keys`, seeded, demo workspace applied, one Listicle and one How-To piece run through the mock pipeline, the remaining statuses cloned by SQL), captured at 1600px and 390px, then cross-checked against the code path behind it. Screenshots live in `docs/audits/screens/` and are named `<step>-<screen>--<desktop|mobile>.png`.

Baseline: `5205dd6` (release 0.6.4).

## How to read this

Each screen was judged on five criteria: **clarity** (is the next action obvious), **steps** (could it be one), **consistency** (same pattern as sibling screens), **feedback** (errors and progress are visible and honest), and **exit** (the user can always get unstuck without the CLI or the raw Payload doc view).

Severity:

| Level | Meaning |
|---|---|
| **P0** | A journey step cannot be completed from the admin; the user needs the CLI or a raw doc edit. |
| **P1** | Silent data change, a misleading state, or an error that hides its cause. |
| **P2** | Extra steps, duplicate surfaces, or a layout that breaks at a supported width. |
| **P3** | Polish: naming, copy, redundancy. |

"Consolidate" here means one surface per job: one nav, one editor per asset, one way to start a run, one place a status is explained.

Effort: **S** under half a day, **M** one to two days, **L** more than two days.

One exploration claim was retracted after the live check: Payload's own flat collection nav does *not* render alongside the curated nav. Every collection and global sets `admin.group: false`, which Payload documents as "exclude the entity from the sidebar / dashboard without disabling its routes" (`payload/dist/collections/config/types.d.ts:401`). It works as intended, so it is recorded as a note, not a finding.

## Journey map

| # | Step | Screen | Verdict | Findings |
|---|---|---|---|---|
| 1 | First landing | `/admin` (setup checklist) | Clear, but the gate is satisfied by a placeholder domain and the nav is closed at 1440px | F-001, F-002, F-003, F-004, F-005 |
| 2 | Setup steps | `/admin/ops/setup/*` | Consistent stepper pattern; audiences take three saves; assistant prerequisite unstated | F-006, F-007, F-008, F-009, F-010 |
| 3 | Brand voice | `/admin/ops/governance/brand-voice` | Works; different pattern from every other asset; replace cards always shown | F-011, F-012 |
| 4 | Models, scoring policy, webhooks | `/admin/globals/*` | Raw Payload forms; Models mentions codex; Webhooks unreachable from nav; secret in plain text | F-013, F-014, F-015 |
| 5 | Shadowed globals | `/admin/globals/workspace-profile`, `positioning`, `evidence-bank` | Fully editable second surface, exposes JSON internals | F-016 |
| 6 | New content | `/admin/ops/new` | Good three-panel flow; two template pickers on one page; unnamed radios; no readiness message | F-017, F-018, F-019 |
| 7 | Content list | `/admin/ops/content` | Strong. Stalled pieces hide under "In progress"; run panel is global | F-020, F-021 |
| 8 | Article review, all 11 statuses | `/admin/ops/articles/:id` | Reviewer states are good. Three statuses have no exit; approve and publish leave the page; copy references the CLI; mobile unusable | F-022 to F-031 |
| 9 | Raw doc view | `/admin/collections/articles/:id` | 10,000px form with JSON editors; silent demotion reproduced | F-032, F-033 |
| 10 | Source review, Sources | `/admin/ops/governance/source-review`, `/admin/collections/evidence-sources` | Fine; Sources is a raw list view under a Setup nav item | F-034 |
| 11 | Templates | `/admin/ops/templates` | Fine; second edit surface via "Open in admin" | F-035 |
| 12 | Reports | `/admin/ops/reports` | Data is right; presentation is developer-facing | F-036, F-037 |
| 13 | Records group | sidebar | Fine | — |
| 14 | Redirect stubs, scaffold route | `/admin/ops/topics`, `/admin/ops/articles`, `/my-route` | Dead weight | L-3, L-4 |
| 15 | Public site | `/`, `/articles/:slug` | Reader is clean; header has a stale link and internal copy; FAQ heading doubled | F-038, F-039, F-040 |
| 16 | Mobile pass | steps 1, 7, 8 | Checklist and banner overflow; review page renders at 800px | F-004, F-005, F-030 |
| 17 | Live-mode banner and cost gate | any page | Banner copy and dismissal; the confirm is enforced server-side only for gap runs | F-003, F-041 |

## Findings

### Navigation and information architecture

**F-001 · P2 · Sidebar is collapsed by default at 1440px** — Payload restores the open state only when the viewport is wider than `$breakpoint-l-width: 1440px` (a `max-width` query, so 1440 itself counts as "large break"); at 1440x900 (the default MacBook resolution) every page opens with the nav closed and no section labels visible. Evidence: `screens/01-admin-landing--desktop.png` was captured at 1600 to show the nav at all; the same route at 1440 renders the hamburger only; `@payloadcms/ui/dist/elements/Nav/context.js:57`, `scss/vars.scss:10`. Fix: override the breakpoint variable or open the nav on first load in a small client component. Effort S.

**F-002 · P3 · Setup links point at three URL families** — Setup lists `/ops/setup/*`, `/ops/governance/*`, `/ops/templates`, `/collections/evidence-sources`, and `/globals/*` as siblings. Evidence: `cms/src/components/ops/ExtraOpsNavLinks.tsx:20-48`. Fix: move brand voice and source review under `/ops/setup/` (keep redirects for one release), or split the nav into Setup and Governance to match the URLs. Effort S.

**F-014 · P2 · Webhooks global has no nav entry** — reachable only by URL. Evidence: `ExtraOpsNavLinks.tsx` has no link to `/admin/globals/webhook-settings`; README line 54 documents it. Fix: add it under a Delivery or Settings section with Models and Scoring policy. Effort S.

**F-034 · P3 · "Sources" opens a raw Payload list under a Setup item** — the only curated nav link that lands on Payload's default list UI (`screens/10-sources--desktop.png`). Fix: either give Sources an ops view or move it to Records. Effort S/M.

### Onboarding

**F-003 · P1 · A placeholder domain from `.env.example` satisfies the workspace gate** — with `TARGET_DOMAIN=example.com` copied from the example file, the checklist shows a green check, "NEARLY THERE", and "example.com (from TARGET_DOMAIN)". The workspace editor then says "Leave blank to keep using example.com". Nothing tells the operator that the domain nobody chose will be crawled and used in every prompt. Evidence: `screens/01-admin-landing--desktop.png`, `screens/02-setup-workspace--desktop.png`; `cms/src/lib/workspaceReadiness.ts:308-313` (`profile.targetDomain !== null`), `cms/src/lib/tenant/workspaceProfile.ts` (env fallback). Fix: treat the literal `example.com` / `competitor-a.com` values as unset, or require the global to be saved once for the gate. Effort S.

**F-004 · P2 · Runtime banner overflows on mobile** — `.datum-runtime` is a flex row with no `flex-wrap`, so at 390px its three children squeeze side by side and the `ANTHROPIC_API_KEY` code span pushes the document to 408px wide. Evidence: `screens/01-admin-landing--mobile.png`; `capture-log.json` records `hOverflow: true` for `/admin` and `/admin/ops/setup` in that state; `cms/src/components/ops/ops.css:2928-2947`. Fix: `flex-wrap: wrap` or stack below 700px. Effort S.

**F-005 · P2 · Checklist cards extend past the viewport on mobile** — cards in `.datum-first` overflow the right edge at 390px. Evidence: same screenshot. Fix: `max-width: 100%` and box-sizing on the card. Effort S.

**F-006 · P1 · Templates gate every run but are not on the checklist** — `content.ready` is part of readiness and of `pipelineReady`, yet `checklistRows()` has five rows and none is Templates. A workspace with no templates shows a green checklist and a New content page with only "+ New template". Evidence: `cms/src/lib/workspaceReadiness.ts:314`, `cms/src/components/ops/NewContentView.tsx:54`, `cms/src/components/ops/SetupChecklist.tsx:83`. Fix: add a sixth row, or show the missing-template state inline on New content. Effort S.

**F-007 · P2 · Audience needs Save, then Activate, and for later audiences Make primary** — two round trips for the first audience (the hook auto-sets primary on first activation, `Icps.ts:80-95`) and three for any later one; primary-before-active is refused with a 400 the operator only discovers by trying. The "Review & activate" step exists as step 9 but the buttons sit on every step. Evidence: `screens/02-setup-audience-new--desktop.png`, `screens/02-setup-audience-existing--desktop.png`; `cms/src/components/ops/IcpEditor.tsx:201-221`; `cms/src/collections/Icps.ts:51-62`. Fix: one "Save and activate" on the last step, with "Make primary" as a checkbox in the same save; keep Archive separate. Effort M.

**F-008 · P2 · Models global is invisible from onboarding** — nine model selects decide every paid call, but nothing on the checklist or the New content page points at them. Evidence: `ExtraOpsNavLinks.tsx:43` is the only link. Fix: a "Models" recommended row on the checklist, or show the resolved models on the New content page. Effort S.

**F-009 · P2 · "Fetch site pages" is the assistant's real input but no step says so** — Draft with AI on Audiences, Positioning and Evidence reads the fetched pages; with none fetched it drafts from nothing. The checklist shows "site pages not fetched" but the step editors do not. Evidence: `docs/tenant-context.md` "AI assist"; `screens/02-setup-audience-new--desktop.png`. Fix: show a "No site pages yet — fetch them" line inside the assistant box until pages exist. Effort S.

**F-010 · P3 · Setup editors carry redundant progress and an always-enabled Refine** — "step 1 of 3" pill next to the title duplicates the numbered rail; "Refine with AI" is enabled on an empty form; the assistant box repeats the same two-line explanation on every step. Evidence: `screens/02-setup-workspace--desktop.png`. Fix: drop the pill, disable Refine until the section has content, say the explanation once. Effort S.

**F-041 · P2 · Live-mode blockers are a dismissible banner, then a run-time error** — missing keys show as a banner the operator can close for the session; the same blocker then returns as a server-action error string when they try to run. The copy "until whoever deploys this sets" reads oddly for the solo operator who is the deployer. Evidence: `cms/src/components/ops/RuntimeBanner.tsx:40-66`, `cms/src/components/ops/contentRunActions.ts:32-37`. Fix: non-dismissible in live mode, and disable the run controls with the same message. Effort S.

### Setup asset editors

**F-011 · P2 · Brand voice uses a different editing pattern from every other asset** — audiences, positioning and workspace use `AssetStepper` (vertical numbered rail, Back/Next); brand voice uses horizontal tabs, its own 9-step onboarding stepper, and its own copies of the form primitives. Evidence: `screens/03-brand-voice-active--desktop.png` vs `02-setup-audience-existing--desktop.png`; `cms/src/components/ops/setupFields.tsx:1-9` ("brandVoiceSections grew its own copies"). Fix: port brand voice to `AssetStepper` and `setupFields`, delete the duplicates. Effort L.

**F-012 · P3 · "Replace this voice" upload and onboarding cards are always shown** — under an active voice the two entry cards remain in the left column, which reads as a prompt to start over. Evidence: `screens/03-brand-voice-active--desktop.png`. Fix: collapse them behind a "Replace this voice" disclosure. Effort S.

**F-016 · P2 · Three assets have two live edit surfaces** — Workspace, Positioning and Evidence bank each have an ops editor and a raw Payload global that is fully editable and exposes internals (Site Pages as a JSON code editor, fetched-at timestamps, hidden counters). README line 118 still sends users to the raw one. Evidence: `screens/05-global-workspace-profile--desktop.png`; `cms/src/globals/{WorkspaceProfile,Positioning,EvidenceBank}.ts`. Fix: make the raw globals read-only for non-admins or hide them (`admin.hidden: true`) and route "Open in admin" links to the ops editor. Effort S.

**F-035 · P3 · Templates and brand voice offer "Open in admin" as a second editor** — the raw collection form allows edits the ops editor validates differently. Evidence: `screens/11-templates--desktop.png`; `cms/src/components/ops/BrandVoiceView.tsx:26`. Fix: same rule as F-016. Effort S.

### Globals rendered raw

**F-013 · P3 · Models description talks about codex** — "Local codex/ execution is disabled for application content; those choices are available only for mock fixtures." Goes away with L-1. Evidence: `screens/04-global-models--desktop.png`; `cms/src/globals/LlmSettings.ts:29`.

**F-015 · P2 · Webhook secret is a plain text field** — visible on screen and in the API tab. Evidence: `screens/04-global-webhooks--desktop.png`. Fix: mask the field (Payload `admin.components.Field` with type password) and hide it from the API view. Effort S.

### New content

**F-017 · P2 · Two template pickers on one page** — the card grid selects a template for the intent flow, and the collapsed "Or let Datum find gaps automatically" form has its own template select that ignores the card (defaults to Comparison while Listicle is selected). Evidence: `screens/06-new-content--desktop.png`; `cms/src/components/ops/NewContentFlow.tsx:162-176`, `ContentRunForm.tsx`. Fix: the gap form inherits the selected card; only count remains. Effort S.

**F-018 · Retracted after code review.** The walkthrough's accessibility tree listed the four template cards as unnamed radios and the "+ New template" link as unnamed, but the source (`cms/src/components/ops/NewContentFlow.tsx:93-116`) gives the group an `aria-label`, each `role="radio"` button text content and `aria-checked`, and the link visible text. The tool did not compute names from content; an axe run in Phase 2C should confirm and close this.

**F-019 · P2 · The card flow on New content shows no readiness message** — before the demo workspace was applied the page rendered the template cards and topic panel with no notice; only the collapsed gap-run panel says "Finish workspace setup before starting this." (`NewContentFlow.tsx:169-174`). The primary path lets the operator pick a template and type a keyword, then fails in the action. Evidence: `screens/06-new-content--desktop.png` (captured before the demo workspace); `NewContentView.tsx:54`. Fix: the same notice at the top of the card flow, listing `governance.problems` with links, and disabled create buttons. Effort S.

### Content list

**F-020 · P1 · Stalled pieces are filed under "In progress" as if Datum were working** — `topic_selected`, `researched`, `drafted` and `qa_passed` have `owner: 'run'`, so the list and the article header say "Datum is working · Research: researching what already ranks" even when no run exists. After the SQL clones the list showed "In progress 4" with nothing running. Evidence: `screens/07-content-list-mixed--desktop.png`, `screens/08-review-topic_selected--desktop.png`; `cms/src/lib/articleStatusMeta.ts:84`. Fix: derive "working" from an active run that includes the article; otherwise show "Stalled · needs a run" under Needs you with a button (see F-022). Effort M.

**F-021 · P2 · "Last run" panel and the run bar describe the newest run globally** — with several pieces in flight the panel above the list and the bottom bar can describe a different piece than the one clicked. Evidence: `cms/src/components/ops/boardActions.ts:212-223` (`latestRunAction` returns one row). Fix: per-article run status on the review page; list panel summarises active runs. Effort M.

### Article review

**F-022 · P0 · No admin action can advance `researched`, `drafted` or `qa_passed`** — the status panel for the first two says "No operator action required. Wait for the pipeline or open the document in admin."; `qa_passed` has its own "Awaiting information gain" panel that says the stage "runs on the next `pipeline:run`" (`ArticleReview.tsx:831-846`). Nothing in the admin will ever pick these up: every CMS-initiated run is scoped to the articles attached when it was queued (`contentRun.ts:133`), and the only unscoped sweep is `npm run pipeline:run`. Reproduced with articles 3, 4 and 5. Evidence: `screens/08-review-researched--desktop.png`; `cms/src/components/ops/ArticleReview.tsx:995-1016`; `cms/src/jobs/contentRun.ts:133`; `cms/src/components/ops/boardActions.ts:102` (`runSelectedArticlesAction` is only called at `topic_selected`). Fix: a "Run next stage" button on the review page and a bulk "Run" on the list for every runnable status, calling `runSelectedArticlesAction`. Effort M.

**F-023 · P0 · Regenerate and Reset land the article in a status with no button** — "Regenerate from gaps" moves to `researched`, "Reset to drafted" moves to `drafted`; both then hit F-022. The panel copy admits it: "Reset to `drafted` re-enters QA on next `pipeline:run`." Evidence: `screens/08-review-needs_revision--desktop.png`; `ArticleReview.tsx:741,823,836`. Fix: these actions queue a `selected` run themselves, the way brief approval does (`briefActions.ts:207`). Effort S once F-022 exists.

**F-024 · P1 · Silent demotion on edit** — editing the title of a `verified` article with a PASS decision moved it to `drafted` and nulled the decision, with no warning before the save and no UI copy anywhere that explains the rule. Reproduced through the local API (the same hook path the doc view uses) on article 9. A generic `status_changed` audit row is written (`cms/src/lib/articleAudit.ts:19-65`), but it reads like any other transition and does not say the score was invalidated by an edit. The hook fires only for `verified`, not `approved`. Evidence: `cms/src/lib/articleReviewGate.ts:210-235,345-377` (`invalidateStaleInformationGain`, `SCORED_CONTENT_FIELDS`). Fix: keep the rule but surface it: a confirm in the doc view when status is `verified`, a distinct audit reason "score invalidated by edit to <field>", and (with F-022) a button to re-score. Effort M.

**F-025 · P2 · Approve and Publish navigate away from the article** — both push to `/admin/ops/content`; Publish after Approve is therefore a round trip through the list. Evidence: `ArticleReview.tsx:461` (`if (thenBoard) router.push('/admin/ops/content')`); observed during the walkthrough. Fix: stay on the page with the new status panel, and offer "Back to content" in the toast. Effort S.

**F-026 · P2 · Scheduling and archiving need the raw doc view** — `publishAt` is a sidebar field shown only when `approved`; the ops panel offers only "Publish". Archive is a checkbox in the doc view; `removeTopicsAction` refuses anything past `topic_selected`. Evidence: `cms/src/collections/Articles.ts:263-269`; `ArticleReview.tsx:901-918`; `boardActions.ts:141`. Fix: "Publish now / Schedule for…" on the approved panel; "Archive" with a confirm on every non-running status. Effort M.

**F-027 · P2 · `topic_selected` recovery is two panels and a reload** — Assign template shows a raw SERP dump above the select; Start research appears only after the page re-renders with a template. Evidence: `screens/08-review-topic_selected--desktop.png`; `ArticleReview.tsx:545,582`. Fix: one panel with template select and "Assign and start research". Effort S.

**F-028 · P2 · Audit trail lists every model call as a separate event** — a published piece shows 23 events, of which 13 are "… call completed" rows with a run hash. The decisions a reviewer cares about (approved, published, gate decisions) are buried. Evidence: `screens/08-review-published--desktop.png`. Fix: group calls per run under one collapsible "run 47a3552d · 9 calls · $0.73" row. Effort M.

**F-029 · P2 · Information-gain panel is expert-first** — six KPI tiles, an "uncalibrated" disclaimer paragraph, and a 13-row claims table with N·R·U·H columns render above the Approve controls. The one line a reviewer needs ("Why this decision: nothing tripped a gate") sits below the tiles. Evidence: `screens/08-review-verified--desktop.png`. Fix: lead with the decision and reasons, collapse tiles and claims behind "Show scorecard". Effort M.

**F-030 · P2 · Review page is unusable on mobile** — renders at 800px wide inside a 390px viewport. `.datum-ops__review` does collapse to one column at 900px and the claims table is already wrapped in `.datum-ops__ig-table-wrap { overflow-x: auto }`; the element that forces the width is `.datum-ops__review-main` (784px), a `1fr` grid child with no `min-width: 0`, so the unbroken URLs in the SEO/research block set the track's min-content width. Measured with a DOM probe during the walkthrough. Evidence: `screens/08-review-verified--mobile.png`, `capture-log.json` (`hOverflow: true` on every `/admin/ops/articles/:id`); `ops.css:451-466`. Fix: `min-width: 0` on the grid children and `overflow-wrap: anywhere` on `.datum-ops__prose`. Effort S.

**F-031 · P3 · Status panel copy is wrong for terminal states** — a published article's panel says "No operator action required. Wait for the pipeline or open the document in admin." Evidence: `screens/08-review-published--desktop.png`; `ArticleReview.tsx:1008`. Fix: per-status copy; "Live at /articles/<slug>" with a link for published. Effort S.

**F-032 · P2 · "Open in admin" lands on a 10,000px form with JSON editors** — six call sites send reviewers to the raw doc where research, facets, brief sections and QA results are code editors. Evidence: `screens/09-raw-article-doc--desktop.png`. Fix: with F-026 in place, drop the link for non-admin roles or point it at a read-only view. Effort S.

**F-033 · P1 · Error strings hide their cause** — `boardActions.ts:63` says "Activate a brand voice before running the pipeline" for any governance problem; `contentRunActions.ts:64` reports every `createPipelineRun` failure as "Another content run started at the same time"; `boardActions.ts:305` discards the caught error; `ArticleReview.tsx:464` reduces non-Error throws to "Action failed". Fix: interpolate `readiness.governance.problems` like every other caller; rethrow with the cause. Effort S.

### Reports

**F-036 · P3 · KPI grid wraps one tile onto a second row** — nine tiles in an auto-fill grid leave "With QA" alone. Evidence: `screens/12-reports-all--desktop.png`. Fix: eight tiles or a fixed 3×3. Effort S.

**F-037 · P3 · Report lists use internal identifiers** — "qa passed", "factCheck", "needs_review + blocked", `informationGain` in code font. Evidence: same screenshot; `cms/src/components/ops/ReportsPanel.tsx`. Fix: use `STATUS_META` labels and check names. Effort S.

### Public site

**F-038 · P2 · Header links to a route that no longer exists as a screen** — "Article board" points at `/admin/ops/articles`, a redirect stub. Evidence: `screens/15-public-home--desktop.png`; `cms/src/app/(frontend)/page.tsx:32`. Fix: link "Content" to `/admin/ops/content`, or drop admin links from the public header. Effort S.

**F-039 · P3 · Public index carries internal copy** — "Minimal public reader — long-scroll articles from the content pipeline." Evidence: `page.tsx:42`. Fix: site name and a one-line description from the workspace profile. Effort S.

**F-040 · P2 · FAQ heading rendered twice on the article page** — the generated body ends with an "FAQ" H2 and intro sentence, then the template renders its own "FAQ" H2 with the items. Evidence: `screens/15-public-article--desktop.png`; `cms/src/app/(frontend)/articles/[slug]/page.tsx:65`. Fix: skip the template heading when the body's last H2 is FAQ, or tell the writer not to emit one. Effort S.

## Consolidation proposals

**C-1 · One navigation model.** Keep the curated nav as the only nav (it already is). Regroup into Content / Setup / Governance / Settings so URLs and sections agree (F-002, F-014, F-034). Remove the two redirect views from `payload.config.ts` (L-3).

**C-2 · One edit surface per asset.** Hide or lock the raw globals for workspace, positioning, evidence bank; point every "Open in admin" at the ops editor or remove it (F-016, F-035, F-032).

**C-3 · One editor pattern for setup assets.** Port brand voice to `AssetStepper` + `setupFields`, delete `brandVoiceSections`' private Field/rows copies, rename `Stepper` to `PipelineStepper` so the two steppers stop colliding (F-011).

**C-4 · One way to start a run.** A single `runArticlesAction` used by New content, brief approval, regenerate, reset, a per-article "Run next stage" button, and a bulk "Run" on the list. Every path writes a `pipeline-runs` row and checks readiness (F-022, F-023, F-020). The CLI `run` should call the same function so CLI runs show up in the run bar and Reports.

**C-5 · One review page built from per-status panels.** Split `ArticleReview.tsx` (1,064 lines) into `panels/<status>.tsx` plus shared `Scorecard`, `AuditTrail`, `QaTriage`. Lead every panel with the decision and its actions; collapse evidence (F-029, F-028, F-031, F-025).

**C-6 · One cost aggregation.** `stageKpis` in `opsKpis.ts:23` becomes the only cost-by-stage reducer (today it has zero callers); `boardActions.ts:266-275`, `reportQueries.ts:13-40` and `pipeline/src/report.ts:185-191` call it or its SQL twin, not their own Map.

**C-7 · One env story.** One `.env.example` at the root that both loaders read (Next via `next.config.ts` `env` or a shared `loadEnv`), so the 20 duplicated keys and the "copy everything into cms/.env too" warning go away. Document `DISABLE_DEV_PUSH`, `TEST_BASE_URL`, `TEST_PORT` (`PAYLOAD_AUTO_LOGIN` is already in `cms/.env.example`).

## Legacy removal list

Pre-approved by the user: remove `codex/*` entirely.

| Id | What | Where | Note |
|---|---|---|---|
| L-1 | `codex/*` model ids and every path behind them | `cms/src/lib/llmCatalog.ts` (`CODEX_MIRRORED_MODELS`, `codexMirror`), `llmProvider.ts` (`CODEX_MODEL_PREFIX`, `codexModelId`, `codex-login` and `codex-disabled` requirement kinds, `describeRequirement` branch), `codexCompletion.ts`, `codexAuth.ts`, `cmsLlm.ts:77-142`, `workspaceReadiness.ts` (`needsCodexLogin`, `unsupportedModels`), `loadWorkspaceReadiness.ts:191`, `RuntimeBanner.tsx:53-62`, `tenantActions.ts:621,640`, `pipeline/src/{codexAuth,codexCompletion}.ts`, `pipeline/src/llm.ts:220-247`, `pipeline/src/models.ts:46-50`, `pipeline/src/config.ts:46-60` (`codexAuthPresent`), `LlmSettings.ts:29`, generated enums in `payload-types.ts`; tests `pipeline/test/codexAuth.test.ts`, `llmClient.test.ts:4-6,95,106`, `llmProvider.test.ts:67`, `workspaceReadiness.test.ts:98-180,378-405`, `cms/tests/int/{cmsLlm,brandVoiceExtract}.int.spec.ts` `CODEX_HOME` cases; docs `AGENTS.md:49`, `README.md:120-124`, `docs/diagrams/pipeline-data-flow.{svg,html}` caption | Postgres cannot drop enum values, so the migration removes the options from the field config and regenerates types; the old labels stay in the DB enum harmlessly. Mock fixtures keyed on `codex/*` ids re-point to `claude-*`. |
| L-2 | `@openai/codex-sdk` | `cms/package.json`, `pipeline/package.json`, `cms/next.config.ts:20` `serverExternalPackages` | Zero import sites; pulls six platform binaries. |
| L-3 | Redirect stub views | `cms/src/components/ops/TopicDiscoveryView.tsx`, `ArticleBoardView.tsx`, their entries in `payload.config.ts` and `importMap.js` | Replace with Next `redirects()` if bookmarks matter. |
| L-4 | Payload scaffold route | `cms/src/app/my-route/route.ts` | Returns "This is an example of a custom route." |
| L-5 | Tracked agent state | `cms/src/components/ops/.omc/state/last-tool-error.json` | Untrack and gitignore `.omc/`. |
| L-6 | One-off QA artifacts | `e2e-reports/` (676 KB, 30+ files) | Move to a release asset or delete; keep `coverage.md` if it is still referenced. |
| L-7 | Dead exports | `cms/src/lib/brandVoice.ts:249` `notTraitsOf`, `cms/src/lib/tenant/positioning.ts` `OPEN_RULING_STATUSES` | No readers. |
| L-8 | Unreachable UI branches | `ContentRunForm source="onboarding"` and `contentRun.ts:69-91` `pauseForBrief:false` path; `readiness.verification` (`workspaceReadiness.ts:379-385`) computed on every load and rendered nowhere | Delete or wire up; the audit found no screen that needs them. |
| L-9 | Empty stylesheet | `cms/src/app/(payload)/custom.scss` (0 lines, still imported by `layout.tsx`) | Delete and drop the import, or move `ops.css` tokens here. |
| L-10 | Policy enum compat | `cms/src/globals/InformationGainPolicy.ts:90-91`, `cms/src/lib/informationGain/policy.ts:177-178` accept `'true'/'false'` after the 2026-09-05 rename | Keep until a check confirms no deployed DB holds the old values; then remove. |
| L-11 | Stale comments | `cms/src/lib/articleReviewGate.ts:20-23` cites an Approve button at `qa_passed` that no longer exists | Rewrite the rationale. |
| Keep | `LEGACY_PRICES` in `cms/src/lib/pricing.ts` | Historical cost rows still need a price. Intentional. |
| Keep | `pipeline/src/*` re-export shims | Deliberate single-source-of-truth wrappers, not duplicates. |

## Proposed Phase 2 slices

Order reflects dependency and risk, not size.

**2A · Legacy removal** (pre-approved). L-1 to L-9, L-11; L-10 after the DB check; C-7's documentation half. Verify: `npm run typecheck`, `npm run lint`, `npm test`, `npm run generate:types --workspace cms` clean, migration added. Closes F-013.

**2B · Journey fixes.** C-4 first (it unblocks everything else): F-022, F-023, F-020, F-021. Then F-024 (warn and audit the demotion), F-026 (schedule and archive), F-025 (stay on page), F-027, F-033 (honest errors), F-003, F-006, F-019, F-041. Verify: E2E covering "stalled article → Run next stage → verified", "regenerate → run → new draft", "edit verified in doc view → warning → audit event", "approve then publish without leaving the page".

**2C · Consolidation and polish.** C-1, C-2, C-3, C-5, C-6; F-001, F-004, F-005, F-030 (layout); F-007, F-008, F-009, F-010, F-011, F-012, F-015, F-017, F-018, F-028, F-029, F-031, F-032, F-036, F-037. Verify: Playwright capture at 1440, 1600 and 390 shows no horizontal overflow on any route; accessibility tree names every control on New content.

**2D · Docs, env, public site.** README line 118, `docs/information-gain.md:162,168,221` ("Governance →"), `articleReviewGate.ts` comment, env example dedupe (C-7), F-038, F-039, F-040. Verify: every URL in README and docs resolves in the running admin.

## Walkthrough state to reproduce

- Database: `datum_local_env_keys`, migrated with `npm run payload --workspace cms -- migrate`, seeded with `npm run seed`, then "Start with the demo workspace" clicked once.
- Server: `npm run dev` with `PAYLOAD_AUTO_LOGIN=true` and `MOCK_MODE=true` in `cms/.env` for the walkthrough (both reverted afterwards).
- Articles 1 (Listicle, `needs_revision`) and 2 (How-To, verified → approved → published) were produced by the UI and the mock pipeline; 3-8 are SQL clones of 2 with the status overwritten; 9 was the demotion test.
- Capture script: `node capture.mjs <outDir> [filter]` with `DESKTOP_W=1600` and `EXTRA_ROUTES` JSON; it writes `capture-log.json` next to the screens with status, final URL, H1, load time, horizontal overflow and console errors per route.
