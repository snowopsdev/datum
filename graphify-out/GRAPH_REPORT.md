# Graph Report - datum  (2026-10-06)

## Corpus Check
- 400 files · ~1,004,061 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 3, .example 2)

## Summary
- 2882 nodes · 7453 edges · 153 communities (122 shown, 31 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 251 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f17e6414`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- igText.test.ts
- evidenceBank.int.spec.ts
- sitePages.int.spec.ts
- payload-types.ts
- scorecard.ts
- igPolicy.test.ts
- igScoring.test.ts
- exactness.ts
- lib/brandVoice.ts
- verdicts.ts
- pipeline/package.json
- Field
- ref_payload
- Information gain (VMIG)
- (payload)/layout.tsx
- seedContentOps.ts
- ContentList.tsx
- tenantLib.test.ts
- src/informationGain/index.ts
- ref_node_crypto
- src/index.ts
- setupChecklist.int.spec.ts
- DESIGN.md
- igCoverage.test.ts
- report.ts
- setupActions.ts
- workspaceProfile.ts
- tenantActions.ts
- governanceAudit.ts
- icp.ts
- RunBarProvider.tsx
- capture.mjs
- assist.ts
- boardActions.int.spec.ts
- ahrefs.ts
- qa/index.ts
- react
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- evidenceBank.ts
- parsers.ts
- review/index.ts
- llm.ts
- workspaceReadiness.ts
- igCandidates.test.ts
- stages.ts
- fetchPage.ts
- EvidenceBankEditor.tsx
- positioning.ts
- package.json
- sourceReviewTypes.ts
- llmSettings.ts
- auditTypes.ts
- boardActions.ts
- compilerOptions
- evidenceBank.test.ts
- topicDiscoveryActions.ts
- findPublishedArticle.ts
- icps.int.spec.ts
- next
- tenant/fixtures.ts
- igQueryCluster.test.ts
- dependencies
- GlobalRunBar.tsx
- ArticleReview.tsx
- README.md
- templateActions.ts
- devDependencies
- ReportsPanel.tsx
- reviewPanels.int.spec.ts
- scripts
- [slug]/page.tsx
- EvidenceBank.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- generatePrompt.ts
- activeRuns.ts
- mockPages.ts
- informationGain/types.ts
- contentRun.ts
- stageKpis
- Contributor Covenant Code of Conduct
- addressGuard.ts
- articleActions.int.spec.ts
- brandVoiceExtract.int.spec.ts
- topicDiscoveryActions.int.spec.ts
- dependencies
- evidenceBankSummary
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- lib/informationGain/index.ts
- informationGainRuns.int.spec.ts
- briefActions.int.spec.ts
- scripts
- ig-e2e.sh
- devDependencies
- Operations
- payloadClient.ts
- repository
- tenantActions.int.spec.ts
- SetupWorkspaceEditor.tsx
- @payloadcms/db-postgres
- Tenant context
- briefActions.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- BrandVoiceGuide.tsx
- Global Constraints
- eslint.config.mjs
- repository
- ReportsView.tsx
- AuditTrail.tsx
- RealAhrefsClient
- migrations/index.ts
- report.test.ts
- 20260826_015027_existing_schema_baseline.ts
- pipelineReportCli.int.spec.ts
- MockAhrefsClient
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- tenant.ts
- engines
- bugs
- Findings

## God Nodes (most connected - your core abstractions)
1. `react` - 82 edges
2. `vitest` - 61 edges
3. `next` - 55 edges
4. `requireUser()` - 53 edges
5. `resolveWorkspaceProfile()` - 45 edges
6. `errorMessage()` - 34 edges
7. `loadWorkspaceSetup()` - 32 edges
8. `Field()` - 31 edges
9. `Article` - 28 edges
10. `getOrBuildSnapshot()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Setup asset editors` --references--> `AssetStepper()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/AssetStepper.tsx
- `Onboarding` --references--> `checklistRows()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/SetupChecklist.tsx
- `Webhooks` --references--> `verifyWebhookSignature()`  [INFERRED]
  docs/operations.md → cms/src/jobs/webhookDeliver.ts
- `Task 1: Remove `codex/*` end to end (L-1, L-2, F-013)` --references--> `providerForModel()`  [INFERRED]
  docs/superpowers/plans/2026-09-11-phase2-ui-workflow-polish.md → cms/src/lib/llmProvider.ts
- `Model, mock mode, and cost` --references--> `resolveSetupAssistModel()`  [INFERRED]
  docs/tenant-context.md → cms/src/lib/llmSettings.ts

## Import Cycles
- None detected.

## Communities (153 total, 31 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.08
Nodes (35): asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf(), EvidenceFindingRow (+27 more)

### Community 1 - "igText.test.ts"
Cohesion: 0.17
Nodes (5): keywordTokens(), nearDuplicateJaccard(), STOPWORDS, tokenOverlap(), intraDocumentNovelty()

### Community 2 - "evidenceBank.int.spec.ts"
Cohesion: 0.21
Nodes (6): EvidenceBank, clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh()

### Community 3 - "sitePages.int.spec.ts"
Cohesion: 0.10
Nodes (20): pageWarning(), refreshSitePagesAction(), candidatePagePaths(), FetchedPageLike, hostKey(), isSameSite(), MAX_DISCOVERED_PAGES, MAX_SITE_PAGES (+12 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (57): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoice, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect (+49 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.07
Nodes (32): consensusCoverage(), internalDuplicationRate(), JudgeSignals, VerifierSignals, hostnameOf(), resolveSourceQuality(), ClaimRecord, ClaimSignals (+24 more)

### Community 6 - "igPolicy.test.ts"
Cohesion: 0.08
Nodes (26): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+18 more)

### Community 7 - "igScoring.test.ts"
Cohesion: 0.10
Nodes (18): InformationGainPolicy, clamp01(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE, ratio(), relevanceFromQueries() (+10 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (37): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+29 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.10
Nodes (34): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), asArray(), asRecord() (+26 more)

### Community 10 - "verdicts.ts"
Cohesion: 0.13
Nodes (20): CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision, EvidenceFindingStatus (+12 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.10
Nodes (38): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SECTION_COMPONENTS, SectionProps (+30 more)

### Community 13 - "ref_payload"
Cohesion: 0.04
Nodes (38): dirname, __filename, nextConfig, OPTIONS, POST, DELETE, GET, OPTIONS (+30 more)

### Community 14 - "Information gain (VMIG)"
Cohesion: 0.29
Nodes (6): Information gain (VMIG), Running the whole thing, Source quality, and why classifying domains is real work, The regeneration loop, What is deferred, Why

### Community 15 - "(payload)/layout.tsx"
Cohesion: 0.15
Nodes (4): importMap, Args, Args, Args

### Community 16 - "seedContentOps.ts"
Cohesion: 0.06
Nodes (45): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+37 more)

### Community 17 - "ContentList.tsx"
Cohesion: 0.08
Nodes (34): isScheduleExpired(), isStalled(), NEXT_STAGE_VERB_FOR_STATUS, OWNER_LABEL, STAGE_LABEL, StageInfo, stageOf(), STATUS_STAGE (+26 more)

### Community 18 - "tenantLib.test.ts"
Cohesion: 0.09
Nodes (8): Positioning, PipelineRunSummary, relationshipIds(), icpIdOf(), icpsFromDocs(), selectIcp(), EMPTY_GLOBAL, tenantWith()

### Community 19 - "src/informationGain/index.ts"
Cohesion: 0.05
Nodes (52): DEFAULT_POLICY, DraftClaim, CorpusSnapshot, Claims nobody checked, Scoring a draft, What is written, BaselineContextOptions, batchFacetId() (+44 more)

### Community 20 - "ref_node_crypto"
Cohesion: 0.22
Nodes (12): StartContentRunInput, StartContentRunResult, ActivePipelineRunError, createPipelineRun(), CreatePipelineRunInput, AFFECTED_PATHS, gateRunReadiness(), plural() (+4 more)

### Community 21 - "src/index.ts"
Cohesion: 0.22
Nodes (11): FetchContext, CliArgs, main(), parseArgs(), resolveTemplateId(), usage(), ReportPeriod, Hand-edit policy (+3 more)

### Community 22 - "setupChecklist.int.spec.ts"
Cohesion: 0.27
Nodes (11): checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklistData, workspaceState(), llmSettingsConfigured() (+3 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "igCoverage.test.ts"
Cohesion: 0.21
Nodes (6): applyTemplateHints(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf()

### Community 25 - "report.ts"
Cohesion: 0.20
Nodes (14): articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate(), ReasonLike (+6 more)

### Community 26 - "setupActions.ts"
Cohesion: 0.10
Nodes (28): assistAction(), assistError(), AssistMode, AssistResult, loadAssistContext(), RefreshSitePagesResult, BrandVoiceExtractionError, extractBrandVoiceFromText() (+20 more)

### Community 27 - "workspaceProfile.ts"
Cohesion: 0.27
Nodes (10): clean(), Competitor, COMPETITOR_DOMAINS_ENV_VAR, competitorsFromDoc(), MOCK_COMPETITOR_DOMAINS, normaliseDomain(), parseCompetitorDomainsEnv(), PLACEHOLDER_DOMAINS (+2 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.16
Nodes (32): activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), extractBrandVoiceFromUploadAction(), saveBrandVoiceDraftAction(), toData(), UPLOAD_MIMETYPES, UploadExtractResult (+24 more)

### Community 29 - "governanceAudit.ts"
Cohesion: 0.19
Nodes (15): GovernanceAudit, ArticleAuditContext, auditArticleChange(), AuditRequestContext, emitArticleStatusEvent(), auditActor(), changedFieldsOf(), humanize() (+7 more)

### Community 30 - "icp.ts"
Cohesion: 0.06
Nodes (49): CascadeContext, gateIcpActivation(), IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), ICP_STEPS, IcpDTO (+41 more)

### Community 31 - "RunBarProvider.tsx"
Cohesion: 0.39
Nodes (5): RunBarProvider(), RuntimeBanner(), runtimeStatusAction(), mocks, show()

### Community 32 - "capture.mjs"
Cohesion: 0.22
Nodes (5): all, extra, results, routes, viewports

### Community 33 - "assist.ts"
Cohesion: 0.11
Nodes (30): LlmSettingsDoc, applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS (+22 more)

### Community 34 - "boardActions.int.spec.ts"
Cohesion: 0.15
Nodes (10): authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createMock, findByIDMock (+2 more)

### Community 35 - "ahrefs.ts"
Cohesion: 0.11
Nodes (14): AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, OrganicKeywordRow, SerpPage, SerpPositionRow, buildConfig() (+6 more)

### Community 36 - "qa/index.ts"
Cohesion: 0.05
Nodes (33): mapWithConcurrency(), sumArticleCost(), EvidenceCitation, GeneratedArticle, generateStage, qaStage, bannedPhraseViolations(), countSyllables() (+25 more)

### Community 37 - "react"
Cohesion: 0.11
Nodes (21): startContentRunAction(), ContentRunForm(), submit(), Props, ExtraOpsNavLinks(), NavLink, Section, SECTIONS (+13 more)

### Community 38 - "actions.ts"
Cohesion: 0.13
Nodes (35): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+27 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.11
Nodes (37): parsePageClaims(), excerptFoundIn(), selectInternalCorpus(), BaselineClaim, Baseline claims and facets, Corpus snapshots, adopt(), articleText() (+29 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (25): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+17 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.20
Nodes (17): Articles, scoreInvalidatedSummary(), CLEARED_INFORMATION_GAIN, freshJustification(), gateArchivedStatus(), gateReadOnlyStatus(), gateReviewOverride(), gateVerifiedStatus() (+9 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.10
Nodes (31): AuditTimelineEntry, AuditTimeline(), Props, deleteDraftAction(), BrandVoiceEditor(), BrandVoiceReview(), clampQuestion(), contentOf() (+23 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.15
Nodes (23): asArray(), asRecord(), asString(), depthOf(), emptyEvidenceBankContent(), evidenceBankToPrompt(), EvidenceRefCheck, evidenceRefsIn() (+15 more)

### Community 45 - "parsers.ts"
Cohesion: 0.15
Nodes (28): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+20 more)

### Community 46 - "review/index.ts"
Cohesion: 0.26
Nodes (15): isRunnableStatus(), ArchiveAction(), OpenInAdmin(), PANEL_FOR_STATUS, ArchivedPanel(), BriefPanel(), PublishedPanel(), ReviewDecisionPanel() (+7 more)

### Community 47 - "llm.ts"
Cohesion: 0.09
Nodes (30): PipelineStage, costUsd(), Cost, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture (+22 more)

### Community 48 - "workspaceReadiness.ts"
Cohesion: 0.10
Nodes (19): HomePage(), loadContentPage(), ContentListView(), tenantFingerprint(), WorkspaceProfileDoc, WorkspaceProfileSource, configured(), evaluateRuntimeReadiness() (+11 more)

### Community 49 - "igCandidates.test.ts"
Cohesion: 0.08
Nodes (20): CANDIDATE_RANK, CandidateClass, CandidateKind, CandidateSighting, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings() (+12 more)

### Community 50 - "stages.ts"
Cohesion: 0.05
Nodes (52): PipelineStageName, emptyTenantContext(), emptyPositioningContent(), resolveWorkspaceProfile(), Article, Template, AhrefsClient, SerpResearch (+44 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (17): normaliseWhitespace(), Mock mode, ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS (+9 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.12
Nodes (21): AssistPanel(), claimProblems(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS (+13 more)

### Community 53 - "positioning.ts"
Cohesion: 0.14
Nodes (25): PositioningEditor(), SECTION_KEYS, PositioningView(), savePositioningAction(), upsertPositioning(), asArray(), asRecord(), asString() (+17 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.08
Nodes (36): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), Badges() (+28 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.08
Nodes (38): CostLog, LlmSettings, ExtractionResult, CmsLlmResult, DEFAULT_MODEL, LLM_CATALOG, LLM_MODEL_OPTIONS, LlmModel (+30 more)

### Community 57 - "auditTypes.ts"
Cohesion: 0.19
Nodes (11): ArticleAudit, auditDetailsAction(), State, AUDIT_EVENT_LABELS, AuditDetailResult, AuditSource, SCORE_INVALIDATED_EVENT, scoreInvalidatedFields() (+3 more)

### Community 58 - "boardActions.ts"
Cohesion: 0.33
Nodes (8): BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), runSelectedArticlesAction(), toRunFailures(), Article review, Content list

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "evidenceBank.test.ts"
Cohesion: 0.11
Nodes (3): expiredClaims(), neverUseClaims(), dated

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.22
Nodes (16): compact(), difficultyLabel(), Props, TopicDiscovery(), createTopicsAction(), discoverTopicsAction(), isFresh(), recentSearchesAction() (+8 more)

### Community 62 - "findPublishedArticle.ts"
Cohesion: 0.24
Nodes (7): metadata, metadataBase, buildArticleMetadata(), publicFields, PublishedArticle, getMetadataBase(), getSiteUrl()

### Community 63 - "icps.int.spec.ts"
Cohesion: 0.20
Nodes (8): Icps, create(), createdArticleIds, createdIds, icpData(), read(), Shared code graph, Task 8: One nav, one surface per asset, masked secret (C-1, C-2, F-001, F-002, F-014, F-015, F-016, F-034, F-035)

### Community 64 - "next"
Cohesion: 0.13
Nodes (26): GET, ArticleReviewView(), formatAuditTimestamp(), toBoardArticle(), BrandVoiceView(), MODES, param(), toAuditEntry() (+18 more)

### Community 65 - "tenant/fixtures.ts"
Cohesion: 0.07
Nodes (36): AssistInput, BRAND_VOICE_FIXTURE, AssistAsset, AssistInput, ASSIST_MOCK_WARNING, assistMock(), FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE (+28 more)

### Community 66 - "igQueryCluster.test.ts"
Cohesion: 0.24
Nodes (4): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "GlobalRunBar.tsx"
Cohesion: 0.13
Nodes (17): CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO, STAGE_PROGRESS (+9 more)

### Community 69 - "ArticleReview.tsx"
Cohesion: 0.21
Nodes (14): ArticleReview(), Props, BoardArticle, TemplateOption, BriefIcpOption, ArticleBody(), PANEL_FOR_KEY, panelForArticle() (+6 more)

### Community 71 - "templateActions.ts"
Cohesion: 0.31
Nodes (10): createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView(), TemplateConfigDTO (+2 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.17
Nodes (16): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+8 more)

### Community 74 - "reviewPanels.int.spec.ts"
Cohesion: 0.19
Nodes (15): InformationGainRunView, ScorecardClaim, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+7 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "[slug]/page.tsx"
Cohesion: 0.21
Nodes (12): generateMetadata(), Props, PublishedArticlePage(), revalidate, findPublishedArticle, escapeHtml(), lastH2HeadingText(), lexicalBodyToHtml() (+4 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.24
Nodes (15): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), highestRefIn(), idOf(), Prefix, REF_FIELD (+7 more)

### Community 79 - "Brand voice and style guide"
Cohesion: 0.33
Nodes (6): Banned phrases, Brand voice and style guide, Formatting conventions, Structure, Voice, Words we prefer

### Community 80 - "Security Policy"
Cohesion: 0.40
Nodes (4): Non-security bugs, Reporting a vulnerability, Security Policy, Supported versions

### Community 81 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+6 more)

### Community 82 - "Datum"
Cohesion: 0.13
Nodes (15): Article status flow, Datum, Documentation, Environment variables, First run and making content, License, Pipeline mock mode, Prerequisites (+7 more)

### Community 83 - "fetchPage.test.ts"
Cohesion: 0.12
Nodes (12): FETCH_MAX_BYTES, LookupFn, MAX_REDIRECTS, PAGE_TEXT_CAP_CHARS, ResolvedAddress, USER_AGENT, bodyOf(), encoder (+4 more)

### Community 85 - "generatePrompt.ts"
Cohesion: 0.08
Nodes (35): BrandVoiceContent, brandVoiceSamplesToPrompt(), Facet, InformationGap, AssistContext, evidenceRules(), IcpContent, TenantContext (+27 more)

### Community 86 - "activeRuns.ts"
Cohesion: 0.31
Nodes (5): ACTIVE_RUN_STATUSES, activeRunArticleIds(), activeRunIncludesArticle(), Phase 2: UI and workflow polish Implementation Plan, Self-review

### Community 87 - "mockPages.ts"
Cohesion: 0.12
Nodes (14): MOCK_TARGET_DOMAIN, competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST (+6 more)

### Community 88 - "informationGain/types.ts"
Cohesion: 0.25
Nodes (8): BaselineClaimSource, CLAIM_TYPES, ClaimSummary, DECISION_RANK, Evidence, VERIFIABLE_CLAIM_TYPES, VerificationMode, VerificationOutcome

### Community 89 - "contentRun.ts"
Cohesion: 0.27
Nodes (10): ContentRunTask, executeContentRun(), safeError(), PipelineRun, opportunityScore(), fetchTopics(), FetchTopicsOptions, FetchTopicsResult (+2 more)

### Community 90 - "stageKpis"
Cohesion: 0.22
Nodes (8): stageKpis(), Consolidation proposals, How to read this, Journey map, Legacy removal list, Proposed Phase 2 slices, UI and workflow audit — 2026-09-11, Walkthrough state to reproduce

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "articleActions.int.spec.ts"
Cohesion: 0.22
Nodes (7): authMock, countMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findByIDMock, findMock, updateMock, article()

### Community 94 - "brandVoiceExtract.int.spec.ts"
Cohesion: 0.15
Nodes (15): detectKind(), docxToText(), ExtractedKind, ExtractedText, extractText(), hideArrayPrototypePollution(), MAX_EXTRACT_CHARS, MIME_KINDS (+7 more)

### Community 95 - "topicDiscoveryActions.int.spec.ts"
Cohesion: 0.14
Nodes (10): setupMock, { createPipelineRunMock }, payload, readiness(), user, authMock, CREATED, createMock (+2 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "evidenceBankSummary"
Cohesion: 0.16
Nodes (17): asDay(), checkEvidenceRefs(), cleared(), evidenceBankSummary, expired(), incompleteClaims(), isClaimComplete(), usableClaims() (+9 more)

### Community 98 - "Contributing to Datum"
Cohesion: 0.20
Nodes (10): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+2 more)

### Community 99 - "open-source-checklist.md"
Cohesion: 0.20
Nodes (9): 1. Settings → General → Danger Zone → Change visibility → Public, 2. Settings → General → Features → enable Issues (and Discussions if desired), 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting, 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`, 5. Confirm SECURITY.md and advisories link work for the public repo, 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public, Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo., Complete these in the GitHub UI after merging open-source readiness changes: (+1 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 101 - "lib/informationGain/index.ts"
Cohesion: 0.13
Nodes (11): EvidenceSourceCandidates, EvidenceSources, ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), CANDIDATE_CLASSES (+3 more)

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 103 - "briefActions.int.spec.ts"
Cohesion: 0.22
Nodes (6): authMock, createRunMock, edits, findByIDMock, ICPS, updateMock

### Community 104 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, fetch, report, run, test, typecheck

### Community 105 - "ig-e2e.sh"
Cohesion: 0.42
Nodes (8): assert_eq(), assert_ge(), assert_ne(), info(), log(), ig-e2e.sh script, probe(), value_of()

### Community 106 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, tsx, @types/node, typescript

### Community 107 - "Operations"
Cohesion: 0.25
Nodes (7): Cache and revalidation, Fixed limits worth knowing, Job queues, Modes and money, Operations, Scheduled publishing, Webhooks

### Community 108 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "tenantActions.int.spec.ts"
Cohesion: 0.25
Nodes (3): GovernanceAudit, authStub, createdIcpIds

### Community 111 - "SetupWorkspaceEditor.tsx"
Cohesion: 0.19
Nodes (12): asRecord(), AssetStep, AssetStepper(), AssistConfig, hasSectionContent(), Props, SetupWorkspaceEditor(), StepId (+4 more)

### Community 113 - "Tenant context"
Cohesion: 0.25
Nodes (7): Gating, How prompts use them, Positioning, Precedence, Tenant context, The assets, The site crawl

### Community 114 - "briefActions.ts"
Cohesion: 0.28
Nodes (13): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+5 more)

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 117 - "BrandVoiceGuide.tsx"
Cohesion: 0.53
Nodes (5): BrandVoiceGuide(), downloadMarkdown(), Empty(), Props, brandVoiceSlug()

