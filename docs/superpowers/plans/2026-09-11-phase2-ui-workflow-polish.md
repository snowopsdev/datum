# Phase 2: UI and workflow polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the findings in the 2026-09-11 UI and workflow audit: remove the disabled Codex integration and other dead code, give every article status an exit inside the admin, consolidate duplicate surfaces, and fix the layout, copy and docs defects.

**Architecture:** The admin is Payload CMS 3 with custom ops views under `cms/src/components/ops/` mounted from `cms/src/payload.config.ts`. Server actions in that directory call the Payload local API; readiness comes from `cms/src/lib/workspaceReadiness.ts`; runs are created only through `cms/src/lib/createPipelineRun.ts` and executed by `cms/src/jobs/contentRun.ts`, which always scopes `runPipeline` to attached article ids. Status semantics live in one table, `cms/src/lib/articleStatusMeta.ts`. Work is sliced so each task leaves the app runnable and tested.

**Tech Stack:** TypeScript, Next.js 16, Payload 3.88, Postgres, React 19, Vitest (CMS integration tests), Playwright (E2E), `node --test` via tsx (pipeline).

**Spec:** `docs/audits/2026-09-11-ui-workflow-audit.md` (findings F-xxx, consolidation proposals C-x, legacy list L-x). The plan argues from it; where the plan and the audit disagree, the audit wins.

## Global Constraints

- Node 22+, npm workspaces. Never run `npm test --workspace cms`; use `npm run test:int --workspace cms`. File-scoped: `npm run test:int --workspace cms -- tests/int/<file>.int.spec.ts`; pipeline: `npx tsx --test pipeline/test/<file>.test.ts`; lint: `npm exec --workspace cms -- eslint <file>`; typecheck: `npm run typecheck`.
- Integration tests run against `DATABASE_URL` in `cms/.env` (a migration-built database; dev push is disabled under Vitest).
- Article `status` metadata lives only in `cms/src/lib/articleStatusMeta.ts`; `pipeline/test/statusAlignment.test.ts` must keep passing.
- Every pipeline LLM call goes through `completeJSONLogged()`. `cms/src/lib/brandVoice.ts` stays dependency-free.
- After any collection or global schema change: `npm run generate:types --workspace cms`, commit `cms/src/payload-types.ts`, and add a migration under `cms/src/migrations/` (`npm run payload --workspace cms -- migrate:create <name>`).
- Preserve append-only `article-audit`, `governance-audit`, `information-gain-runs`, and the gates in `cms/src/lib/articleReviewGate.ts` (the audit asks to surface `invalidateStaleInformationGain`, not remove it).
- Mock mode is the default locally; never require a live key to run a test.
- Copy rules: no CLI command names in operator-facing UI copy (`pipeline:run` must not appear in `cms/src/components/ops/*.tsx` after Task 4). Status labels come from `STATUS_META`.
- Commits follow Conventional Commits and end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Do not edit `CHANGELOG.md`, release versions, or tags.

---

### Task 1: Remove `codex/*` end to end (L-1, L-2, F-013)

**Files:**
- Modify: `cms/src/lib/llmCatalog.ts` (delete `CODEX_MIRRORED_MODELS`, `codexMirror`, their entries in `LLM_CATALOG`)
- Modify: `cms/src/lib/llmProvider.ts` (delete `CODEX_MODEL_PREFIX`, `codexModelId`, the `codex-login` and `codex-disabled` requirement kinds, the `describeRequirement` branches; `providerForModel` returns only `anthropic` | `openai` | `unknown`)
- Delete: `cms/src/lib/codexCompletion.ts`, `cms/src/lib/codexAuth.ts`, `pipeline/src/codexCompletion.ts`, `pipeline/src/codexAuth.ts`, `pipeline/test/codexAuth.test.ts`
- Modify: `cms/src/lib/cmsLlm.ts:77-142` (remove the codex branch and comments), `cms/src/lib/workspaceReadiness.ts` (remove `needsCodexLogin`, `unsupportedModels`, the `codex-login` fingerprint branch; keep the shape of `runtime.blockers`), `cms/src/lib/loadWorkspaceReadiness.ts:191`, `cms/src/components/ops/RuntimeBanner.tsx:53-62`, `cms/src/components/ops/tenantActions.ts:621,640`, `pipeline/src/llm.ts:220-247` (delete `completeJSONCodex` and its catch), `pipeline/src/models.ts:46-50`, `pipeline/src/config.ts:46-60` (delete `codexAuthPresent`; the "may go live" test becomes: `MOCK_MODE` is false and the chosen provider key is set), `cms/src/globals/LlmSettings.ts:29` (description no longer mentions codex)
- Modify: `cms/package.json`, `pipeline/package.json` (drop `@openai/codex-sdk`), `cms/next.config.ts:20` (drop `@openai/codex-sdk` and `@openai/codex` from `serverExternalPackages`), `package-lock.json` via `npm install`
- Modify tests: `pipeline/test/llmClient.test.ts` (delete the `CodexNotLoggedInError` cases), `pipeline/test/llmProvider.test.ts:67` (delete the `codex-login` case), `pipeline/test/workspaceReadiness.test.ts:98-180,378-405` (delete the three codex cases), `cms/tests/int/cmsLlm.int.spec.ts` and `cms/tests/int/brandVoiceExtract.int.spec.ts` (delete the `CODEX_HOME` cases; keep the "mock mode never flips to live without a key" assertion by asserting on `ANTHROPIC_API_KEY` absence instead)
- Modify fixtures: any mock fixture keyed on a `codex/*` id (`grep -rn "codex/" cms/src pipeline/src`) re-keys to the `claude-*` id it mirrored
- Create: `cms/src/migrations/<timestamp>_drop_codex_model_options.ts` — Postgres cannot drop enum values, so `up()` only nulls any stored `codex/*` selection in `llm_settings` (`UPDATE llm_settings SET <col> = NULL WHERE <col> LIKE 'codex/%'` for each of the nine model columns) and `down()` is `SELECT 1` with a comment; regenerate `cms/src/payload-types.ts`
- Modify docs: `AGENTS.md:49` (delete the codex bullet), `README.md:120-124` (delete "Codex model choices"; line 51 "Legacy `codex/*` choices are mock-only" sentence), `docs/diagrams/pipeline-data-flow.html` and `.svg` caption "Anthropic · OpenAI · your Codex CLI" → "Anthropic · OpenAI"

