# Tenant steering improvements: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tenant's inputs (audiences, positioning, brand voice, evidence bank) steer the work earlier and learn from later. Specifically:

- Topic discovery ranks by fit to the audience, not only by search volume.
- The brief proposes an angle built from the audience's pain.
- What reviewers keep correcting turns into suggested setup changes.
- The demo workspace tells one story.
- The audience block stops mixing two unrelated lists.

**Architecture:**

- **Tenant facts** live in dependency-free helpers under `cms/src/lib/tenant/`. Both workspaces import them; `pipeline/src/tenant.ts` re-exports the barrel.
- **Pipeline LLM calls** go through `completeJSONLogged()` (`pipeline/src/llm.ts:271`) with a stage registered in `cms/src/lib/llmSettings.ts`.
- **CMS-side LLM calls** follow `assistAction` (`cms/src/components/ops/setupActions.ts:299-375`):
  1. Resolve the model.
  2. Use a fixture in mock mode, or `completeJsonCms` otherwise.
  3. Write a `logCmsCost` row in both cases, including a zero-cost row in mock mode.
- **Readiness** comes from `cms/src/lib/workspaceReadiness.ts`.
- **Audit records** stay append-only: `article-audit`, `governance-audit`, `information-gain-runs`.
- **Slicing:** each task is one PR and leaves the app runnable and tested.

**Tech Stack:** TypeScript, Next.js 16, Payload 3.89, Postgres, React 19, Vitest (CMS integration), `node --test` via tsx (pipeline), Playwright (E2E).

**Context:** This plan follows the 2026-10-07 review of tenant context. That review shipped three fixes first: the `companyMentions` template rule, the approved brief reaching the qualitative reviewer, and the audience-precedence lines (`audienceToPrompt`, the brief audience note). `docs/tenant-context.md` is the spec for everything tenant-related; where this plan and that doc disagree, update the doc in the same task.

## Order and dependencies

| # | Task | Size | Depends on | Spends model calls |
|---|---|---|---|---|
| 1 | Split "Not our user" from churn triggers | S | none | no |
| 2 | One coherent demo workspace | M | none (do before 3–5 so their fixtures share one story) | no |
| 3 | AI-proposed brief angles | M | 2 for fixtures | yes, one cheap call per researched article |
| 4 | Audience-fit ranking in topic discovery | M–L | 2 for fixtures | yes, one call per uncached search |
| 5 | Setup suggestions from recurring corrections | L | none, but 2 makes its demo meaningful | no in phase A |

Tasks 1 and 2 can run in parallel worktrees. Tasks 3 and 4 touch different files apart from the model-registration lists in `llmSettings.ts`, `LlmSettings.ts` and `CostLog.ts`. If they run in parallel, the second to merge rebases those lists and regenerates its migration.

## Decisions to confirm before starting

These have a recommended default. The tasks are written for the default; each note says what changes if the answer differs.

1. **The demo's subject (Task 2).** *Recommended:* make the demo tenant a home-espresso guide publisher, because the mock pipeline corpus is already espresso and its tests pin verbatim excerpts.
   - *Alternative:* make the corpus about Datum. That means rewriting `pipeline/src/fixtures.ts`, `pipeline/src/corpus/mockPages.ts` and about 12–15 verbatim-excerpt assertions instead of about 20 tenant-fixture assertions.
   - Using Datum itself as the demo tenant also makes the product describe itself in its own demo ("Datum guarantees your articles will rank"), which confuses first-run users.
2. **Brief angles cost money in research (Task 3).** Until now the brief was free by design (see `pipeline/src/brief.ts` header).
   - *Recommended:* make the call always on, with a cheap default model and a deterministic fallback.
   - *Alternative:* an on-demand "Suggest angles" button in the brief editor, CMS-side like `assistAction`. Task 3 notes the swap.
3. **Topic relevance runs in the admin only (Task 4).**
   - *Recommended:* a CMS-only model setting, like `setupAssist`. The CLI `fetch` command keeps opportunity ranking and gains only the deterministic exclusion filter.
   - *Alternative:* a registered pipeline stage so the CLI can score too. That makes the model's provider key a run blocker in `evaluateRuntimeReadiness`, which content runs do not need.
4. **Suggestions are deterministic first (Task 5).**
   - *Recommended:* phase A uses no model. It counts repeated QA findings and phrases humans removed.
   - *Phase B:* clusters free-text reviewer notes with a model. It is listed but not planned in detail.

## Global Constraints

- **Setup and commands:**
  - Node 22+ with npm workspaces. Never run `npm test --workspace cms`; use `npm run test:int --workspace cms`.
  - File-scoped commands:
    - CMS integration: `npm run test:int --workspace cms -- tests/int/<file>.int.spec.ts`
    - Pipeline: `npx tsx --test pipeline/test/<file>.test.ts`
    - Lint: `npm exec --workspace cms -- eslint <file>`
    - Typecheck: `npm run typecheck`
  - Integration tests need a migration-built database. Use a per-worktree database such as `datum_<branch>_test`, run `npm run payload --workspace cms -- migrate` against it, and point `DATABASE_URL` at it. Payload dev push is disabled under Vitest.
- **Schema changes:**
  - Edit the collection or global.
  - Run `npm run payload --workspace cms -- migrate:create <name>` with the dev server stopped. Otherwise dev push adds the column first and the migration then fails on that database.
  - Run `npm run generate:types --workspace cms` and commit both `cms/src/payload-types.ts` and the migration pair (`.ts` and `.json`).
  - If `migrate` reports a `dev` row at batch `-1` on your worktree database, delete that row before migrating. Never do this on a shared database.
- **New fields must not break call sites:**
  - Do not make a new field `required: true`. Payload then requires it on every `create`, which breaks seeds, tests and actions.
  - Default it, and read it through a `…Of()` helper that handles `null`, as `companyMentionsOf` does.
