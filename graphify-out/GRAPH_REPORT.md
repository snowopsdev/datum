# Graph Report - datum  (2026-10-06)

## Corpus Check
- 395 files · ~1,003,116 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 7, .css 3, .example 2)

## Summary
- 2885 nodes · 7371 edges · 110 communities (100 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 250 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `871ec9c1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- passes.ts
- evidenceBank.int.spec.ts
- setupActions.ts
- payload-types.ts
- scorecard.ts
- igPolicy.test.ts
- llmCatalog.ts
- exactness.ts
- lib/brandVoice.ts
- igCoverage.test.ts
- pipeline/package.json
- Field
- payload.config.ts
- BrandVoiceView.tsx
- next
- webhookDeliver.int.spec.ts
- stages.ts
- lib/llmProvider.ts
- graphqlSchema.int.spec.ts
- ref_payload
- src/index.ts
- llmSettings.ts
- DESIGN.md
- Quick start
- ref_node_test
- seedContentOps.ts
- [slug]/page.tsx
- tenantActions.ts
- auditTypes.ts
- icp.ts
- GlobalRunBar.tsx
- ref_node_assert
- assist.ts
- tenantActions.int.spec.ts
- tenant.ts
- richtext.ts
- qa/index.ts
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- brandVoiceTypes.ts
- evidenceBank.test.ts
- parsers.ts
- react
- evidenceBank.ts
- workspaceReadiness.ts
- igCandidates.test.ts
- resolveWorkspaceProfile
- fetchPage.ts
- EvidenceBankEditor.tsx
- tenantLib.test.ts
- package.json
- sourceReviewActions.ts
- activeRuns.ts
- compilerOptions
- sourceReviewTypes.ts
- topicDiscoveryActions.ts
- icps.int.spec.ts
- briefActions.ts
- tenant/fixtures.ts
- llm.ts
- dependencies
- boardActions.ts
- ArticleReview.tsx
- Findings
- devDependencies
- ReportsPanel.tsx
- extractText.ts
- scripts
- reviewPanels.int.spec.ts
- EvidenceBank.ts
- brandVoiceExtract.ts
- igText.test.ts
- compilerOptions
- Datum
- lib/informationGain/index.ts
- src/informationGain/candidates.ts
- generatePrompt.ts
- governanceAudit.ts
- Contributor Covenant Code of Conduct
- BrandVoiceEditor.tsx
- lib/informationGain/candidates.ts
- checkEvidenceRefs
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- README.md
- informationGainRuns.int.spec.ts
- ig-e2e.sh
- Operations
- [...slug]/route.ts
- corpusSnapshots.int.spec.ts
- @payloadcms/db-postgres
- Brand voice and style guide
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- Security Policy
- eslint.config.mjs
- repository
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- bugs
- engines
- pnpm
- InformationGainPolicy.ts

## God Nodes (most connected - your core abstractions)
1. `react` - 81 edges
2. `vitest` - 61 edges
3. `next` - 54 edges
4. `resolveWorkspaceProfile()` - 45 edges
5. `loadWorkspaceSetup()` - 32 edges
6. `Field()` - 31 edges
7. `Article` - 29 edges
8. `@payloadcms/db-postgres` - 22 edges
9. `@payloadcms/next` - 22 edges
10. `getOrBuildSnapshot()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Setup asset editors` --references--> `AssetStepper()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/AssetStepper.tsx
- `Onboarding` --references--> `checklistRows()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/SetupChecklist.tsx
- `Content list` --references--> `latestRunAction()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/boardActions.ts
- `Webhooks` --references--> `verifyWebhookSignature()`  [INFERRED]
  docs/operations.md → cms/src/jobs/webhookDeliver.ts
- `Task 1: Remove `codex/*` end to end (L-1, L-2, F-013)` --references--> `providerForModel()`  [INFERRED]
  docs/superpowers/plans/2026-09-11-phase2-ui-workflow-polish.md → cms/src/lib/llmProvider.ts

## Import Cycles
- None detected.

## Communities (110 total, 10 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.05
Nodes (55): ArticleReviewView(), asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf() (+47 more)

### Community 1 - "passes.ts"
Cohesion: 0.05
Nodes (55): DEFAULT_MAX_DRAFT_CLAIMS, DEFAULT_POLICY, CLAIM_TYPES, DraftClaim, Facet, QueryClusterEntry, Claims nobody checked, Cost (+47 more)

### Community 2 - "evidenceBank.int.spec.ts"
Cohesion: 0.24
Nodes (6): EvidenceBank, clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh()

### Community 3 - "setupActions.ts"
Cohesion: 0.05
Nodes (49): asRecord(), AssetStep, AssetStepper(), AssistConfig, Props, assistAction(), assistError(), AssistInput (+41 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (56): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+48 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.04
Nodes (54): internalDuplicationRate(), JudgeSignals, VerifierSignals, clamp01(), clampImportance(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD (+46 more)

### Community 6 - "igPolicy.test.ts"
Cohesion: 0.07
Nodes (36): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), InformationGainPolicy (+28 more)

### Community 7 - "llmCatalog.ts"
Cohesion: 0.18
Nodes (12): catalogModel(), DEFAULT_MODEL, LLM_CATALOG, LLM_MODEL_OPTIONS, LlmModel, money(), PROVIDER_LABEL, LlmProvider (+4 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (38): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+30 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.08
Nodes (40): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), BrandVoiceGuide(), downloadMarkdown() (+32 more)

### Community 10 - "igCoverage.test.ts"
Cohesion: 0.21
Nodes (7): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf()

### Community 11 - "pipeline/package.json"
Cohesion: 0.05
Nodes (42): bugs, url, dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai (+34 more)

### Community 12 - "Field"
Cohesion: 0.10
Nodes (37): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SECTION_COMPONENTS, SectionProps (+29 more)

### Community 13 - "payload.config.ts"
Cohesion: 0.07
Nodes (17): dirname, __filename, nextConfig, BrandVoiceFiles, Media, PipelineRuns, Templates, TopicSearches (+9 more)

### Community 14 - "BrandVoiceView.tsx"
Cohesion: 0.24
Nodes (10): BrandVoiceAuditEntry, BrandVoiceMode, BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), brandVoiceContentOf() (+2 more)

### Community 15 - "next"
Cohesion: 0.07
Nodes (35): importMap, Args, Args, GET, OPTIONS, POST, Args, ExtraOpsNavLinks() (+27 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (26): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+18 more)

### Community 17 - "stages.ts"
Cohesion: 0.06
Nodes (32): PipelineStageName, stripEvidenceRefs(), Article, repoRoot, InternalCorpusDoc, EvidenceCitation, extractEvidenceCitations(), GeneratedArticle (+24 more)

### Community 18 - "lib/llmProvider.ts"
Cohesion: 0.51
Nodes (7): apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement, requirementForModel()

### Community 20 - "ref_payload"
Cohesion: 0.08
Nodes (23): StartContentRunInput, StartContentRunResult, ActivePipelineRunError, createPipelineRun(), CreatePipelineRunInput, IcpOption, PipelineRunSummary, relationshipIds() (+15 more)

### Community 21 - "src/index.ts"
Cohesion: 0.10
Nodes (30): executeContentRun(), safeError(), articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], FetchContext (+22 more)

### Community 22 - "llmSettings.ts"
Cohesion: 0.16
Nodes (18): LlmSettings, clean(), EXTRACTION_ENV_VAR, LLM_SETTING_FIELDS, llmSettingsConfigured(), LlmSettingsDoc, ModelSource, PIPELINE_STAGES (+10 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "Quick start"
Cohesion: 0.50
Nodes (4): First run and making content, Pipeline mock mode, Quick start, Seeded local admin

### Community 25 - "ref_node_test"
Cohesion: 0.14
Nodes (17): stageKpis(), CostLog, articleIdOf(), IG_DECISIONS, meanOf(), PassCounter, printReport(), rate() (+9 more)

### Community 26 - "seedContentOps.ts"
Cohesion: 0.14
Nodes (22): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+14 more)

### Community 27 - "[slug]/page.tsx"
Cohesion: 0.09
Nodes (28): generateMetadata(), Props, PublishedArticlePage(), revalidate, metadata, metadataBase, createTemplateAction(), requireUser() (+20 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.10
Nodes (42): CascadeContext, gateIcpActivation(), IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), ICP_STEPS, IcpDTO (+34 more)

### Community 29 - "auditTypes.ts"
Cohesion: 0.12
Nodes (21): ArticleAudit, CostLog, auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, auditEventLabel() (+13 more)

### Community 30 - "icp.ts"
Cohesion: 0.14
Nodes (26): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf(), confidenceTag() (+18 more)

### Community 31 - "GlobalRunBar.tsx"
Cohesion: 0.11
Nodes (20): CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO, STAGE_PROGRESS (+12 more)

### Community 32 - "ref_node_assert"
Cohesion: 0.24
Nodes (4): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT

### Community 33 - "assist.ts"
Cohesion: 0.09
Nodes (40): applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS, AssistMode (+32 more)

### Community 34 - "tenantActions.int.spec.ts"
Cohesion: 0.05
Nodes (26): GovernanceAudit, authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createRunMock (+18 more)

### Community 35 - "tenant.ts"
Cohesion: 0.07
Nodes (19): AhrefsClient, AhrefsClientOptions, AhrefsProfile, createAhrefsClient(), GapKeyword, MatchingTermRow, MockAhrefsClient, opportunityScore() (+11 more)

### Community 36 - "richtext.ts"
Cohesion: 0.12
Nodes (26): Template, bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks() (+18 more)

### Community 37 - "qa/index.ts"
Cohesion: 0.10
Nodes (21): qaStage, CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision (+13 more)

### Community 38 - "actions.ts"
Cohesion: 0.18
Nodes (28): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+20 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.11
Nodes (37): parsePageClaims(), excerptFoundIn(), selectInternalCorpus(), BaselineClaim, InformationGap, CorpusSnapshot, Baseline claims and facets, Corpus snapshots (+29 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (24): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+16 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.12
Nodes (24): Articles, scoreInvalidatedSummary(), ArticleAuditContext, CLEARED_INFORMATION_GAIN, freshJustification(), gateArchivedStatus(), gateReadOnlyStatus(), gateReviewOverride() (+16 more)

### Community 43 - "brandVoiceTypes.ts"
Cohesion: 0.11
Nodes (18): AuditTimelineEntry, Props, BRAND_VOICE_STEPS, BrandVoiceDTO, BrandVoiceInput, BrandVoiceSource, BrandVoiceStatus, BrandVoiceStepId (+10 more)

### Community 44 - "evidenceBank.test.ts"
Cohesion: 0.10
Nodes (10): claimProblems(), evidenceBankSummary, expiredClaims(), incompleteClaims(), isClaimComplete(), MAX_PROMPT_CLAIMS, neverUseClaims(), verifiedClaimProblems() (+2 more)

### Community 45 - "parsers.ts"
Cohesion: 0.09
Nodes (35): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+27 more)

### Community 46 - "react"
Cohesion: 0.23
Nodes (19): evidenceFindingsOf(), ArchiveAction(), OpenInAdmin(), EvidenceCard(), PANEL_FOR_STATUS, ArchivedPanel(), BriefPanel(), IgReasonsAside() (+11 more)

### Community 47 - "evidenceBank.ts"
Cohesion: 0.19
Nodes (20): asArray(), asDay(), asRecord(), asString(), depthOf(), emptyEvidenceBankContent(), evidenceBankToPrompt(), EvidenceRefCheck (+12 more)

### Community 48 - "workspaceReadiness.ts"
Cohesion: 0.09
Nodes (32): HomePage(), AssistContext, EvidenceBankContent, IcpContent, icpIdOf(), selectIcp(), TenantContext, tenantFingerprint() (+24 more)

### Community 50 - "resolveWorkspaceProfile"
Cohesion: 0.17
Nodes (16): emptyTenantContext(), resolveWorkspaceProfile(), LlmRequest, loadWorkspaceProfile(), namedOnly(), tenantFor(), withBank(), ctxWith() (+8 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.05
Nodes (52): normaliseWhitespace(), RFC-1918, Mock mode, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname() (+44 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.12
Nodes (21): AssistPanel(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankView() (+13 more)

### Community 53 - "tenantLib.test.ts"
Cohesion: 0.09
Nodes (24): hasSectionContent(), PositioningEditor(), SECTION_KEYS, PositioningView(), loadAssistContext(), upsertPositioning(), icpsFromDocs(), asArray() (+16 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewActions.ts"
Cohesion: 0.17
Nodes (18): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), errorMessage(), governanceAuditContext(), isQualityClass(), reopenCandidateAction() (+10 more)

### Community 57 - "activeRuns.ts"
Cohesion: 0.43
Nodes (4): ACTIVE_RUN_STATUSES, activeRunArticleIds(), activeRunIncludesArticle(), Self-review

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "sourceReviewTypes.ts"
Cohesion: 0.15
Nodes (14): ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES, num() (+6 more)

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.09
Nodes (35): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+27 more)

### Community 63 - "icps.int.spec.ts"
Cohesion: 0.11
Nodes (16): Icps, create(), createdArticleIds, createdIds, icpData(), read(), Shared code graph, Global Constraints (+8 more)

### Community 64 - "briefActions.ts"
Cohesion: 0.44
Nodes (11): actorOf(), approveBriefAction(), BriefActionResult, cleanEdits(), errorMessage(), icpIdOf(), requireUser(), resolveAudience() (+3 more)

### Community 65 - "tenant/fixtures.ts"
Cohesion: 0.07
Nodes (34): AssistInput, ASSIST_MOCK_WARNING, assistMock(), FIXTURE_CONTENT, CONFIDENCE_LEVELS, EVIDENCE_BANK_FIXTURE, ICP_FIXTURE, ICP_FIXTURE_SECONDARY (+26 more)

### Community 66 - "llm.ts"
Cohesion: 0.10
Nodes (28): PipelineStage, costUsd(), ModelReadiness, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture (+20 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "boardActions.ts"
Cohesion: 0.09
Nodes (36): queueRunAfterRework(), BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), requireUser(), runSelectedArticlesAction(), toRunFailures() (+28 more)

### Community 69 - "ArticleReview.tsx"
Cohesion: 0.17
Nodes (18): ArticleReview(), Props, BoardArticle, TemplateOption, BriefEdits, BriefEditor(), BriefIcpOption, Props (+10 more)

### Community 71 - "Findings"
Cohesion: 0.10
Nodes (21): qaFailures(), CheckRow(), QaFailures(), QaTriage(), sourceLabel(), Consolidation proposals, Content list, Findings (+13 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.07
Nodes (32): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+24 more)

### Community 74 - "extractText.ts"
Cohesion: 0.15
Nodes (11): docxToText(), ExtractedKind, ExtractedText, hideArrayPrototypePollution(), MAX_EXTRACT_CHARS, MIME_KINDS, normalise(), pdfToText() (+3 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "reviewPanels.int.spec.ts"
Cohesion: 0.19
Nodes (15): InformationGainRunView, AuditSummary, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+7 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.22
Nodes (16): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), highestRefIn(), idOf(), Prefix, REF_FIELD (+8 more)

### Community 78 - "brandVoiceExtract.ts"
Cohesion: 0.12
Nodes (22): BrandVoiceContent, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), ExtractionResult, logExtractionCost() (+14 more)

### Community 80 - "igText.test.ts"
Cohesion: 0.20
Nodes (4): keywordTokens(), nearDuplicateJaccard(), STOPWORDS, tokenOverlap()

### Community 81 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+6 more)

### Community 82 - "Datum"
Cohesion: 0.15
Nodes (13): Article status flow, Datum, Documentation, Environment variables, License, Pipeline and data integration, Prerequisites, Root scripts (+5 more)

### Community 83 - "lib/informationGain/index.ts"
Cohesion: 0.27
Nodes (4): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES

### Community 84 - "src/informationGain/candidates.ts"
Cohesion: 0.24
Nodes (7): suggestClass(), isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), Call

### Community 85 - "generatePrompt.ts"
Cohesion: 0.08
Nodes (26): brandVoiceSamplesToPrompt(), evidenceRules(), Gap-fed generation, BriefDraft, BriefSection, BriefSectionSource, buildBrief(), clean() (+18 more)

### Community 89 - "governanceAudit.ts"
Cohesion: 0.14
Nodes (18): GovernanceAudit, WorkspaceProfile, auditArticleChange(), AuditRequestContext, auditActor(), changedFieldsOf(), humanize(), auditGlobalChange() (+10 more)

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 94 - "BrandVoiceEditor.tsx"
Cohesion: 0.17
Nodes (26): AuditTimeline(), activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), errorMessage(), extractBrandVoiceFromUploadAction(), governanceAuditContext() (+18 more)

### Community 96 - "lib/informationGain/candidates.ts"
Cohesion: 0.15
Nodes (18): CANDIDATE_RANK, CandidateClass, CandidateKind, CandidateSighting, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings() (+10 more)

### Community 97 - "checkEvidenceRefs"
Cohesion: 0.20
Nodes (11): checkEvidenceRefs(), cleared(), expired(), usableClaims(), Evidence bank, Expiry, Information gain, Prompt size (+3 more)

### Community 98 - "Contributing to Datum"
Cohesion: 0.20
Nodes (10): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+2 more)

### Community 99 - "open-source-checklist.md"
Cohesion: 0.20
Nodes (9): 1. Settings → General → Danger Zone → Change visibility → Public, 2. Settings → General → Features → enable Issues (and Discussions if desired), 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting, 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`, 5. Confirm SECURITY.md and advisories link work for the public repo, 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public, Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo., Complete these in the GitHub UI after merging open-source readiness changes: (+1 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 105 - "ig-e2e.sh"
Cohesion: 0.42
Nodes (8): assert_eq(), assert_ge(), assert_ne(), info(), log(), ig-e2e.sh script, probe(), value_of()

### Community 107 - "Operations"
Cohesion: 0.25
Nodes (7): Cache and revalidation, Fixed limits worth knowing, Job queues, Modes and money, Operations, Scheduled publishing, Webhooks

### Community 108 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 109 - "corpusSnapshots.int.spec.ts"
Cohesion: 0.33
Nodes (4): CorpusSnapshots, internalCorpusSubfields, pagesSubfields, topLevelFields

### Community 112 - "@payloadcms/db-postgres"
Cohesion: 0.05
Nodes (3): up(), migrations, @payloadcms/db-postgres

### Community 114 - "Brand voice and style guide"
Cohesion: 0.33
Nodes (6): Banned phrases, Brand voice and style guide, Formatting conventions, Structure, Voice, Words we prefer

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 118 - "Security Policy"
Cohesion: 0.40
Nodes (4): Non-security bugs, Reporting a vulnerability, Security Policy, Supported versions

### Community 119 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 141 - "InformationGainPolicy.ts"
Cohesion: 0.24
Nodes (7): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS, PolicyFieldDef

## Knowledge Gaps
- **794 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+789 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1061 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `articleStatus.ts`, `setupActions.ts`, `payload.config.ts`, `BrandVoiceView.tsx`, `ref_payload`, `[slug]/page.tsx`, `tenantActions.ts`, `auditTypes.ts`, `GlobalRunBar.tsx`, `actions.ts`, `cms/package.json`, `react`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `tenantLib.test.ts`, `sourceReviewActions.ts`, `sourceReviewTypes.ts`, `topicDiscoveryActions.ts`, `briefActions.ts`, `boardActions.ts`, `ArticleReview.tsx`, `ReportsPanel.tsx`, `BrandVoiceEditor.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _794 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05403348554033485 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `articleStatus.ts`, `setupActions.ts`, `lib/brandVoice.ts`, `Field`, `BrandVoiceView.tsx`, `next`, `[slug]/page.tsx`, `tenantActions.ts`, `auditTypes.ts`, `icp.ts`, `GlobalRunBar.tsx`, `actions.ts`, `cms/package.json`, `brandVoiceTypes.ts`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `tenantLib.test.ts`, `sourceReviewActions.ts`, `sourceReviewTypes.ts`, `topicDiscoveryActions.ts`, `boardActions.ts`, `ArticleReview.tsx`, `Findings`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `BrandVoiceEditor.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `passes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05136986301369863 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ref_payload` to `articleStatus.ts`, `evidenceBank.int.spec.ts`, `setupActions.ts`, `lib/brandVoice.ts`, `payload.config.ts`, `InformationGainPolicy.ts`, `next`, `webhookDeliver.int.spec.ts`, `graphqlSchema.int.spec.ts`, `llmSettings.ts`, `[slug]/page.tsx`, `auditTypes.ts`, `GlobalRunBar.tsx`, `tenantActions.int.spec.ts`, `cms/package.json`, `articleReviewGate.ts`, `brandVoiceTypes.ts`, `EvidenceBankEditor.tsx`, `activeRuns.ts`, `sourceReviewTypes.ts`, `topicDiscoveryActions.ts`, `icps.int.spec.ts`, `tenant/fixtures.ts`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `brandVoiceExtract.ts`, `lib/informationGain/index.ts`, `governanceAudit.ts`, `informationGainRuns.int.spec.ts`, `corpusSnapshots.int.spec.ts`, `@payloadcms/db-postgres`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `setupActions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.053555750658472345 - nodes in this community are weakly interconnected._