**Interfaces:**
- Produces: `providerForModel(id): 'anthropic' | 'openai' | 'unknown'`; `requirementForModel(id): { kind: 'env'; name: string } | null`; `RuntimeReadiness` without `needsCodexLogin`/`unsupportedModels` (Task 7 reads `runtime.blockers` and `runtime.missing`).

- [ ] **Step 1: Inventory every codex reference**

Run: `grep -rni "codex" --include=*.ts --include=*.tsx --include=*.md --include=*.json --include=*.html --include=*.svg cms pipeline docs README.md AGENTS.md | grep -v node_modules | grep -v payload-types.ts | grep -v package-lock.json | grep -v e2e-reports`
Expected: the list above, plus `cms/src/migrations/20260902_210000_codex_model_options.*` (leave that migration in place; history is immutable).

- [ ] **Step 2: Write the failing tests first**

In `pipeline/test/llmProvider.test.ts` replace the codex cases with:

```ts
test('codex ids are unknown providers with no requirement', () => {
  assert.equal(providerForModel('codex/gpt-5.4'), 'unknown')
  assert.equal(requirementForModel('codex/gpt-5.4'), null)
})
```

In `cms/tests/int/llmSettings.int.spec.ts` add:

```ts
it('offers no codex/* option on any model field', () => {
  const fields = LlmSettings.fields.filter((f) => f.type === 'select')
  for (const field of fields) {
    expect(field.options.map((o) => (typeof o === 'string' ? o : o.value))).not.toContainEqual(expect.stringMatching(/^codex\//))
  }
})
```