- **Model calls:**
  - Every pipeline LLM call goes through `completeJSONLogged()`.
  - Every CMS LLM call writes a cost-log row through `logCmsCost`, including a zero-cost row in mock mode.
  - Mock mode is the default; no test may need a live key.
- **Shared libraries:**
  - `cms/src/lib/brandVoice.ts` and everything under `cms/src/lib/tenant/` stay dependency-free: no Payload, no Next, no SDKs.
  - Keep `docs/style-guide.md`'s `## Banned phrases` heading and bullet format.
- **Prompt blocks** are deterministic: no ids, and no timestamps except the operator's own dates. A block with nothing in it is omitted rather than sent as a bare heading. Anything that changes a prompt updates its golden test on purpose.
- **Never-touch rules:**
  - Preserve append-only audit records and the gates in `cms/src/lib/articleReviewGate.ts`.
  - Do not add a path from research to drafting that skips brief approval.
- **Commits:**
  - Conventional Commits, one PR per task.
  - Each message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
  - Do not edit `CHANGELOG.md`, release versions, or tags.
- **After code changes:** run `graphify update .`.

### Registering a model setting (shared by Tasks 3 and 4)

The `evidenceCheck` addition in commit `e3275f3` is the reference.

**A pipeline stage (Task 3) touches:**

- `cms/src/lib/llmSettings.ts`:
  - `PIPELINE_STAGES` (L8)
  - `STAGE_ENV_VAR`
  - `STAGE_SETTING_FIELD`
  - `LlmSettingsDoc`
- `cms/src/globals/LlmSettings.ts`: a `modelField(...)` entry (pattern at L72-77).
- `cms/src/collections/CostLog.ts`: the `stage` options (L37-49).
- `pipeline/src/fixtures.ts`:
  - the fixture in `fixtures` (L688-701)
  - `mockUsage` (L722)
  - Both are compile-enforced `Record`s.
- Test contexts that list every stage model must add `<stage>: 'mock'`:
  - `pipeline/test/generateStage.test.ts`
  - `pipeline/test/llmSettlement.test.ts`
  - `pipeline/test/qaStagePrompts.test.ts`
  - `pipeline/test/scopedPipeline.test.ts`
- Tests that iterate `PIPELINE_STAGES`:
  - `pipeline/test/fixtures.test.ts`
  - `pipeline/test/models.test.ts`
  - `pipeline/test/llmSettings.test.ts`
  - `cms/tests/int/llmSettings.int.spec.ts`
- `.env.example`, `cms/.env.example`, and the model list in `README.md`.
- The migration adds an `llm_settings` column and runs `ALTER TYPE enum_cost_log_stage ADD VALUE '<stage>'`. Pattern: `cms/src/migrations/20260903_024506_positioning_global_and_llm_stage_schema.ts`.

**A CMS-only setting (Task 4) touches:**

- `cms/src/lib/llmSettings.ts`:
  - an `*_ENV_VAR` constant
  - a `LlmSettingsDoc` field
  - an `LLM_SETTING_FIELDS` entry
  - a `resolve*Model` helper (pattern `resolveSetupAssistModel`, L122)
- The global field, the cost-log option, the migration, and the env and docs lines, as above.
- It does **not** go in `PIPELINE_STAGES`.

---

### Task 1: Split "Not our user" from churn triggers

**Why:** `icpToPrompt` merges `[...notOurUser, ...churnTriggers]` under one heading (`cms/src/lib/tenant/icp.ts:377-382`), so the two lists read as one. They are different instructions:

- "Not our user" tells the writer whom **not to address**.
- Churn triggers say what **not to promise**. The editor's own hint says so: "The writer avoids promising past these" (`cms/src/components/ops/icpSections.tsx:303-325`).

Merged under one heading, the writer gets neither instruction. The writer and the qualitative reviewer both read this block, through `audienceToPrompt`.

**Files:**
- Modify: `cms/src/lib/tenant/icp.ts:377-382`. Replace the merged block with two sections:

  ```ts
  if (icp.notOurUser.length > 0) {
    sections.push(
      `## Not our user (do not write for these readers, even when the topic fits)\n${icp.notOurUser.map((t) => `- ${t}`).join('\n')}`,
    )
  }
  if (icp.churnTriggers.length > 0) {
    sections.push(
      `## Churn triggers (never promise past these)\n${icp.churnTriggers.map((t) => `- ${t}`).join('\n')}`,
    )
  }
  ```

  Update the doc comment above `icpToPrompt` if it describes the sections.
- Modify: `pipeline/test/tenantPrompts.test.ts:120-122` (golden block) and `:162` (the omission check now asserts both headings are absent).
- Modify: `docs/tenant-context.md`. Under "How prompts use them", describe the two sections and what each tells the writer.
- No schema change: the fields are already separate in `cms/src/collections/Icps.ts:327-331`. The editor step stays one step ("Who they are not") with two fields.

**Interfaces:** `icpToPrompt` keeps its signature. `icpAudienceLine` is unchanged; the brief never read these fields.

- [ ] **Step 1: Write the failing golden test.** Change the expected block in `tenantPrompts.test.ts` to the two headings above, with "Solo bloggers…" under the first and "Churns when…" under the second. Add a case with only churn triggers that asserts `## Not our user` is absent and `## Churn triggers` is present.
  Run: `npx tsx --test pipeline/test/tenantPrompts.test.ts` → FAIL.
- [ ] **Step 2: Implement the split** in `icp.ts`.
  Run the same test → PASS. Then run `npm test --workspace pipeline` and `npm run typecheck`.
- [ ] **Step 3: Check the reviewer path.** In `pipeline/test/qaStagePrompts.test.ts`, add an audience with one `notOurUser` row and assert the qualitative-review prompt contains `## Not our user (do not write for these readers`.
- [ ] **Step 4: Docs, graph, commit.**
  Message: `fix(tenant): render "Not our user" and churn triggers as separate audience sections`