### Community 118 - "Global Constraints"
Cohesion: 0.33
Nodes (6): Global Constraints, Task 12: Save-and-activate for audiences, one cost aggregation (F-007, C-6), Task 13: Docs, env examples and public site (2D: F-038, F-039, F-040, C-7 docs half, L-11 docs), Task 1: Remove `codex/*` end to end (L-1, L-2, F-013), Task 5: Surface the score-invalidation rule (F-024), Task 9: Layout, mobile and report presentation (F-004, F-005, F-010, F-012, F-030, F-036, F-037)

### Community 119 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 121 - "ReportsView.tsx"
Cohesion: 0.26
Nodes (10): ReportsView(), CostLogLike, PipelineRunLike, runHealth, StageKpiRow, loadReportCosts(), ReportCostFilter, CostReport (+2 more)

### Community 122 - "AuditTrail.tsx"
Cohesion: 0.36
Nodes (9): AuditEvidence(), auditEventLabel(), AuditSummary, AuditRow, AuditTrail(), groupAuditEvents(), money(), RunGroup() (+1 more)

### Community 125 - "report.test.ts"
Cohesion: 0.50
Nodes (3): FakeArticle, fakePayload(), reportOf()

### Community 138 - "tenant.ts"
Cohesion: 0.36
Nodes (8): ResolvedWorkspaceProfile, Policy and evidence sources are run-scoped, loadActiveBrandVoice(), loadEvidenceSources(), loadInformationGainPolicy(), loadStageInputs(), loadTenantContext(), loadWorkspaceProfile()