Run both; expected: FAIL (codex ids still resolve to a codex provider; options still contain codex/*).

- [ ] **Step 3: Remove the code, dependencies and fixtures listed in Files**

Run `npm install` after editing the two `package.json` files so `package-lock.json` drops the six `@openai/codex` platform binaries.

- [ ] **Step 4: Add the migration and regenerate types**

Run: `npm run payload --workspace cms -- migrate:create drop_codex_model_options`, replace the generated body with the nine `UPDATE ... WHERE ... LIKE 'codex/%'` statements (column names from `cms/src/migrations/20260902_210000_codex_model_options.ts`), then `npm run payload --workspace cms -- migrate` and `npm run generate:types --workspace cms`.
Expected: `git diff --stat cms/src/payload-types.ts` shows only the removed `codex/*` enum members.

- [ ] **Step 5: Run the suites**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int --workspace cms -- tests/int/llmSettings.int.spec.ts tests/int/cmsLlm.int.spec.ts tests/int/brandVoiceExtract.int.spec.ts tests/int/workspaceProfile.int.spec.ts`
Expected: all pass; `grep -rni "codex" cms/src pipeline/src` returns only the 2026-09-02 migration.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove disabled codex model integration

Drops the codex/* model ids, the fail-closed completion boundary, the
login probe, the SDK dependency and every test pinned to the disabled
path. A migration nulls any stored codex selection; the enum values stay
because Postgres cannot drop them.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Delete dead routes, files, exports and unreachable branches (L-3 to L-9, L-11)

**Files:**
- Delete: `cms/src/app/my-route/route.ts`, `cms/src/components/ops/TopicDiscoveryView.tsx`, `cms/src/components/ops/ArticleBoardView.tsx`, `cms/src/app/(payload)/custom.scss`, `cms/src/components/ops/.omc/state/last-tool-error.json`, `e2e-reports/` (whole directory)
- Modify: `cms/src/payload.config.ts` (remove the two view registrations for `/ops/topics` and `/ops/articles`), `cms/src/app/(payload)/admin/importMap.js` (regenerate: `npm run payload --workspace cms -- generate:importmap`), `cms/src/app/(payload)/layout.tsx:10` (drop the `custom.scss` import), `cms/next.config.ts` (add `redirects()` returning `/admin/ops/topics → /admin/ops/new` and `/admin/ops/articles → /admin/ops/content`, both `permanent: false`), `.gitignore` (add `.omc/`)
- Modify: `cms/src/lib/brandVoice.ts:249` (delete `notTraitsOf`), `cms/src/lib/tenant/positioning.ts:21` (delete `OPEN_RULING_STATUSES`; keep `OpenRulingStatus` if it is used, else delete)
- Modify: `cms/src/components/ops/ContentRunForm.tsx` (remove the `source="onboarding"` branch and the `source` prop; the form always starts an `admin` run), `cms/src/jobs/contentRun.ts:69-91` (remove the `onboarding` source branch and `pauseForBrief: false`; `PipelineRuns.ts` `source` select loses the `onboarding` option — add a migration that maps stored `onboarding` rows to `admin` and regenerate types), `cms/src/lib/workspaceReadiness.ts:379-385` (delete `verification` from the readiness result and its `stale` fingerprint logic; delete `configFingerprint` consumers only if `verification` was their sole reader — check with grep, and if `configFingerprint` is still written to audit rows keep it)
- Modify: `cms/src/lib/articleReviewGate.ts:19-21` comment: replace the sentence claiming `ArticleReview.tsx` offers Approve at `qa_passed` with "`ArticleReview.tsx` shows a read-only 'Awaiting information gain' panel at `qa_passed`; the allow-list exists so no client can approve a draft that has not been scored."

**Interfaces:**
- Produces: `ContentRunForm` props `{ templates, mode, pipelineReady, runActive, selectedTemplateId?: number }` (Task 7 passes `selectedTemplateId`).

- [ ] **Step 1: Write the failing tests**

Add to `cms/tests/int/pipelineRun.int.spec.ts`:

```ts
it('rejects an onboarding source', async () => {
  await expect(createPipelineRun(payload, user, { ...baseInput, source: 'onboarding' as never })).rejects.toThrow()
})
```

Add `cms/tests/e2e/redirects.e2e.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
test('legacy ops routes redirect', async ({ page }) => {
  const topics = await page.goto('/admin/ops/topics')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/new')
  await page.goto('/admin/ops/articles')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/content')
  const r = await page.request.get('/my-route')
  expect(r.status()).toBe(404)
})
```

Run the int test; expected: FAIL (onboarding accepted).

- [ ] **Step 2: Make the deletions and edits in Files; regenerate the import map and types; add the `onboarding → admin` migration**

- [ ] **Step 3: Run the suites**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int --workspace cms -- tests/int/pipelineRun.int.spec.ts tests/int/workspaceProfile.int.spec.ts tests/int/tenantActions.int.spec.ts`
Expected: pass. `git ls-files | grep -c e2e-reports` prints 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead routes, unreachable run paths and tracked artifacts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: One way to queue a run, with honest errors (C-4 server half, F-023, F-033)

**Files:**
- Modify: `cms/src/components/ops/boardActions.ts` — extract the body of `runSelectedArticlesAction` after the readiness checks into an exported `queueRunForArticles(payload, user, docs, readiness): Promise<{ runId: string }>`; `runSelectedArticlesAction` calls it. Replace line 63's fixed string with `` `Finish setup before running the pipeline: ${readiness.governance.problems.join('; ')}.` ``. Replace `boardActions.ts:305-307` `catch { throw new Error('Could not load run status.') }` with `catch (error) { throw new Error(\`Could not load run status: ${errorMessage(error, 'unknown error')}\`) }`.
- Modify: `cms/src/components/ops/actions.ts` — `resetToDraftedAction` and `regenerateArticleAction` accept a third argument `options?: { queueRun?: boolean }` (default `true`); after the update they load readiness with `loadWorkspaceSetup`, and when `readiness.governance.ready && readiness.runtime.ready && readiness.mode === 'mock'` (or `options.confirmLiveCost === true` in live mode) call `queueRunForArticles` for that article. On `ActivePipelineRunError` they return `{ queued: false, reason: error.message }`; otherwise `{ queued: true, runId }`. Both keep their existing audit contexts.
- Modify: `cms/src/components/ops/contentRunActions.ts:62-65` — the generic catch returns `` { ok: false, error: `Could not start the run: ${errorMessage(error, 'unknown error')}` } `` (import `errorMessage` from `boardActions.ts` or move it to `cms/src/lib/errorMessage.ts` and import it in both).
- Modify: `cms/src/components/ops/ArticleReview.tsx:464` — `catch (error) { setError(error instanceof Error ? error.message : String(error)) }`.
- Test: `cms/tests/int/articleActions.int.spec.ts` (extend), `cms/tests/int/boardActions.int.spec.ts` (create)

**Interfaces:**
- Produces: `queueRunForArticles(payload, user, docs: Article[], readiness: WorkspaceReadiness): Promise<{ runId: string }>` exported from `boardActions.ts`; `resetToDraftedAction(id, notes?, options?) → Promise<{ queued: boolean; runId?: string; reason?: string }>`; same shape for `regenerateArticleAction(id, note?, options?)`.

- [ ] **Step 1: Write the failing tests**

In `cms/tests/int/articleActions.int.spec.ts` (it already mocks `payload`, `next/headers`, `next/cache`) add a mock for `@/lib/loadWorkspaceReadiness` returning `{ readiness: { governance: { ready: true, problems: [] }, runtime: { ready: true, blockers: [] }, mode: 'mock' }, templates: [] }` and a mock for `@/lib/createPipelineRun`'s `createPipelineRun`, then:

```ts
it('resetToDraftedAction queues a selected run for the article', async () => {
  findByIDMock.mockResolvedValueOnce({ id: 1, status: 'needs_revision', template: 3 } as never)
  const result = await resetToDraftedAction(1, 'fixed the intro')
  expect(result.queued).toBe(true)
  expect(createPipelineRunMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ source: 'selected', articleIds: [1] }))
})

it('regenerateArticleAction reports when a run is already active', async () => {
  createPipelineRunMock.mockRejectedValueOnce(new ActivePipelineRunError('A run is already active.'))
  const result = await regenerateArticleAction(1, 'tighten it')
  expect(result).toEqual({ queued: false, reason: 'A run is already active.' })
})
```

Create `cms/tests/int/boardActions.int.spec.ts` with the same mocking pattern and:

```ts
it('names every governance problem instead of assuming brand voice', async () => {
  loadWorkspaceSetupMock.mockResolvedValueOnce({ readiness: { runtime: { ready: true, blockers: [] }, governance: { ready: false, problems: ['Add an active audience', 'Set a target domain'] }, mode: 'mock' } } as never)
  const result = await runSelectedArticlesAction({ articleIds: [1] })
  expect(result).toEqual({ ok: false, error: 'Finish setup before running the pipeline: Add an active audience; Set a target domain.' })
})
```

Run: `npm run test:int --workspace cms -- tests/int/articleActions.int.spec.ts tests/int/boardActions.int.spec.ts`
Expected: FAIL.

- [ ] **Step 2: Implement the changes in Files**

- [ ] **Step 3: Run tests, typecheck, lint on the touched files**

Run: `npm run test:int --workspace cms -- tests/int/articleActions.int.spec.ts tests/int/boardActions.int.spec.ts tests/int/briefActions.int.spec.ts && npm run typecheck && npm exec --workspace cms -- eslint src/components/ops/actions.ts src/components/ops/boardActions.ts src/components/ops/contentRunActions.ts`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms): queue a run after reset and regenerate; report real errors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Run controls in the UI and honest "stalled" state (C-4 UI half, F-022, F-020, F-027, F-031)

**Files:**
- Modify: `cms/src/components/ops/ArticleReview.tsx`
  - Replace the generic "Status" block (lines 995-1016) and the `qa_passed` "Awaiting information gain" block (831-846) with one `RunNextStagePanel` rendered for every status where `isRunnableStatus(article.status)`: heading from `STAGE_LABEL[STATUS_META[status].stage]`, one sentence "Datum will `<NEXT_STAGE_FOR_STATUS[status]>` this piece on the next run." and a primary button **Run next stage** calling `runSelectedArticlesAction({ articleIds: [article.id], confirmLiveCost })`. In live mode the button first shows a one-line cost confirmation ("This calls paid providers. Continue?") with Confirm / Cancel.
  - `topic_selected`: merge "Assign template" (545) and "Start research" (582) into one panel: template select (unchanged options) plus a single button **Assign and start research** that calls `assignTemplateAction` then `runSelectedArticlesAction`; drop the SERP dump paragraph above the select (keep `researchHint` only if it is a one-line hint).
  - `published`: a "Live" panel with the public link `/articles/<slug>` and the published date; `approved` keeps its panel (Task 6 extends it).
  - Remove every literal `pipeline:run` from copy (lines 741, 823, 836): "re-enters QA on the next run", "writes a new draft on the next run".
  - Header pill: when `STATUS_META[status].owner === 'run'` and `!activeRunIncludesArticle`, show "Stalled · <label>" in the Needs-you colour instead of "Datum is working".
- Modify: `cms/src/components/ops/ArticleReviewView.tsx` — load whether an active (`queued`/`running`) `pipeline-runs` row lists this article (`where: { status: { in: ['queued','running'] }, articleIds: { contains: article.id } }` or the equivalent for how `articleIds` is stored; check `cms/src/collections/PipelineRuns.ts`) and pass `activeRunIncludesArticle: boolean` to `ArticleReview`.
- Modify: `cms/src/components/ops/ContentList.tsx` and `contentListData.ts` — rows whose status is runnable and that appear in no active run get `stalled: true` and are listed under **Needs you** with label "Stalled · <STATUS_META label>" and button **Run**; the bulk bar gains **Run selected** (calls `runSelectedArticlesAction` with the picked runnable ids) next to the existing remove control; `filter=working` shows only articles in an active run.
- Modify: `cms/src/components/ops/articleStatus.ts` — export `isStalled(status: string, inActiveRun: boolean): boolean` = `isRunnableStatus(status) && !inActiveRun`.
- Test: `cms/tests/int/articleStatus.int.spec.ts` (extend), `cms/tests/e2e/contentOps.e2e.spec.ts` (extend)

**Interfaces:**
- Consumes: `runSelectedArticlesAction`, `queueRunForArticles` (Task 3).
- Produces: `ArticleReview` prop `activeRunIncludesArticle: boolean`; `ContentList` row field `stalled: boolean`; `isStalled()`.

- [ ] **Step 1: Write the failing tests**

`cms/tests/int/articleStatus.int.spec.ts`:

```ts
it('isStalled is true for runnable statuses outside an active run', () => {
  expect(isStalled('researched', false)).toBe(true)
  expect(isStalled('researched', true)).toBe(false)
  expect(isStalled('verified', false)).toBe(false)
})
```

`cms/tests/e2e/contentOps.e2e.spec.ts` add (it already creates articles through the local API in `beforeAll`; follow that pattern to create one at `researched` with a template):

```ts
test('a stalled article can be run from the review page', async ({ page }) => {
  await page.goto(`/admin/ops/articles/${researchedId}`)
  await expect(page.getByText('Stalled')).toBeVisible()
  await page.getByRole('button', { name: 'Run next stage' }).click()
  await expect(page.getByText(/Started a run/)).toBeVisible()
})
test('no operator copy mentions the CLI', async ({ page }) => {
  await page.goto(`/admin/ops/articles/${researchedId}`)
  await expect(page.locator('main')).not.toContainText('pipeline:run')
})
```

Run the int test; expected: FAIL (`isStalled` undefined).

- [ ] **Step 2: Implement the changes in Files**

- [ ] **Step 3: Verify**

Run: `npm run test:int --workspace cms -- tests/int/articleStatus.int.spec.ts tests/int/adminPerformance.int.spec.ts && npm run typecheck && npm run lint && grep -rn "pipeline:run" cms/src/components/ops/*.tsx`
Expected: tests pass; the grep prints nothing. Then start `npm run dev` with `MOCK_MODE=true` and run `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:e2e --workspace cms -- tests/e2e/contentOps.e2e.spec.ts`; expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms): run any stalled article from the admin

Adds Run next stage on the review page for every runnable status, Run and
Run selected on the content list, and shows a piece as stalled when no
active run includes it instead of claiming Datum is working.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Surface the score-invalidation rule (F-024)

**Files:**
- Modify: `cms/src/lib/articleReviewGate.ts:345-377` — when `invalidateStaleInformationGain` demotes, set `req.context.datumAudit = { event: 'score_invalidated', summary: 'Score invalidated by an edit to <changed fields>', details: { changedFields } }` (use whatever context key `cms/src/lib/articleAudit.ts` reads; if it reads `context.auditEvent`, use that) so `auditArticleChange` writes a `score_invalidated` event rather than a bare `status_changed`. Add `'score_invalidated'` to the audit `event` select in `cms/src/collections/ArticleAudit.ts` and to `cms/src/components/ops/auditTypes.ts` with the label "Score invalidated by edit". Add a migration for the new enum value and regenerate types.
- Modify: `cms/src/collections/Articles.ts` — add `admin.description` on `title`, `body` and `keyword` (or on the collection) reading: "Editing this while the piece is verified clears its score and sends it back to Writing."
- Modify: `cms/src/components/ops/ArticleReview.tsx` — in the `RunNextStagePanel` for `drafted` (Task 4), when the newest audit event is `score_invalidated`, show a notice "Score cleared by an edit to <fields>. Run next stage to re-check and re-score." above the button.
- Test: `cms/tests/int/articleReviewGate.int.spec.ts` (extend)

**Interfaces:**
- Consumes: `RunNextStagePanel` from Task 4.

- [ ] **Step 1: Write the failing test**

In `cms/tests/int/articleReviewGate.int.spec.ts` (it boots a real Payload against the test database):

```ts
it('records score_invalidated when a verified article is edited', async () => {
  const article = await createVerifiedArticle(payload) // reuse the existing helper in this spec
  await payload.update({ collection: 'articles', id: article.id, data: { title: article.title + ' (edited)' } })
  const audits = await payload.find({ collection: 'article-audit', where: { article: { equals: article.id } }, sort: '-createdAt', limit: 1 })
  expect(audits.docs[0].event).toBe('score_invalidated')
  expect(audits.docs[0].summary).toContain('title')
  const after = await payload.findByID({ collection: 'articles', id: article.id })
  expect(after.status).toBe('drafted')
})
```

Run: `npm run test:int --workspace cms -- tests/int/articleReviewGate.int.spec.ts`; expected: FAIL (event is `status_changed`).

- [ ] **Step 2: Implement, add the migration, regenerate types**

- [ ] **Step 3: Verify**

Run: `npm run test:int --workspace cms -- tests/int/articleReviewGate.int.spec.ts tests/int/articleAudit.int.spec.ts && npm run typecheck && npm run lint`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms): record and explain score invalidation on edit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Schedule, archive, and stay on the page (F-025, F-026)

**Files:**
- Modify: `cms/src/components/ops/actions.ts` — add `scheduleArticleAction(articleId: number, publishAt: string)` (validates ISO date in the future, updates `publishAt`, audit context `publish_scheduled`), `unscheduleArticleAction(articleId)`, and `archiveArticleAction(articleId: number, reason?: string)` (sets `archived: true`, audit context `article_archived`; refuses with an Error when the article is in an active run). `approveArticleAction` and `publishArticleAction` stop redirecting; they return the updated status.
- Modify: `cms/src/components/ops/ArticleReview.tsx` — `approved` panel: **Publish now**, a date-time input with **Schedule** (shows "Scheduled for <date> · Unschedule" once set), **Send back**. Every non-`run`-owned panel gains a secondary **Archive** button with a two-click confirm (same pattern as `confirmRegenerate`). After approve/publish/schedule, refresh the page data in place (`router.refresh()`) and show the toast "Approved — publish when ready" / "Published · view it"; remove `thenBoard` navigation at line 461.
- Modify: `cms/src/components/ops/ContentList.tsx` — archived articles are excluded from every tab except a new **Archived** filter.
- Test: `cms/tests/int/articleActions.int.spec.ts` (extend)

- [ ] **Step 1: Write the failing tests**

```ts
it('scheduleArticleAction rejects a past date', async () => {
  await expect(scheduleArticleAction(1, '2020-01-01T00:00:00Z')).rejects.toThrow(/future/)
})
it('scheduleArticleAction stores publishAt with an audit context', async () => {
  findByIDMock.mockResolvedValueOnce({ id: 1, status: 'approved' } as never)
  await scheduleArticleAction(1, '2099-01-01T09:00:00Z')
  expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publishAt: '2099-01-01T09:00:00.000Z' }) }))
})
it('archiveArticleAction refuses while a run is active', async () => {
  findMock.mockResolvedValueOnce({ docs: [{ id: 9, status: 'running', articleIds: [1] }] } as never)
  await expect(archiveArticleAction(1)).rejects.toThrow(/active run/)
})
```

Run; expected: FAIL (actions undefined).

- [ ] **Step 2: Implement**

- [ ] **Step 3: Verify**

Run: `npm run test:int --workspace cms -- tests/int/articleActions.int.spec.ts tests/int/publishDue.int.spec.ts && npm run typecheck && npm run lint`, then with the dev server in mock mode: `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:e2e --workspace cms -- tests/e2e/contentOps.e2e.spec.ts` (its publish test must still pass and now remain on `/admin/ops/articles/:id`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms): schedule, archive and stay on the review page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Onboarding gates and New content readiness (F-003, F-006, F-008, F-009, F-017, F-019, F-041)

**Files:**
- Modify: `cms/src/lib/tenant/workspaceProfile.ts:152-154` — export `PLACEHOLDER_DOMAINS = new Set(['example.com', 'competitor-a.com', 'competitor-b.com'])`; the env fallback returns `null` for a target domain in that set and filters competitors in it. `cms/src/lib/workspaceReadiness.ts:305`: `profileReady` stays `targetDomain !== null` (now false for placeholders); `governance.problems` gains "Set the site Datum writes about (example.com is the placeholder from .env.example)".
- Modify: `cms/src/components/ops/SetupChecklist.tsx:84` (`checklistRows`) — add row `templates` (required; done when `templates.length > 0`; href `/admin/ops/templates`; copy "Templates · The shapes a piece can take. Seeded on install; add your own any time.") and row `models` (recommended; done when any Models field is set; href `/admin/globals/llm-settings`; copy "Models · Which model runs each step. Blank uses the platform default."). `setupChecklistData.ts` supplies `templateCount` and `modelsConfigured`.
- Modify: `cms/src/components/ops/NewContentFlow.tsx` — when `!pipelineReady`, render at the top of the card flow the same notice the gap panel shows (lines 169-174), listing `governance.problems` as links to the matching setup step, and disable the create buttons; pass `selectedTemplateId` to `ContentRunForm` (Task 2 interface) so the gap form defaults to the selected card and hides its own template select when one is selected.
- Modify: `cms/src/components/ops/AssetStepper.tsx` — the assistant box shows "No site pages fetched yet — the assistant drafts from your site. Fetch them on the Workspace step." with a link when `sitePagesFetchedAt` is null (prop supplied by the three editors from the workspace profile).
- Modify: `cms/src/components/ops/RuntimeBanner.tsx` — in live mode with missing keys the banner has no dismiss button; copy "Live providers are not configured. Runs will fail until <names> are set in cms/.env."
- Test: `cms/tests/int/workspaceProfile.int.spec.ts`, `cms/tests/int/tenantActions.int.spec.ts` or a new `cms/tests/int/setupChecklist.int.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('treats the .env.example placeholder domain as unset', () => {
  const profile = resolveWorkspaceProfile(null, { TARGET_DOMAIN: 'example.com', COMPETITOR_DOMAINS: 'competitor-a.com,real.com' }, 'live')
  expect(profile.targetDomain).toBeNull()
  expect(profile.competitors).toEqual(['real.com'])
})
it('checklist has a required templates row and a recommended models row', () => {
  const rows = checklistRows({ ...readyData, templateCount: 0, modelsConfigured: false })
  expect(rows.find((r) => r.id === 'templates')).toMatchObject({ required: true, done: false })
  expect(rows.find((r) => r.id === 'models')).toMatchObject({ required: false, done: false })
})
```

Run; expected: FAIL.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Verify**

Run: `npm run test:int --workspace cms -- tests/int/workspaceProfile.int.spec.ts tests/int/setupAssist.int.spec.ts tests/int/newContentKeyboard.int.spec.ts && npm test && npm run typecheck && npm run lint`
Expected: pass (pipeline tests cover `resolveWorkspaceProfile` too).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms): honest onboarding gates and readiness notices

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: One nav, one surface per asset, masked secret (C-1, C-2, F-001, F-002, F-014, F-015, F-016, F-034, F-035)

**Files:**
- Modify: `cms/src/components/ops/ExtraOpsNavLinks.tsx` — sections: **Content** (New content, Content, Reports), **Setup** (Setup checklist, Workspace, Audiences, Positioning, Evidence bank, Brand voice, Templates), **Governance** (Sources, Source review, Scoring policy, Models), **Settings** (Webhooks → `/admin/globals/webhook-settings`), **Records** (unchanged, collapsed).
- Modify: `cms/src/payload.config.ts` — move the brand-voice and source-review views to `/ops/setup/brand-voice` and `/ops/governance/source-review` stays; add `redirects()` entries in `cms/next.config.ts` for `/admin/ops/governance/brand-voice → /admin/ops/setup/brand-voice`. Update every internal href (`grep -rn "ops/governance/brand-voice" cms/src cms/tests README.md docs`).
- Modify: `cms/src/globals/WorkspaceProfile.ts`, `Positioning.ts`, `EvidenceBank.ts` — `admin.hidden: true` (routes stay for the ops editors' server actions). `cms/src/components/ops/BrandVoiceView.tsx:26` and `TemplateConfigEditor.tsx:442` — remove the "Open in admin" links.
- Modify: `cms/src/globals/WebhookSettings.ts:40-46` — `secret` field: `admin: { components: { Field: '/components/ops/SecretField#SecretField' } }`; create `cms/src/components/ops/SecretField.tsx` (a `type="password"` text input using `useField` from `@payloadcms/ui`, with a "Show" toggle); set `access.read` on the field so the API view returns `••••` (use Payload field-level `access.read: () => false` and a `hooks.afterRead` that returns `undefined` when reading for the admin API tab is not distinguishable — if that hides it from the ops code that needs the value, keep `read` open and only mask in the component; note the choice in the report).
- Modify: `cms/src/components/ops/ops.css` — add at the top: `@media (min-width: 1024px) and (max-width: 1440px) { .nav { transform: none; width: var(--nav-width); } .app-header { ... } }` only if Payload exposes stable class names in this version; otherwise create `cms/src/components/ops/NavOpener.tsx` (client component in `admin.components.providers`) that calls `useNav().setNavOpen(true)` once on mount when `window.innerWidth >= 1280` and no `nav` preference is stored. Prefer the component.
- Test: `cms/tests/e2e/admin.e2e.spec.ts` (extend)

- [ ] **Step 1: Write the failing E2E assertions**

```ts
test('curated nav has the four sections and links webhooks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/admin')
  const nav = page.locator('nav')
  await expect(nav.getByText('Governance')).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Webhooks' })).toHaveAttribute('href', '/admin/globals/webhook-settings')
})
test('shadowed globals are not reachable as raw forms', async ({ page }) => {
  const r = await page.goto('/admin/globals/workspace-profile')
  expect(r?.status()).toBe(404)
})
```

- [ ] **Step 2: Implement**

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run test:int --workspace cms -- tests/int/webhookDeliver.int.spec.ts tests/int/tenantActions.int.spec.ts tests/int/workspaceProfile.int.spec.ts`; then with the dev server: `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:e2e --workspace cms -- tests/e2e/admin.e2e.spec.ts tests/e2e/contentOps.e2e.spec.ts`.
Expected: pass. Confirm the ops editors still save (the tenantActions tests exercise `payload.updateGlobal`, which ignores `admin.hidden`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(cms): single navigation model and one surface per asset

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Layout, mobile and report presentation (F-004, F-005, F-010, F-012, F-030, F-036, F-037)

**Files:**
- Modify: `cms/src/components/ops/ops.css`
  - `.datum-runtime { flex-wrap: wrap; }`
  - `.datum-first` cards: `box-sizing: border-box; max-width: 100%;`
  - `.datum-ops__review-main, .datum-ops__review-aside { min-width: 0; }` and `.datum-ops__prose, .datum-ops__body { overflow-wrap: anywhere; }`
  - `.datum-ops__metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }` with a 2-column rule below 900px.
- Modify: `cms/src/components/ops/ReportsPanel.tsx` — drop the "With QA" tile (its count moves into the Articles tile subtitle "n with QA"); status and check names render through `STATUS_META[status].label`-style human labels: add `CHECK_LABEL = { structural: 'Structure', factCheck: 'Fact check', qualitative: 'Qualitative review', evidence: 'Evidence' }` in `articleStatus.ts` and use `STAGE_LABEL`/`STATUS_META` for statuses; replace the `<code>informationGain</code>` sentence with plain prose.
- Modify: `cms/src/components/ops/AssetStepper.tsx:136,203` — remove the "step n of m" pill; `Refine with AI` is `disabled` when the current section's fields are all empty (the editors already know their section values; pass `sectionHasContent: boolean`); the assistant explanation renders only on step 1 and as a tooltip title elsewhere.
- Modify: `cms/src/components/ops/BrandVoiceEditor.tsx:503-505` — wrap the two "Replace this voice" cards in `<details><summary>Replace this voice</summary>` when a voice is active.
- Test: a Playwright overflow check in `cms/tests/e2e/adminPerformance.e2e.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

```ts
test('no horizontal overflow at 390px on the key screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/admin/ops/setup', '/admin/ops/content', `/admin/ops/articles/${articleId}`]) {
    await page.goto(path)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(w, path).toBeLessThanOrEqual(390)
  }
})
```

Run against the dev server; expected: FAIL on the article page (800px).

- [ ] **Step 2: Implement**

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck && npm run test:int --workspace cms -- tests/int/opsKpis.int.spec.ts` and the E2E test above; expected: pass. Capture `DESKTOP_W=1440 node docs/audits/capture.mjs /tmp/recheck` and confirm `capture-log.json` shows `hOverflow: false` for every mobile row.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(cms): mobile overflow, report labels and setup editor polish

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Split the review page into per-status panels (C-5, F-028, F-029)

**Files:**
- Create: `cms/src/components/ops/review/` with `ReviewHeader.tsx` (title, subtitle, stepper, owner pill), `ArticleBody.tsx`, `SeoResearch.tsx`, `QaTriage.tsx`, `EvidenceCard.tsx`, `Scorecard.tsx` (the information-gain tiles, disclaimer and claims table, collapsed by default behind a "Show scorecard" disclosure; the decision line and policy reasons render open), `AuditTrail.tsx` (groups `model_call_completed` rows by `pipelineRunId` into one collapsible row "run <id8> · <n> calls · $<cost>"; user and status events stay top-level), and one panel per status under `review/panels/`: `TopicSelectedPanel.tsx`, `BriefPanel.tsx` (wraps `BriefEditor`), `RunNextStagePanel.tsx` (from Task 4; used for `researched`, `drafted`, `qa_passed`), `NeedsRevisionPanel.tsx`, `VerifiedPanel.tsx`, `ReviewDecisionPanel.tsx` (`needs_review`, `blocked`), `ApprovedPanel.tsx`, `PublishedPanel.tsx`. `review/index.ts` exports `PANEL_FOR_STATUS: Record<ArticleStatus, React.ComponentType<PanelProps>>`.
- Modify: `cms/src/components/ops/ArticleReview.tsx` shrinks to composition: header, body, SEO, QA, scorecard, `PANEL_FOR_STATUS[article.status]`, audit trail. Target under 200 lines. Shared action-runner hook `useReviewAction` (busy flag, error, `router.refresh()`) lives in `review/useReviewAction.ts`.
- Modify: `cms/src/lib/reportQueries.ts:3` — move `CostReport` and `SpendRow` types to `cms/src/lib/reportTypes.ts`; `ReportsPanel.tsx` and `reportQueries.ts` import from there.
- Test: `cms/tests/int/informationGainRunView.int.spec.ts` and `cms/tests/int/runBar.int.spec.ts` keep passing; add `cms/tests/int/reviewPanels.int.spec.ts`:

```ts
it('maps every article status to exactly one panel', () => {
  for (const status of ARTICLE_STATUSES) expect(PANEL_FOR_STATUS[status]).toBeTypeOf('function')
})
it('groups model calls per run in the audit trail', () => {
  const rows = groupAuditEvents([call('r1'), call('r1'), statusChange(), call('r2')])
  expect(rows.map((r) => r.kind)).toEqual(['run', 'status', 'run'])
  expect(rows[0]).toMatchObject({ runId: 'r1', calls: 2 })
})
```

- [ ] **Step 1: Write the failing tests above** — run; expected: FAIL (modules missing).
- [ ] **Step 2: Move code into the new files without changing behaviour; keep every `data-testid` and visible label the E2E specs use** (`grep -n "getByRole\|getByText\|getByTestId" cms/tests/e2e/*.ts` lists them).
- [ ] **Step 3: Verify** — `npm run typecheck && npm run lint && npm run test:int --workspace cms -- tests/int/reviewPanels.int.spec.ts tests/int/informationGainRunView.int.spec.ts tests/int/runBar.int.spec.ts tests/int/adminPerformance.int.spec.ts`, then the two E2E specs `contentOps` and `adminPerformance` against the dev server. `wc -l cms/src/components/ops/ArticleReview.tsx` under 200.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(cms): split the review page into per-status panels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Port brand voice to the shared setup editor pattern (C-3, F-011)

**Files:**
- Modify: `cms/src/components/ops/BrandVoiceEditor.tsx`, `brandVoiceSections.tsx` — replace the horizontal tab shell and the private `Field`/rows helpers with `AssetStepper` and `setupFields.tsx` primitives; the nine onboarding steps become the stepper's steps (order and copy from `STEPS` in `cms/src/lib/brandVoice.ts`); the "Guide" and "History" tabs become the last two steps ("Export guide", "History"). Save/Activate/Archive sit on the stepper footer like `IcpEditor`. Upload-and-extract and "Start onboarding" remain the entry cards for a workspace with no voice.
- Rename: `cms/src/components/ops/Stepper.tsx` → `PipelineStepper.tsx` (export `PipelineStepper`), update its two importers.
- Delete: the duplicated `Field`, `RowsEditor` (or equivalently named) components in `brandVoiceSections.tsx`; `setupFields.tsx` header comment updated to drop the "grew its own copies" note.
- Test: `cms/tests/int/brandVoice.int.spec.ts` keeps passing; extend `cms/tests/e2e/admin.e2e.spec.ts` "each setup editor renders" loop to assert the brand-voice page renders the stepper rail (`getByRole('list', { name: /steps/i })` or the `AssetStepper` `data-testid` used by audiences).

- [ ] **Step 1: Add the failing E2E assertion**; run against the dev server; expected: FAIL.
- [ ] **Step 2: Implement** (activation gate `brandVoiceActivationProblems()` unchanged; the "Review & activate" step lists its problems inline before the Activate button).
- [ ] **Step 3: Verify** — `npm run typecheck && npm run lint && npm run test:int --workspace cms -- tests/int/brandVoice.int.spec.ts tests/int/brandVoiceExtract.int.spec.ts tests/int/tenantActions.int.spec.ts` and the admin E2E spec. `grep -c "function Field" cms/src/components/ops/brandVoiceSections.tsx` prints 0.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(cms): brand voice editor on the shared setup stepper

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Save-and-activate for audiences, one cost aggregation (F-007, C-6)

**Files:**
- Modify: `cms/src/components/ops/tenantActions.ts` — add `saveAndActivateIcpAction(id: number | null, data: IcpInput, options: { makePrimary: boolean })` that creates or updates, then activates, then sets primary when asked, in one server action with one audit context each; returns the saved audience. `IcpEditor.tsx`: footer buttons become **Save** (all steps) and, on the last step, **Save and activate** with a "Make this the primary audience" checkbox (checked and disabled when no other audience is active); **Archive** unchanged.
- Modify: `cms/src/lib/opsKpis.ts` — `stageKpis(rows)` is the reducer; add `stageKpisSql()` returning the equivalent Drizzle/SQL fragment used by `reportQueries.ts:13-40`. `cms/src/components/ops/boardActions.ts:266-275` and `pipeline/src/report.ts:185-191` call `stageKpis`.
- Test: `cms/tests/int/icps.int.spec.ts`, `cms/tests/int/opsKpis.int.spec.ts`, `pipeline/test/report.test.ts` (if present; otherwise `cms/tests/int/pipelineReportCli.int.spec.ts`)

- [ ] **Step 1: Write the failing tests**

```ts
it('saveAndActivateIcpAction activates and marks primary in one call', async () => {
  const saved = await saveAndActivateIcpAction(null, validIcpInput, { makePrimary: true })
  expect(saved.status).toBe('active')
  expect(saved.primary).toBe(true)
})
it('boardActions and the CLI report use stageKpis', () => {
  const src = fs.readFileSync('src/components/ops/boardActions.ts', 'utf8')
  expect(src).toContain('stageKpis(')
})
```

- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify** — `npm run test:int --workspace cms -- tests/int/icps.int.spec.ts tests/int/opsKpis.int.spec.ts tests/int/pipelineReportCli.int.spec.ts && npm test && npm run typecheck && npm run lint`
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms): save-and-activate audiences; one cost aggregation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Docs, env examples and public site (2D: F-038, F-039, F-040, C-7 docs half, L-11 docs)

**Files:**
- Modify: `README.md` — line 118 points at `/admin/ops/setup/workspace`; the "both env files" paragraph (line 128) documents `DISABLE_DEV_PUSH`, `TEST_BASE_URL`, `TEST_PORT` in a "Test-only variables" table row group; update the nav description in "Setup and governance" (lines 45-54) to the four sections from Task 8.
- Modify: `docs/information-gain.md:162,168,221` — "Governance → Evidence sources" stays correct after Task 8; "Governance → Source review" stays; "Governance → Information-gain policy" → "Governance → Scoring policy".
- Modify: `.env.example`, `cms/.env.example` — add a `# Test-only` block (`DISABLE_DEV_PUSH`, `TEST_BASE_URL`, `TEST_PORT`) to the root file; the cms file keeps its warning but lists the exact keys the admin reads at request time (`MOCK_MODE`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AHREFS_API_KEY`, `AHREFS_COUNTRY`, `TARGET_DOMAIN`, `COMPETITOR_DOMAINS`, `PIPELINE_MODEL_*`, `BRAND_VOICE_EXTRACT_MODEL`, `SETUP_ASSIST_MODEL`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, `SITE_URL`).
- Modify: `cms/src/app/(frontend)/page.tsx:32,42` — header links: "Admin" only, pointing at `/admin/ops/content`; subtitle from the workspace profile's company name ("Articles from <companyName>") with "Published articles" as the fallback.
- Modify: `cms/src/app/(frontend)/articles/[slug]/page.tsx:65` — render the template's FAQ heading only when the body's last H2 is not already "FAQ" (compare the trimmed heading text case-insensitively); when it is, render the FAQ items directly under the body's heading.
- Test: `cms/tests/e2e/frontend.e2e.spec.ts` (extend)

- [ ] **Step 1: Write the failing E2E test**

```ts
test('article page renders one FAQ heading', async ({ page }) => {
  await page.goto(`/articles/${publishedSlug}`)
  await expect(page.getByRole('heading', { level: 2, name: 'FAQ' })).toHaveCount(1)
})
test('public header has no stale admin link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Article board' })).toHaveCount(0)
})
```

- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify** — `npm run lint && npm run typecheck`, the frontend E2E spec against the dev server, and `grep -rn "ops/articles\"" cms/src/app` prints nothing.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: align README, env examples and public site with the admin

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- Spec coverage: F-001/2/3/4/5/6/7/8/9/10/11/12/13/14/15/16/17/19/20/22/23/24/25/26/27/28/29/30/31/32(removed via Task 8 link removal and Task 6 controls)/33/34/35/36/37/38/39/40/41, C-1..C-7 (C-7 code half — one env loader — is deliberately deferred: it changes how Next loads env and is a separate decision; the docs half is Task 13), L-1..L-11 all have a task. F-018 is retracted. F-021 (per-article run status) is covered by Task 4's `activeRunIncludesArticle`.
- Type consistency: `queueRunForArticles` (Task 3) is consumed by Task 4 and Task 6 names match; `RunNextStagePanel` is introduced in Task 4 and moved in Task 10; `isStalled` defined in Task 4 and used by Task 10's panels; `selectedTemplateId` defined in Task 2 and used in Task 7.
- Ordering: 1 → 2 (both delete-only), 3 → 4 → 5/6 (review page), 7 (independent), 8 → 9 (layout after nav), 10 after 4/5/6 (moves their panels), 11 and 12 independent, 13 last (docs reflect final nav).
