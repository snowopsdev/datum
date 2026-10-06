# Graph Report - datum  (2026-10-06)

## Corpus Check
- 390 files · ~1,002,552 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 7, .css 3, .example 2)

## Summary
- 2875 nodes · 7337 edges · 149 communities (123 shown, 26 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 247 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5d8ebdcc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- passes.ts
- tenant.ts
- setupActions.ts
- payload-types.ts
- scorecard.ts
- informationGain/types.ts
- tenant/fixtures.ts
- exactness.ts
- lib/brandVoice.ts
- generatePrompt.ts
- pipeline/package.json
- Field
- payload.config.ts
- fetchPage.ts
- ref_payload
- webhookDeliver.int.spec.ts
- stages.ts
- workspaceReadiness.ts
- igScoring.test.ts
- boardActions.ts
- src/index.ts
- loadWorkspaceReadiness.ts
- DESIGN.md
- ReportsPanel.tsx
- report.ts
- seedContentOps.ts
- [slug]/page.tsx
- tenantActions.ts
- auditTypes.ts
- icp.ts
- GlobalRunBar.tsx
- ref_node_assert
- assist.ts
- briefActions.int.spec.ts
- ahrefs.ts
- richtext.ts
- qa/index.ts
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- BrandVoiceView.tsx
- parsers.ts
- review/index.ts
- evidenceBank.ts
- llmSettings.ts
- lib/informationGain/candidates.ts
- qaStagePrompts.test.ts
- fetchPage.test.ts
- EvidenceBankEditor.tsx
- positioning.ts
- package.json
- sourceReviewActions.ts
- IcpEditor.tsx
- contentListData.ts
- templateActions.ts
- compilerOptions
- sourceReviewTypes.ts
- topicDiscoveryActions.ts
- sitePages.int.spec.ts
- icps.int.spec.ts
- briefActions.ts
- seed.ts
- llm.ts
- dependencies
- ArticleReview.tsx
- Facet
- mockPages.ts
- Findings
- devDependencies
- capture.mjs
- extractText.ts
- scripts
- reviewPanels.int.spec.ts
- EvidenceBank.ts
- brandVoiceExtract.ts
- ref_node_crypto
- igText.test.ts
- compilerOptions
- Datum
- lib/informationGain/index.ts
- src/informationGain/candidates.ts
- tenantPrompts.test.ts
- vitest
- webhookSettings.ts
- articleReportSummary.ts
- Information gain (VMIG)
- Global Constraints
- Contributor Covenant Code of Conduct
- addressGuard.ts
- articleMetadata.int.spec.ts
- opsKpis.ts
- UI and workflow audit — 2026-09-11
- igCandidates.test.ts
- lib/llmProvider.ts
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- README.md
- informationGainRuns.int.spec.ts
- articleActions.int.spec.ts
- payloadClient.ts
- ig-e2e.sh
- dependencies
- Operations
- [...slug]/route.ts
- corpusSnapshots.int.spec.ts
- reportQueries.ts
- Tenant context
- @payloadcms/db-postgres
- tenantActions.int.spec.ts
- Brand voice and style guide
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- migrations/index.ts
- Security Policy
- eslint.config.mjs
- repository
- 20260826_015027_existing_schema_baseline.ts
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- bugs
- engines
- pnpm
- next.config.ts
- scripts
- admin.e2e.spec.ts
- report.test.ts
- devDependencies
- repository

## God Nodes (most connected - your core abstractions)
1. `react` - 81 edges
2. `vitest` - 60 edges
3. `next` - 54 edges
4. `resolveWorkspaceProfile()` - 45 edges
5. `loadWorkspaceSetup()` - 32 edges
6. `Field()` - 31 edges
7. `Article` - 29 edges
8. `@payloadcms/next` - 22 edges
9. `getOrBuildSnapshot()` - 22 edges
10. `StageContext` - 22 edges

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

## Communities (149 total, 26 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.07
Nodes (42): asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf(), EvidenceFindingRow (+34 more)

### Community 1 - "passes.ts"
Cohesion: 0.06
Nodes (46): DEFAULT_MAX_DRAFT_CLAIMS, DraftClaim, Claims nobody checked, Cost, Scoring a draft, What is written, BaselineContextOptions, batchFacetId() (+38 more)

### Community 2 - "tenant.ts"
Cohesion: 0.08
Nodes (16): PositioningEditor(), SECTION_KEYS, PositioningView(), loadAssistContext(), upsertPositioning(), Positioning, isEvidenceBankEmpty(), positioningFixtureDoc() (+8 more)

### Community 3 - "setupActions.ts"
Cohesion: 0.13
Nodes (26): assistAction(), assistError(), AssistMode, AssistResult, governanceAuditContext(), pageWarning(), refreshSitePagesAction(), RefreshSitePagesResult (+18 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (56): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+48 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.05
Nodes (37): internalDuplicationRate(), JudgeSignals, VerifierSignals, hostnameOf(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP, ClaimRecord (+29 more)

### Community 6 - "informationGain/types.ts"
Cohesion: 0.08
Nodes (31): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), InformationGainPolicy (+23 more)

### Community 7 - "tenant/fixtures.ts"
Cohesion: 0.11
Nodes (20): AssistInput, ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS, AssistAsset, AssistInput, ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE (+12 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (38): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+30 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.08
Nodes (37): BrandVoiceFiles, BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), asArray() (+29 more)

### Community 10 - "generatePrompt.ts"
Cohesion: 0.07
Nodes (30): BrandVoiceContent, brandVoiceSamplesToPrompt(), BRAND_VOICE_FIXTURE, InformationGap, evidenceRules(), Gap-fed generation, BriefDraft, BriefSection (+22 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.11
Nodes (35): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SectionProps, ValuesSection() (+27 more)

### Community 13 - "payload.config.ts"
Cohesion: 0.11
Nodes (12): GET, OPTIONS, POST, ArticleAudit, Media, PipelineRuns, Templates, TopicSearches (+4 more)

### Community 14 - "fetchPage.ts"
Cohesion: 0.11
Nodes (12): ALLOWED_PROTOCOLS, Cleared, CrawlRequestInit, FETCH_TIMEOUT_MS, FetchedPage, HTML_CONTENT_TYPES, LookupCallback, PinnedDispatcher (+4 more)

### Community 15 - "ref_payload"
Cohesion: 0.07
Nodes (36): importMap, Args, Args, Args, ArticleReviewView(), formatAuditTimestamp(), isScheduleExpired(), toBoardArticle() (+28 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.13
Nodes (20): POST(), DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER, verifyWebhookSignature() (+12 more)

### Community 17 - "stages.ts"
Cohesion: 0.08
Nodes (22): PipelineStageName, ResolvedPolicy, stripEvidenceRefs(), Article, EvidenceCitation, extractEvidenceCitations(), GeneratedArticle, generateStage (+14 more)

### Community 18 - "workspaceReadiness.ts"
Cohesion: 0.08
Nodes (43): HomePage(), SetupWorkspaceEditor(), SetupWorkspaceView(), runtimeStatusAction(), saveWorkspaceProfileAction(), WorkspaceProfile, AssistContext, EvidenceBankContent (+35 more)

### Community 19 - "igScoring.test.ts"
Cohesion: 0.10
Nodes (19): clamp01(), clampImportance(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE, ratio(), relevanceFromQueries() (+11 more)

### Community 20 - "boardActions.ts"
Cohesion: 0.09
Nodes (35): isRunnableStatus(), isStalled(), BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), requireUser(), runSelectedArticlesAction() (+27 more)

### Community 21 - "src/index.ts"
Cohesion: 0.11
Nodes (30): executeContentRun(), safeError(), Policy and evidence sources are run-scoped, createAhrefsClient(), GapKeyword, loadActiveBrandVoice(), repoRoot, FetchContext (+22 more)

### Community 22 - "loadWorkspaceReadiness.ts"
Cohesion: 0.12
Nodes (23): OnboardingDashboardView(), checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklist(), SetupChecklistData (+15 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "ReportsPanel.tsx"
Cohesion: 0.29
Nodes (8): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel()

### Community 25 - "report.ts"
Cohesion: 0.21
Nodes (13): stageKpis(), articleIdOf(), IG_DECISIONS, meanOf(), PassCounter, printReport(), rate(), ReasonLike (+5 more)

### Community 26 - "seedContentOps.ts"
Cohesion: 0.16
Nodes (19): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+11 more)

### Community 27 - "[slug]/page.tsx"
Cohesion: 0.20
Nodes (12): generateMetadata(), Props, PublishedArticlePage(), revalidate, findPublishedArticle(), escapeHtml(), lastH2HeadingText(), lexicalBodyToHtml() (+4 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.23
Nodes (26): activateDefaultBrandVoiceAction(), activateDefaultTenantAction(), activateIcpAction(), archiveIcpAction(), createIcpAction(), createIcpIfMissing(), dateOrNull(), deleteIcpDraftAction() (+18 more)

### Community 29 - "auditTypes.ts"
Cohesion: 0.20
Nodes (15): auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, auditEventLabel(), AuditSource, AuditRow (+7 more)

### Community 30 - "icp.ts"
Cohesion: 0.12
Nodes (30): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf(), confidenceTag() (+22 more)

### Community 31 - "GlobalRunBar.tsx"
Cohesion: 0.13
Nodes (18): CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO, STAGE_PROGRESS (+10 more)

### Community 32 - "ref_node_assert"
Cohesion: 0.09
Nodes (12): DEFAULT_POLICY, buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT, QueryClusterEntry, FACET_IDS, GenerateFixture (+4 more)

### Community 33 - "assist.ts"
Cohesion: 0.12
Nodes (27): applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, AssistMode, assistRules(), assistSectionKeys() (+19 more)

### Community 34 - "briefActions.int.spec.ts"
Cohesion: 0.08
Nodes (18): authMock, createRunMock, edits, findByIDMock, ICPS, setupMock, updateMock, readiness() (+10 more)

### Community 35 - "ahrefs.ts"
Cohesion: 0.06
Nodes (19): AhrefsClient, AhrefsClientOptions, AhrefsProfile, MatchingTermRow, MockAhrefsClient, opportunityScore(), OrganicKeywordRow, RealAhrefsClient (+11 more)

### Community 36 - "richtext.ts"
Cohesion: 0.11
Nodes (29): Template, bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks() (+21 more)

### Community 37 - "qa/index.ts"
Cohesion: 0.11
Nodes (21): qaStage, CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision (+13 more)

### Community 38 - "actions.ts"
Cohesion: 0.19
Nodes (28): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+20 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.09
Nodes (43): parsePageClaims(), excerptFoundIn(), selectInternalCorpus(), BaselineClaim, userAgentFor(), CorpusSnapshot, Baseline claims and facets, Corpus snapshots (+35 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.07
Nodes (27): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+19 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.16
Nodes (23): SCORE_INVALIDATED_EVENT, scoreInvalidatedFields(), scoreInvalidatedSummary(), scoreInvalidationNotice(), ArticleAuditContext, auditArticleChange(), AuditRequestContext, humanize() (+15 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.08
Nodes (49): AuditTimelineEntry, AuditTimeline(), Props, activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), errorMessage() (+41 more)

### Community 44 - "BrandVoiceView.tsx"
Cohesion: 0.39
Nodes (7): BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), brandVoiceContentOf(), BrandVoice

### Community 45 - "parsers.ts"
Cohesion: 0.17
Nodes (26): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+18 more)

### Community 46 - "review/index.ts"
Cohesion: 0.20
Nodes (19): qaFailures(), ArchiveAction(), OpenInAdmin(), PANEL_FOR_STATUS, ArchivedPanel(), BriefPanel(), IgReasonsAside(), NeedsRevisionPanel() (+11 more)

### Community 47 - "evidenceBank.ts"
Cohesion: 0.06
Nodes (41): claimProblems(), asArray(), asDay(), asRecord(), asString(), checkEvidenceRefs(), cleared(), depthOf() (+33 more)

### Community 48 - "llmSettings.ts"
Cohesion: 0.10
Nodes (27): CostLog, LlmSettings, catalogModel(), DEFAULT_MODEL, LLM_CATALOG, LLM_MODEL_OPTIONS, money(), PROVIDER_LABEL (+19 more)

### Community 49 - "lib/informationGain/candidates.ts"
Cohesion: 0.16
Nodes (18): CANDIDATE_RANK, CandidateClass, CandidateKind, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings(), modalBy() (+10 more)

### Community 50 - "qaStagePrompts.test.ts"
Cohesion: 0.18
Nodes (14): emptyTenantContext(), namedOnly(), tenantFor(), withBank(), ctxWith(), article(), AUDIENCE, citing() (+6 more)

### Community 51 - "fetchPage.test.ts"
Cohesion: 0.12
Nodes (12): FETCH_MAX_BYTES, LookupFn, MAX_REDIRECTS, PAGE_TEXT_CAP_CHARS, ResolvedAddress, USER_AGENT, bodyOf(), encoder (+4 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.11
Nodes (22): AssistPanel(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankView() (+14 more)

### Community 53 - "positioning.ts"
Cohesion: 0.15
Nodes (20): buildAssistUser(), sitePageBlock(), asArray(), asRecord(), asString(), evidenceRefOf(), Loose, parsePositioningContent() (+12 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewActions.ts"
Cohesion: 0.17
Nodes (18): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), errorMessage(), governanceAuditContext(), isQualityClass(), reopenCandidateAction() (+10 more)

### Community 56 - "IcpEditor.tsx"
Cohesion: 0.09
Nodes (23): CascadeContext, gateIcpActivation(), asRecord(), AssetStep, AssetStepper(), AssistConfig, hasSectionContent(), Props (+15 more)

### Community 57 - "contentListData.ts"
Cohesion: 0.16
Nodes (14): active, archivedOnly, CONTENT_FILTERS, CONTENT_PAGE_SIZE, ContentFilter, ContentPage, ContentRow, loadContentPage() (+6 more)

### Community 58 - "templateActions.ts"
Cohesion: 0.30
Nodes (11): createTemplateAction(), requireUser(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView() (+3 more)

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "sourceReviewTypes.ts"
Cohesion: 0.16
Nodes (13): ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES, num() (+5 more)

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.23
Nodes (17): compact(), difficultyLabel(), Props, TopicDiscovery(), createTopicsAction(), discoverTopicsAction(), errorMessage(), isFresh() (+9 more)

### Community 62 - "sitePages.int.spec.ts"
Cohesion: 0.14
Nodes (6): SitePage, authMock, FetchedPage, { fetchPage: realFetchPage }, fetchPageMock, FetchPageModule

### Community 63 - "icps.int.spec.ts"
Cohesion: 0.29
Nodes (5): Icps, create(), createdArticleIds, createdIds, icpData()

### Community 64 - "briefActions.ts"
Cohesion: 0.26
Nodes (16): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), errorMessage(), icpIdOf(), requireUser() (+8 more)

### Community 65 - "seed.ts"
Cohesion: 0.21
Nodes (13): evidenceSources, heading(), Node, paragraph(), RichText, seed(), templates, TemplateSeed (+5 more)

### Community 66 - "llm.ts"
Cohesion: 0.08
Nodes (33): PipelineStage, ModelReadiness, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture, fixtures (+25 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "ArticleReview.tsx"
Cohesion: 0.09
Nodes (31): ArticleReview(), Props, BoardArticle, OWNER_LABEL, STAGE_LABEL, StageInfo, stageOf(), TemplateOption (+23 more)

### Community 69 - "Facet"
Cohesion: 0.18
Nodes (8): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), Facet

### Community 70 - "mockPages.ts"
Cohesion: 0.12
Nodes (13): MOCK_TARGET_DOMAIN, competitorOne, competitorTwo, genericPage, industryMag, MockPage, PAGES_BY_HOST, pathOf() (+5 more)

### Community 71 - "Findings"
Cohesion: 0.22
Nodes (9): Content list, Findings, Globals rendered raw, Navigation and information architecture, New content, Onboarding, Public site, Reports (+1 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "capture.mjs"
Cohesion: 0.17
Nodes (6): execute, all, extra, results, routes, viewports

### Community 74 - "extractText.ts"
Cohesion: 0.17
Nodes (12): detectKind(), docxToText(), ExtractedKind, ExtractedText, extractText(), hideArrayPrototypePollution(), MAX_EXTRACT_CHARS, MIME_KINDS (+4 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "reviewPanels.int.spec.ts"
Cohesion: 0.19
Nodes (15): InformationGainRunView, AuditSummary, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+7 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.08
Nodes (32): GovernanceAudit, ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), EvidenceBank, highestRefIn(), idOf() (+24 more)

### Community 78 - "brandVoiceExtract.ts"
Cohesion: 0.11
Nodes (24): BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), ExtractionResult, logExtractionCost(), mockExtraction() (+16 more)

### Community 79 - "ref_node_crypto"
Cohesion: 0.18
Nodes (5): PublishDueTask, privateCollections, privateGlobals, handler, runTask()

### Community 80 - "igText.test.ts"
Cohesion: 0.17
Nodes (6): keywordTokens(), nearDuplicateJaccard(), normaliseWhitespace(), STOPWORDS, tokenOverlap(), extractReadableText()

### Community 81 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+6 more)

### Community 82 - "Datum"
Cohesion: 0.13
Nodes (15): Article status flow, Datum, Documentation, Environment variables, First run and making content, License, Pipeline mock mode, Prerequisites (+7 more)

### Community 83 - "lib/informationGain/index.ts"
Cohesion: 0.27
Nodes (4): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES

### Community 84 - "src/informationGain/candidates.ts"
Cohesion: 0.23
Nodes (8): CandidateSighting, suggestClass(), isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), Call

### Community 85 - "tenantPrompts.test.ts"
Cohesion: 0.18
Nodes (3): CONFIDENCE_LEVELS, ICP, POSITIONING

### Community 86 - "vitest"
Cohesion: 0.31
Nodes (5): Articles, gateReviewOverride(), ARTICLE_STATUSES, mocks, vitest

### Community 87 - "webhookSettings.ts"
Cohesion: 0.28
Nodes (7): WebhookSettings, clean(), ResolvedWebhookSettings, WEBHOOK_SECRET_ENV_VAR, WEBHOOK_URL_ENV_VAR, WebhookSettingsDoc, WebhookSource

### Community 88 - "articleReportSummary.ts"
Cohesion: 0.28
Nodes (8): ArticleReportSummary, failureDetails(), IG_DECISION_LABEL, IG_DECISIONS, IgDecision, informationGainMix(), ReportArticle, summarizeReportArticles()

### Community 89 - "Information gain (VMIG)"
Cohesion: 0.29
Nodes (6): Information gain (VMIG), Running the whole thing, Source quality, and why classifying domains is real work, The regeneration loop, What is deferred, Why

### Community 90 - "Global Constraints"
Cohesion: 0.13
Nodes (16): startContentRunAction(), ContentRunForm(), submit(), Props, OpenRulingStatus, templates, read(), Global Constraints (+8 more)

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "articleMetadata.int.spec.ts"
Cohesion: 0.33
Nodes (5): metadata, metadataBase, buildArticleMetadata(), getMetadataBase(), getSiteUrl()

### Community 94 - "opsKpis.ts"
Cohesion: 0.29
Nodes (5): ReportsView(), CostLogLike, PipelineRunLike, runHealth, loadReportCosts()

### Community 95 - "UI and workflow audit — 2026-09-11"
Cohesion: 0.25
Nodes (7): Consolidation proposals, How to read this, Journey map, Legacy removal list, Proposed Phase 2 slices, UI and workflow audit — 2026-09-11, Walkthrough state to reproduce

### Community 97 - "lib/llmProvider.ts"
Cohesion: 0.51
Nodes (7): apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement, requirementForModel()

### Community 98 - "Contributing to Datum"
Cohesion: 0.18
Nodes (11): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+3 more)

### Community 99 - "open-source-checklist.md"
Cohesion: 0.20
Nodes (9): 1. Settings → General → Danger Zone → Change visibility → Public, 2. Settings → General → Features → enable Issues (and Discussions if desired), 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting, 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`, 5. Confirm SECURITY.md and advisories link work for the public repo, 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public, Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo., Complete these in the GitHub UI after merging open-source readiness changes: (+1 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 103 - "articleActions.int.spec.ts"
Cohesion: 0.22
Nodes (7): authMock, countMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findByIDMock, findMock, updateMock, article()

### Community 104 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 105 - "ig-e2e.sh"
Cohesion: 0.42
Nodes (8): assert_eq(), assert_ge(), assert_ne(), info(), log(), ig-e2e.sh script, probe(), value_of()

### Community 106 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 107 - "Operations"
Cohesion: 0.25
Nodes (7): Cache and revalidation, Fixed limits worth knowing, Job queues, Modes and money, Operations, Scheduled publishing, Webhooks

### Community 108 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 109 - "corpusSnapshots.int.spec.ts"
Cohesion: 0.33
Nodes (4): CorpusSnapshots, internalCorpusSubfields, pagesSubfields, topLevelFields

### Community 110 - "reportQueries.ts"
Cohesion: 0.43
Nodes (5): StageKpiRow, ReportCostFilter, CostReport, SpendRow, Task 10: Split the review page into per-status panels (C-5, F-028, F-029)

### Community 111 - "Tenant context"
Cohesion: 0.29
Nodes (6): Gating, How prompts use them, Positioning, Tenant context, The assets, The site crawl

### Community 113 - "tenantActions.int.spec.ts"
Cohesion: 0.29
Nodes (3): GovernanceAudit, authStub, createdIcpIds

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

### Community 141 - "next.config.ts"
Cohesion: 0.33
Nodes (3): dirname, __filename, nextConfig

### Community 143 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, fetch, report, run, test, typecheck

### Community 144 - "admin.e2e.spec.ts"
Cohesion: 0.70
Nodes (3): cleanupTestUser(), seedTestUser(), testUser

### Community 145 - "report.test.ts"
Cohesion: 0.50
Nodes (3): FakeArticle, fakePayload(), reportOf()

### Community 146 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, tsx, @types/node, typescript

### Community 147 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

## Knowledge Gaps
- **795 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+790 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1060 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `ref_payload` to `articleStatus.ts`, `tenant.ts`, `Field`, `workspaceReadiness.ts`, `loadWorkspaceReadiness.ts`, `ReportsPanel.tsx`, `[slug]/page.tsx`, `auditTypes.ts`, `icp.ts`, `GlobalRunBar.tsx`, `actions.ts`, `cms/package.json`, `BrandVoiceEditor.tsx`, `BrandVoiceView.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `sourceReviewActions.ts`, `IcpEditor.tsx`, `templateActions.ts`, `topicDiscoveryActions.ts`, `briefActions.ts`, `ArticleReview.tsx`, `reviewPanels.int.spec.ts`, `Global Constraints`, `articleMetadata.int.spec.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _795 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `next` connect `ref_payload` to `tenant.ts`, `setupActions.ts`, `next.config.ts`, `webhookDeliver.int.spec.ts`, `workspaceReadiness.ts`, `boardActions.ts`, `loadWorkspaceReadiness.ts`, `ReportsPanel.tsx`, `[slug]/page.tsx`, `tenantActions.ts`, `auditTypes.ts`, `GlobalRunBar.tsx`, `actions.ts`, `cms/package.json`, `BrandVoiceEditor.tsx`, `BrandVoiceView.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `sourceReviewActions.ts`, `IcpEditor.tsx`, `templateActions.ts`, `topicDiscoveryActions.ts`, `briefActions.ts`, `ArticleReview.tsx`, `Global Constraints`, `articleMetadata.int.spec.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `passes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06440677966101695 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `tenant.ts`, `informationGain/types.ts`, `tenant/fixtures.ts`, `lib/brandVoice.ts`, `payload.config.ts`, `ref_payload`, `webhookDeliver.int.spec.ts`, `workspaceReadiness.ts`, `boardActions.ts`, `loadWorkspaceReadiness.ts`, `auditTypes.ts`, `GlobalRunBar.tsx`, `briefActions.int.spec.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `llmSettings.ts`, `EvidenceBankEditor.tsx`, `contentListData.ts`, `sourceReviewTypes.ts`, `sitePages.int.spec.ts`, `icps.int.spec.ts`, `capture.mjs`, `reviewPanels.int.spec.ts`, `EvidenceBank.ts`, `brandVoiceExtract.ts`, `ref_node_crypto`, `lib/informationGain/index.ts`, `Global Constraints`, `articleMetadata.int.spec.ts`, `opsKpis.ts`, `informationGainRuns.int.spec.ts`, `articleActions.int.spec.ts`, `corpusSnapshots.int.spec.ts`, `tenantActions.int.spec.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `tenant.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08461538461538462 - nodes in this community are weakly interconnected._