### Community 149 - "Findings"
Cohesion: 0.25
Nodes (8): Findings, Globals rendered raw, Navigation and information architecture, New content, Onboarding, Public site, Reports, Setup asset editors

## Knowledge Gaps
- **798 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+793 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1071 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `ref_payload` to `articleStatus.ts`, `evidenceBank.int.spec.ts`, `sitePages.int.spec.ts`, `lib/brandVoice.ts`, `seedContentOps.ts`, `ContentList.tsx`, `tenantLib.test.ts`, `ref_node_crypto`, `setupChecklist.int.spec.ts`, `setupActions.ts`, `governanceAudit.ts`, `RunBarProvider.tsx`, `capture.mjs`, `boardActions.int.spec.ts`, `react`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `llmSettings.ts`, `auditTypes.ts`, `findPublishedArticle.ts`, `icps.int.spec.ts`, `tenant/fixtures.ts`, `GlobalRunBar.tsx`, `reviewPanels.int.spec.ts`, `activeRuns.ts`, `contentRun.ts`, `articleActions.int.spec.ts`, `brandVoiceExtract.int.spec.ts`, `topicDiscoveryActions.int.spec.ts`, `lib/informationGain/index.ts`, `informationGainRuns.int.spec.ts`, `briefActions.int.spec.ts`, `tenantActions.int.spec.ts`, `20260826_015027_existing_schema_baseline.ts`, `pipelineReportCli.int.spec.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _798 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07716701902748414 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `ref_payload`, `(payload)/layout.tsx`, `seedContentOps.ts`, `ContentList.tsx`, `ref_node_crypto`, `setupChecklist.int.spec.ts`, `setupActions.ts`, `tenantActions.ts`, `icp.ts`, `react`, `actions.ts`, `cms/package.json`, `BrandVoiceEditor.tsx`, `review/index.ts`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `positioning.ts`, `sourceReviewTypes.ts`, `auditTypes.ts`, `boardActions.ts`, `topicDiscoveryActions.ts`, `findPublishedArticle.ts`, `GlobalRunBar.tsx`, `templateActions.ts`, `ReportsPanel.tsx`, `[slug]/page.tsx`, `SetupWorkspaceEditor.tsx`, `briefActions.ts`, `ReportsView.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `sitePages.int.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0989247311827957 - nodes in this community are weakly interconnected._
- **Why does `@payloadcms/db-postgres` connect `@payloadcms/db-postgres` to `20260827_155913_topic_discovery.ts`, `20260827_183330_board_selected_runs.ts`, `20260827_214532_brief_checkpoint.ts`, `20260831_190025_webhook_settings_and_delivery_task.ts`, `20260831_191144_scheduled_publishing.ts`, `20260902_210000_codex_model_options.ts`, `20260903_020919_workspace_profile_global.ts`, `20260903_022301_icps_collection_and_article_icp.ts`, `ref_payload`, `20260903_024506_positioning_global_and_llm_stage_schema.ts`, `20260903_030748_evidence_bank_global_and_qa.ts`, `20260905_232800_graphql_policy_options.ts`, `ref_node_crypto`, `20260911_145800_drop_codex_model_options.ts`, `20260911_152559_pipeline_runs_drop_onboarding_source.ts`, `20261006_205858_articles_lookup_indexes.ts`, `cms/package.json`, `ReportsView.tsx`, `migrations/index.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `payload-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03508771929824561 - nodes in this community are weakly interconnected._