---

### Task 2: One coherent demo workspace

**Why:** The demo spans three unrelated subjects, so mock runs demonstrate the very mismatch the tenant context exists to prevent. The evidence-check fixture says so itself (`pipeline/src/fixtures.ts:676-686`).

| Source | Subject today |
|---|---|
| Tenant fixtures (`cms/src/lib/tenant/fixtures.ts`): profile, audiences, positioning, evidence bank | Datum, a B2B content tool |
| Brand voice fixture | mixed: Datum essence with coffee examples |
| Mock pipeline output (`pipeline/src/fixtures.ts`) and competitor pages (`pipeline/src/corpus/mockPages.ts:19-206`) | espresso |
| Mock Ahrefs `contentGapKeywords` (`pipeline/src/ahrefs.ts:269-364`) | CRM software |
| Workspace site pages (`mockPages.ts:227-302`) | Datum |
| Game Preview template example | college football |

**Decision (default):** the demo tenant becomes a home-espresso guide publisher. Working name **Kettle & Burr**, domain `kettleandburr.example.com`; competitors stay `competitor-one.com` and `competitor-two.com`. Everything the tenant says about itself moves to that company. The espresso corpus, its verbatim-excerpt tests, and the coffee evidence sources (`cms/src/seed.ts:308-324`) stay as they are.

The Game Preview template stays: it is a template showcase, not part of the tenant story, and it already has `companyMentions: 'none'`. "Datum" stays the product name everywhere it means the product (admin UI, the `admin@datum.local` user, README).

**Files:**
- **Rewrite `cms/src/lib/tenant/fixtures.ts`:**
  - `WORKSPACE_PROFILE_FIXTURE` (15-24)
  - `ICP_FIXTURE` and `ICP_FIXTURE_SECONDARY` (27-118), for example "Home barista upgrading from a pod machine" and "Café owner training new staff"
  - `POSITIONING_FIXTURE` (125-180)
  - `EVIDENCE_BANK_FIXTURE` (228-296)
  - Keep the shapes: every confidence level the tests exercise, one rejected claim with a replacement, one claim cleared only for `sales`, one incomplete claim, and E/F/R refs.
  - Keep each ICP's `notOurUser` and `churnTriggers` non-empty, so Task 1's sections render in the demo.
- **Modify `cms/src/lib/brandVoiceFixture.ts`:**
  - Rewrite the essence and audience (12-26) for Kettle & Burr. The coffee examples (33-46, 50, 71) already fit.
  - Keep the banned words absent from the mock generate fixture (comment at L5-7).
- **Modify `cms/src/lib/tenant/workspaceProfile.ts:18-19`:** mock default domain `kettleandburr.example.com`.
- **Modify `pipeline/src/corpus/mockPages.ts:227-302`:** the workspace pages (home, about, product → "guides", pricing → "membership") describe Kettle & Burr. Make sure no page states anything the evidence bank's rejected rows forbid.
- **Modify `pipeline/src/ahrefs.ts` (mock `contentGapKeywords`):** replace the four CRM keywords with espresso gaps, for example "best espresso grinder under 300", "how to dial in espresso", "breville bambino vs gaggia classic", "espresso machine descaling schedule". Keep the volume and difficulty spread.
- **Modify `pipeline/src/fixtures.ts:676-686`:**
  - The evidence-check fixture now returns one `backed` claim citing a demo `E` ref.
  - Optionally, the generate fixture's body cites that ref as `[E1]`. Then `extractEvidenceCitations` and `checkEvidenceRefs` run in mock mode. If you add the marker, update `pipeline/test/igFixtures.test.ts`: excerpts must be verbatim *after* marker stripping.
- **Modify copy:**
  - `cms/src/components/ops/SetupChecklist.tsx:261-273`: the demo hint no longer says "a plain B2B voice".
  - `README.md:49,103,160`
  - `docs/tenant-context.md:59-62`
  - `docs/information-gain.md:299,311`: the note about espresso fixtures versus CRM keywords goes away.
- **Modify the tests that read fixture values literally** (from the inventory):
  - `pipeline/test/tenantPrompts.test.ts:391-424`
  - `pipeline/test/evidenceBank.test.ts:354-393`
  - `pipeline/test/assist.test.ts:93-96,208-209,438,465`
  - `pipeline/test/tenantLib.test.ts:138,353-354`
  - `pipeline/test/sitePages.test.ts:209-228`
  - `cms/tests/int/positioning.int.spec.ts:90-97,147`
  - `cms/tests/int/brandVoice.int.spec.ts:90,124,146`
  - `cms/tests/int/workspaceProfile.int.spec.ts:188`
  - `cms/tests/int/evidenceBank.int.spec.ts:410-490` and `cms/tests/int/qaFailures.int.spec.ts:177-196` (R6 text)
- **Leave alone:** the tests that write their own inline Datum or CRM strings (for example `qaStagePrompts.test.ts:244-386`, `generateStage.test.ts`). They do not read the fixtures; rewriting them is churn without benefit.

**Interfaces:** the export names are unchanged (`ICP_FIXTURE`, `POSITIONING_FIXTURE`, …); only the values change. `activateDefaultTenantAction` (`cms/src/components/ops/tenantActions.ts:695-717`) is unchanged; it is create-only, so an existing dev database keeps its old demo until reset.

- [ ] **Step 1: List the pinned literals.** Run `grep -rn "Datum\|datum.example\|Marketing lead\|Founder writing\|Competitor One\|reviewer gate\|best crm\|hubspot" pipeline/test cms/tests cms/src/lib/tenant cms/src/lib/brandVoiceFixture.ts pipeline/src --include=*.ts`. Sort each hit into: fixture source, reads the fixture (update), or writes its own literal (leave). Product-name uses of "Datum" stay.
- [ ] **Step 2: Rewrite the fixtures**: tenant fixtures, brand voice, workspace default, mock site pages, mock Ahrefs gaps.
- [ ] **Step 3: Update the tests that read them.** Run `npm test --workspace pipeline` and the integration specs listed above. Run `npm run typecheck`.
- [ ] **Step 4: Check the demo end to end in mock mode.**
  1. Reset the worktree database and migrate.
  2. Run `npm run seed --workspace cms -- --with-brand-voice`.
  3. Start the dev server and open `/admin`; the checklist should be complete.
  4. Create a Listicle for "best espresso grinder under 300" at `/admin/ops/new`, approve the brief, and let the job run.
  5. Confirm on the review page:
     - The brief audience line is about home baristas.
     - The evidence card shows the backed claim.
     - Nothing in the draft mentions a B2B content tool.
- [ ] **Step 5: Docs, graph, commit.**
  Message: `chore(demo): make the demo workspace an espresso publisher end to end`

---

### Task 3: AI-proposed brief angles

**Why:** The brief's angle is the template intent plus the keyword: `A ranked list of the best options… for "x"` (`pipeline/src/brief.ts:304`). It is the cheapest place to steer a piece. The editor approves it before any writing is paid for, and today it ignores everything the workspace knows: the audience's pains, the gaps the ranking pages leave, the positioning, and the template's company-mentions rule. Three proposed angles, each tied to a stated pain and a research gap, give the editor something real to choose from.

**Design:**

- **New pipeline stage `briefAngle`**, called once by `researchStage` after the snapshot (`pipeline/src/research.ts`, after L68). It uses the article's selected audience.
- **Input:**
  - the keyword and secondary keywords
  - the template name and intent
  - `audienceToPrompt(ctx.brandVoice, icp)`
  - `positioningToPrompt(ctx.tenant.positioning)`
  - the gaps and facets (labels and descriptions only)
  - `companyMentionsBlock(companyMentionsOf(template), ctx.tenant)`
- **Not sent:** the evidence bank and brand voice samples. An angle is a direction, not prose.
- **Output:** `{"angles":[{"angle":string,"rationale":string,"pain":string|null,"gaps":string[]}]}`, with one to three entries.
- **Validation** by a pure parser `parseBriefAngles(json, {pains, gapLabels})`:
  - Drop an angle over 200 characters, or one whose `pain` does not match one of the audience's pain statements (case-insensitive prefix match), or whose `gaps` include an unknown label.
  - Keep at most three.
  - The parser never throws.
- **The confidence rule carries over:** the system prompt says an angle may rest on a `[hypothesis]` or `[inference]` pain only if its rationale says so.
- **Storage:**
  - `brief.angle` takes the first surviving angle.
  - New `brief.angleOptions` (json) keeps every surviving `{angle, rationale, pain, gaps}`, plus `{angle: <deterministic angle>, rationale: 'From the template', pain: null, gaps: []}` as the last option.
- **Fallback:**
  - Zero surviving angles, a parse error, or a thrown call: keep the deterministic angle, store only the deterministic option, and return a `StageOutcome.warnings` entry (`brief angle: <reason>`).
  - Never fail research for this. The run summary already counts warnings (`pipeline/src/stages.ts`).
  - A thrown call has already billed whatever it billed through `completeJSONLogged`.
- **Precedence:** an editor's saved angle is never overwritten. Research only runs from `topic_selected`, so it never re-runs over a saved brief. Assert that in a test anyway.
- **UI:** `BriefEditor.tsx` shows the options above the angle input as selectable rows: the angle, then a muted "For: <pain> · Fills: <gaps>". Clicking one copies its text into the angle field. The editor can still type freely. `saveBriefAction` is unchanged; `angleOptions` is research output and is not editable.
- **If decision 2 goes the other way:** keep the parser, prompt builder and fixture. Move the call into a `suggestAnglesAction(articleId)` server action following the `assistAction` pattern, with a CMS-only model setting. Drop the research-stage hook.

**Files:**
- Create: `pipeline/src/briefAngle.ts`, exporting:
  - `buildBriefAnglePrompt(input): { system: string; user: string }`
  - `parseBriefAngles(json, allowed): BriefAngleOption[]`
  - `proposeBriefAngles(ctx, article, template, icp, facets, gaps): Promise<{ options: BriefAngleOption[]; warning?: string }>`, which calls `completeJSONLogged(ctx, 'briefAngle', article.id, …)`
- Modify: `pipeline/src/brief.ts`:
  - `BriefDraft` gains `angleOptions: BriefAngleOption[]`.
  - `buildBrief` accepts optional `angleOptions` and sets `angle` from the first.
  - `parseBrief` reads `angleOptions` defensively (missing → `[]`).
- Modify: `pipeline/src/research.ts`: call `proposeBriefAngles`, pass the result to `buildBrief`, and return `warnings`.
- Modify: `cms/src/collections/Articles.ts:192-221`: add `{ name: 'angleOptions', type: 'json', admin: { readOnly: true } }` to the `brief` group. Migration plus types.
- Modify: `cms/src/components/ops/BriefEditor.tsx`, and the server component that loads it (find it with `grep -rn "<BriefEditor" cms/src`), to pass `angleOptions`.
- Modify: `cms/src/components/ops/review/panels/BriefPanel.tsx`: after approval, show which option was chosen, or "Written by the editor".
- Register the stage, per "Registering a model setting" above. Defaults:
  - the platform default model, with a note in the field description that a small model is enough
  - mock usage of about 1 500 tokens in and 300 out, and no web search
- Mock fixture `briefAngle` in `pipeline/src/fixtures.ts`: three espresso angles that reference the Task 2 demo ICP pains and the mock snapshot's gap labels. If Task 2 has not landed, make the fixture valid against whatever the mock snapshot produces, and assert that in `fixtures.test.ts`.
- Tests:
  - Create `pipeline/test/briefAngle.test.ts`.
  - Modify `pipeline/test/brief.test.ts`, `pipeline/test/runPipeline.test.ts` (research stage contract) and `cms/tests/int/briefActions.int.spec.ts` (if present) or the nearest brief action spec.
- Docs:
  - `docs/tenant-context.md`: a new "The brief's angle" section saying what is sent, what is never sent, and the fallback.
  - `pipeline/src/brief.ts` header: the brief is no longer free; say what it costs and why.

**Interfaces:**

```ts
export interface BriefAngleOption {
  angle: string
  rationale: string
  /** The audience pain statement this angle answers, verbatim; null for the template fallback. */
  pain: string | null
  /** Gap labels from research this angle fills. */
  gaps: string[]
}
```

- [ ] **Step 1: Parser tests first** (`briefAngle.test.ts`). Cover:
  - a valid reply keeps three options in order
  - an unknown pain is dropped
  - an unknown gap label is dropped
  - an angle over 200 characters is dropped
  - a non-object reply returns `[]`
  - a `[hypothesis]` pain is allowed (the parser does not police wording; the prompt does)

  Run → FAIL.
- [ ] **Step 2: Prompt golden test.** For a fixed ICP, positioning, gaps and `companyMentions: 'none'`, pin the system and user strings. Assert:
  - the evidence bank and brand-voice samples are absent
  - the `# Company mentions` rule is present
  - the confidence instruction is present

  Run → FAIL.
- [ ] **Step 3: Implement** `briefAngle.ts`, and register the stage: lists, global field, cost-log option, fixture, `mockUsage`, test contexts. Run `npm run typecheck`. It fails until every `Record<PipelineStage, …>` and stage-model literal has `briefAngle`; fix each one.
- [ ] **Step 4: Research stage tests.** Cover:
  - mock research stores `brief.angleOptions` with the three fixture angles plus the template fallback last, and `brief.angle` equals the first
  - an LLM client that throws leaves the deterministic angle and returns one warning, while research still exits at `brief_review`
  - an article whose `brief.angle` was saved by an editor is never re-researched (`topic_selected` is the only entry), so it is never overwritten (assert against `researchStage.entryStatus`)
- [ ] **Step 5: Schema.** Add the field, run the migration and type generation, and run the integration specs that save or approve a brief.
- [ ] **Step 6: Editor UI.**
  - Option rows plus the chosen-option display.
  - Manual check in mock mode on `/admin/ops/content`: open a piece at `brief_review`, click an option, save, approve. The review page's Brief panel shows the chosen option.
  - Lint the changed files.
- [ ] **Step 7: Cost visibility.** Confirm `/admin/ops/reports` groups the new `briefAngle` cost-log rows under their own stage (`cms/src/lib/reportQueries.ts:50-93` groups by the stage string). Add a report test only if grouping needs a label map.
- [ ] **Step 8: Docs, graph, commit.**
  Message: `feat(brief): propose audience-grounded angles during research`

---

### Task 4: Audience-fit ranking in topic discovery

**Why:** Both discovery paths rank by `opportunityScore = volume / max(difficulty, 1)` (`pipeline/src/ahrefs.ts:60-61`):

- the admin's "Suggest topics" (`discoverTopicsAction`, `cms/src/components/ops/topicDiscoveryActions.ts:58`)
- the CLI `fetch` (`pipeline/src/fetchTopics.ts:31-33`)

A high-volume keyword nobody in the audience searches is the first thing offered, and every topic is tagged with the primary audience whether it fits or not (`createTopicsAction` L227-228). The workspace already knows who it writes for and who it does not; discovery should use that before research is paid for.

**Design:**

- **Fit is a label, not a score.** Each candidate gets `strong`, `partial` or `off`, plus the best-fitting active audience id and a one-line reason.
- **Ranking is lexicographic:** fit bucket (`strong`, then `partial`, then `off`), then `opportunity`. Opportunity still decides within a bucket, and an `off` keyword is still shown and pickable, under a collapsed "Probably not for your audiences" group.
- **The model call** is one CMS-side call per uncached search, covering all candidates (25 at most). It follows the `assistAction` pattern with a CMS-only setting, `topicRelevanceModel` / `TOPIC_RELEVANCE_MODEL`, cost stage `topicRelevance`, and run id `topic-relevance:<uuid>`.
- **Prompt input:**
  - `icpToPrompt` for each active audience. "Not our user" is the strongest `off` signal; after Task 1 it has its own heading.
  - The positioning's category and pillars, from `positioningToPrompt`.
  - The workspace profile.
  - The candidate keywords with volume.
- **Output:** `{"candidates":[{"keyword":string,"fit":"strong"|"partial"|"off","audience":string|null,"reason":string}]}`, where `audience` is an audience *name*.
- **The pure parser** maps names to ids and normalizes keywords (trim plus lower case). A candidate the model omitted becomes `partial` with the reason "Not scored". It never drops a candidate, since the list is Ahrefs data and not the model's.
- **Deterministic exclusion, no model:** `notOurUserMatch(keyword, icps)` marks a candidate `off` when it contains a distinctive token from a "Not our user" row (for example "agency", "wholesale"). Distinctive means length ≥ 4, not a stopword, and not in the seed. It runs first, its verdict wins over the model's, and it is the only scoring the CLI gets.
- **Caching:** `TopicSearches` gains `relevance` (json), `relevanceFingerprint` (text) and `relevanceModel` (text).
  - The fingerprint is a sha256 of the active audiences' content, the positioning content and the profile name. Reuse `tenantFingerprint`'s inputs from `cms/src/lib/workspaceReadiness.ts:266` if they are exposed; otherwise hash `icpToPrompt` output plus `positioningToPrompt` output, which is deterministic by design.
  - A cache hit with a stale or missing fingerprint re-scores without re-calling Ahrefs.
  - "Refresh from Ahrefs" re-fetches both.
- **Mock mode:** the fixture is computed, not canned. `mockTopicRelevance(candidates, icps)` marks the `notOurUser` hits `off`, marks candidates containing a token from any pain or `who` line `strong`, and marks the rest `partial`. It is deterministic, so tests and the demo both work. Mock mode writes a zero-cost row.
- **Creation:**
  - `createTopicsAction` accepts an optional `icpId`. The UI passes the best-fit audience of the primary pick when it is `strong` or `partial`, and otherwise falls back to the primary audience as today.
  - The primary keyword is still the first pick in candidate order (the existing `TopicDiscovery.tsx` L120 behaviour), so re-ranking puts the best-fitting pick first. Keep the L330-340 hint accurate.
- **Readiness:** scoring needs at least one active audience. With none (which only happens before setup is complete), skip scoring entirely, show no fit column, and rank exactly as today.

**Files:**
- Create: `cms/src/lib/tenant/topicRelevance.ts` (dependency-free; re-exported by the tenant barrel). It exports:
  - `TopicFit`, `TopicRelevance`
  - `buildTopicRelevancePrompt(input)`
  - `parseTopicRelevance(json, candidates, icps)`
  - `notOurUserMatch(keyword, icps, seed)`
  - `mockTopicRelevance(candidates, icps)`
  - `rankByFit(candidates)`
  - `relevanceFingerprint(icps, positioning, profile)`
- Create: `cms/src/lib/loadTenantContextCms.ts` (or export and generalize `loadAssistContext` from `setupActions.ts:241`). It returns full `IcpContent[]`, positioning and profile; the readiness loader only returns `IcpOption`.
- Modify: `cms/src/components/ops/topicDiscoveryActions.ts`:
  - `discoverTopicsAction` scores, caches and re-ranks.
  - `createTopicsAction` accepts `icpId`.
  - Fix the cache-hit cast at L82 to read through a parser.
- Modify: `cms/src/components/ops/topicDiscoveryTypes.ts`: `TopicCandidate` gains `fit?: TopicFit; fitAudienceId?: number | null; fitReason?: string`.
- Modify: `cms/src/components/ops/TopicDiscovery.tsx`:
  - a Fit column (pill plus reason in a tooltip or second line)
  - the collapsed `off` group
  - pass `icpId` on create
- Modify: `cms/src/collections/TopicSearches.ts`: the three fields. Migration plus types.
- Register the CMS-only setting, per "Registering a model setting".
- Modify: `pipeline/src/fetchTopics.ts`:
  - `FetchContext` gains `tenant: TenantContext`, already loaded in `pipeline/src/index.ts:100`.
  - `fetchTopics` skips candidates where `notOurUserMatch` hits and logs each skip.
  - No model call, so `FetchContext` still has no `llm` or `models`.
- Tests:
  - Create `pipeline/test/topicRelevance.test.ts` for the pure lib.
  - Create `cms/tests/int/topicDiscoverySearch.int.spec.ts` for `discoverTopicsAction`, which has no tests today. Cover:
    - mock scoring and ranking
    - cache hit with a fresh fingerprint: no cost row, no Ahrefs call
    - cache hit after an audience edit: re-scored, one cost row, no Ahrefs call
    - no active audiences: no scoring
  - Extend `cms/tests/int/topicDiscoveryActions.int.spec.ts`: `icpId` is honoured when it names an active audience and ignored otherwise.
  - Extend `pipeline/test/fetchTopics.test.ts` with the exclusion skip.
- Docs: `docs/tenant-context.md` gains a section "Topic discovery" covering fit labels, ranking, the cache fingerprint and the exclusion rule. README gains the new model setting.

**Interfaces:**

```ts
export type TopicFit = 'strong' | 'partial' | 'off'
export interface TopicRelevance {
  keyword: string
  fit: TopicFit
  audienceId: number | string | null
  reason: string
  /** 'model' | 'excluded' (notOurUser match) | 'unscored' */
  source: 'model' | 'excluded' | 'unscored'
}
```

- [ ] **Step 1: Pure-lib tests first.** Cover:
  - `notOurUserMatch` hits on a distinctive token and ignores stopwords and seed tokens
  - the parser maps audience names to ids, keeps an omitted candidate as `partial`/`unscored`, and lets an exclusion beat a model `strong`
  - `rankByFit` orders by bucket then opportunity and is stable
  - the fingerprint changes when an audience pain changes and not when its `updatedAt` alone changes
  - `mockTopicRelevance` is deterministic

  Run → FAIL. Implement → PASS.
- [ ] **Step 2: Prompt golden test.** Two audiences, one with "Not our user" rows, plus positioning and six candidates. Pin the strings and assert no evidence bank and no brand voice.
- [ ] **Step 3: Model setting and schema.** Register `topicRelevance`; add the `TopicSearches` fields; migrate; generate types; typecheck.
- [ ] **Step 4: The CMS loader.** Export a tenant loader for server actions. Keep `assistAction` working: it either uses the shared loader or is untouched. Run `npm run test:int --workspace cms -- tests/int/setupActions*.int.spec.ts` (whatever covers assist).
- [ ] **Step 5: `discoverTopicsAction`.** Implement scoring, caching and ranking; write the new integration spec; run it.
- [ ] **Step 6: Creation picks the fitting audience.** `createTopicsAction` with `icpId`; extend its spec.
- [ ] **Step 7: UI.**
  - The Fit column and the `off` group.
  - Manual check in mock mode at `/admin/ops/new` → "Suggest topics", seed "espresso grinder":
    - fit pills render
    - an `off` row sits in the collapsed group
    - picking two keywords makes the strong one primary
    - the created piece's audience is the fitting one
  - Lint.
- [ ] **Step 8: CLI exclusion.** `FetchContext.tenant` and the skip; extend `fetchTopics.test.ts`.
- [ ] **Step 9: Docs, graph, commit.**
  Message: `feat(discovery): rank suggested topics by audience fit`

---

### Task 5: Setup suggestions from recurring corrections

**Why:** Reviewers fix the same things repeatedly, and nothing carries the fix back into the setup, so the workspace never gets better at writing for itself.

**What is and is not recorded today** (verified):

- No audit row stores what a human changed in an article's text. Generic saves record only `changedFields` names (`cms/src/lib/auditFields.ts:3-13`), and Articles has no versions.
- What *is* kept, per article:
  - **Generated output.** The newest `generate_completed` audit row holds every generated field (`details.output`, written by `pipeline/src/stages.ts:166-185`).
  - **QA history.** Each `qa_completed` row holds that pass's `qaResults`, even after regenerate nulls the article's copy.
  - **Reviewer notes** on `article_sent_back`, `revision_reset`, `article_regenerate_requested`, `article_approved` and `article_published`.
  - **The published fields** on the article itself.
- `TenantReadiness.recommendations` is computed but rendered nowhere (`cms/src/lib/workspaceReadiness.ts:114,336-352`).

**Design (phase A, deterministic, no model):**

**Signals** are pure functions over records. Each yields candidates with a stable `signature` for de-duplication:

| Signal | Source | Threshold | Suggestion | Target |
|---|---|---|---|---|
| **Removed phrase** | For published articles: n-grams (1–3 words) in the generated plain text (newest `generate_completed` → `lexicalToPlainText` of `details.output.body` plus title and meta fields) that are absent from the published text. Exclude stopwords, the keyword's tokens, numbers, and phrases already banned (platform or brand). | removed in ≥ 3 distinct articles, and kept in none of the ≥ 3 where it appeared | "Ban '<phrase>'?" | brand voice `bannedWords` |
| **Recurring "not" trait** | `qualitativeReview.notTraitViolations` across every `qa_completed` row | same `trait` in ≥ 3 distinct articles | "Sharpen the '<trait>' boundary", with the three excerpts | brand voice `notTraits[].boundaryNote` (operator writes the note) |
| **Recurring unbacked claim** | `evidenceCheck.claims` with `status: 'unbacked'` and `kind: 'first_party'` | the normalized excerpt (lower case, numbers kept, stopwords dropped, Jaccard ≥ 0.6 on token sets) in ≥ 2 distinct articles | "Writers keep claiming this; back it or reject it" | evidence bank: add as an *incomplete* verified claim, or as a rejected claim |
| **Rejected claim still attempted** | `evidenceCheck.claims` with `status: 'rejected'` | same `ref` in ≥ 3 distinct articles | "R<n> keeps coming back: give it a replacement line" | evidence bank `rejectedClaims[].replacement`, only when empty |

**Storage:** a new collection `setup-suggestions` (admin group "Governance"; read-only through the REST API; written by the job and actions with `overrideAccess`). Fields:

- `kind`: select over the four signals.
- `signature`: text, unique and indexed.
- `target`: select of `brand-voice` or `evidence-bank`.
- `proposal`: json, the row it would add or the field it would set.
- `occurrences`: json, `{ articleId, excerpt, at }[]`, capped at 10.
- `count`: number.
- `status`: select of `open`, `accepted`, `dismissed`, `obsolete`.
- `firstSeenAt`, `lastSeenAt`.
- `decidedBy`, `decidedAt`.

**Collection:** a Payload task `collectSetupSuggestions`, following `cms/src/jobs/publishDue.ts`.

- It runs on queue `scheduled` with a daily cron, and from a "Scan now" button.
- It reads audit rows with a `createdAt` cursor kept on a tiny global or on the newest suggestion row, so a run only looks at new history.
- It upserts by `signature`: it updates `count`, `occurrences` and `lastSeenAt`, and never reopens `dismissed` or `accepted`.
- It marks `obsolete` any `open` suggestion that the setup now satisfies (the phrase is banned, the ref has a replacement, …).

**Acting:** the actions `acceptSuggestionAction(id)` and `dismissSuggestionAction(id, reason?)`:

- **Accept** applies the change through the same code paths operators use, so hooks, gates and audit all fire:
  - **Banned word:** append to the active brand voice's `bannedWords` through the same update `saveBrandVoiceDraftAction` performs (`cms/src/components/ops/brandVoiceActions.ts:49`).
  - **Evidence:** append through `saveEvidenceBankAction` (`cms/src/components/ops/tenantActions.ts:373`), as one of two rows:
    - a verified claim with `verificationDepth: 'self_reported'` and an empty `recheckAt`. That makes it **incomplete**, so it reaches no draft until a person finishes it. This is the same rule the setup assistant follows.
    - a rejected claim with the operator's reason.
  - **"Not" trait boundary and replacement line:** never applied automatically, because their text is the operator's to write. Accept opens the relevant editor step with the excerpts shown, and the suggestion is marked `accepted` when that editor saves.
- Each decision writes a `governance-audit` row via `governanceAuditContext(user, 'setup_suggestion_accepted' | 'setup_suggestion_dismissed', summary, { suggestionId, kind, signature })`.
- Accepting moves `configFingerprint` through the asset's own `updatedAt`, as any setup edit does.

**UI:**

- A "Suggestions" panel on the setup checklist (`cms/src/components/ops/SetupChecklist.tsx` via `setupChecklistData.ts:20`), shown when any are `open`. Each row shows the suggestion, the count, up to three excerpts with links to their articles, and Accept / Dismiss.
- The same panel renders `tenant.recommendations` as plain rows with no actions, which ends their unrendered state.
- A count badge on the admin landing.

**Phase B (not planned in detail):** cluster reviewer notes (`article_sent_back`, `article_regenerate_requested` notes) with one cheap model call per scan, producing suggestions of `kind: 'reviewer_theme'` that link to the voice or audience editor. Add it only once phase A shows operators act on suggestions; track that as accepted versus dismissed counts by kind.

**Files:**
- Create the signal library, `cms/src/lib/setupSuggestions/`, as pure functions with no Payload:
  - `signals.ts`: `removedPhrases`, `recurringNotTraits`, `recurringUnbackedClaims`, `recurringRejectedRefs`
  - `ngrams.ts`
  - `signature.ts`
  - `types.ts`
- Create: `cms/src/lib/setupSuggestions/collect.ts`, the Payload-facing loader and upsert, used by the job and "Scan now".
- Create: `cms/src/collections/SetupSuggestions.ts`; register it in `cms/src/payload.config.ts`. Migration plus types.
- Create: `cms/src/jobs/collectSetupSuggestions.ts`; register it in `payload.config.ts:182-197`.
- Create: `cms/src/components/ops/suggestionActions.ts` (`'use server'`) and `cms/src/components/ops/SetupSuggestions.tsx`. Types go in a separate non-`'use server'` file.
- Modify: `cms/src/components/ops/setupChecklistData.ts`, `cms/src/components/ops/SetupChecklist.tsx`, and the admin landing (`OnboardingDashboardView`).
- Modify: `cms/tests/int/accessBoundaries.int.spec.ts`: the new collection is read-only through the API.
- Tests:
  - Create `pipeline/test/setupSuggestionSignals.test.ts` for the pure signals. Pipeline tests already import CMS libraries; see `tenantLib.test.ts`.
  - Create `cms/tests/int/setupSuggestions.int.spec.ts` for the job, upsert, actions and audit.
- Docs: a new `docs/setup-suggestions.md` covering the signals, thresholds, what Accept does, and the incomplete-evidence rule. Link it from `README.md` and `docs/tenant-context.md`.

**Interfaces:**

```ts
export type SuggestionKind = 'banned_word' | 'not_trait' | 'unbacked_claim' | 'rejected_ref'
export interface SuggestionCandidate {
  kind: SuggestionKind
  signature: string // e.g. `banned_word:${phrase}`, `unbacked_claim:${sha1(sortedTokens)}`
  target: 'brand-voice' | 'evidence-bank'
  proposal: Record<string, unknown>
  occurrences: { articleId: number; excerpt: string; at: string }[]
}
export const THRESHOLDS = { removedPhrase: 3, notTrait: 3, unbackedClaim: 2, rejectedRef: 3 } as const
```

- [ ] **Step 1: Signal tests first.** Cover:
  - **`removedPhrases`:**
    - a phrase removed in three articles is suggested
    - the same phrase kept in one of them is not
    - stopwords, keyword tokens and already-banned phrases are never suggested
    - n-grams do not span a sentence boundary
  - **`recurringNotTraits`:** groups by trait and counts distinct articles, not rows. Two QA passes on one article count once.
  - **`recurringUnbackedClaims`:** two near-identical excerpts in two articles merge; different numbers do not merge ("40 %" vs "60 %").
  - **`recurringRejectedRefs`:** counts per ref across articles.

  Run → FAIL. Implement → PASS.
- [ ] **Step 2: Collection and job.** Add the schema, migration and types, register the job, and implement `collect.ts`. Integration spec using fixture audit rows (build them with the same `context.articleAudit` shapes the pipeline writes):
  - the first scan creates `open` rows
  - a second scan with no new history changes nothing
  - new history increments `count`
  - a `dismissed` row stays dismissed
  - a satisfied suggestion becomes `obsolete`
- [ ] **Step 3: Actions.** Integration spec:
  - accepting a banned word appends exactly one row to the *active* voice, with an audit row
  - accepting an unbacked claim as verified adds an incomplete row, and `evidenceBankToPrompt` does not render it
  - accepting as rejected adds an `R` ref
  - dismiss writes audit and sets `decidedBy`
  - a non-admin user cannot act (mirror the existing access tests)
- [ ] **Step 4: UI.**
  - The panel on the checklist and the landing badge.
  - Manual check in mock mode. The mock pipeline produces identical drafts, so seed signal data with the integration helper `cms/tests/helpers/seedContentOps.ts`, or publish three mock articles after deleting a phrase by hand in `/admin/collections/articles/:id`. Then press "Scan now" → a banned-word suggestion appears → Accept → the brand voice shows the word → the next mock run's structural QA enforces it.
- [ ] **Step 5: Render `tenant.recommendations`** in the same panel; extend the checklist spec.
- [ ] **Step 6: Docs, graph, commit.**
  Message: `feat(governance): suggest setup changes from recurring review corrections`

---

## Verification for the whole plan

- `npm run typecheck`, `npm run lint`, `npm test --workspace pipeline`, and `npm run test:int --workspace cms` on a migration-built database.
- One mock-mode walkthrough after all five tasks:
  1. Seed the demo.
  2. Suggest topics for "espresso grinder" and confirm the fit ranking and the `off` group.
  3. Create a Listicle; the brief offers three angles tied to demo pains; pick one and approve.
  4. The draft is about home espresso, and its audience block shows separate "Not our user" and "Churn triggers" sections.
  5. Publish three pieces with a hand-removed phrase, scan, accept the banned word, and confirm the next run enforces it.
- `pipeline/test/statusAlignment.test.ts` still passes. No task adds a status.

## Out of scope

- Per-audience brand voice variants: one voice per workspace stays.
- Performance feedback (rankings, traffic) feeding back into suggestions. That needs a data source the product does not have yet.
- Model-scored relevance in the CLI (decision 3) and phase B reviewer-note clustering (decision 4).
