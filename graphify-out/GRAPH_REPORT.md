# Graph Report - datum  (2026-10-06)

## Corpus Check
- 398 files · ~1,004,206 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 7, .css 3, .example 2)

## Summary
- 2895 nodes · 7410 edges · 123 communities (114 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 250 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `52efec42`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- batching.ts
- tenant.ts
- sitePages.int.spec.ts
- payload-types.ts
- scorecard.ts
- igPolicy.test.ts
- igScoring.test.ts
- exactness.ts
- lib/brandVoice.ts
- qa/index.ts
- pipeline/package.json
- Field
- payload.config.ts
- governanceAudit.ts
- react
- webhookDeliver.int.spec.ts
- stages.ts
- tenantLib.test.ts
- src/informationGain/index.ts
- ref_payload
- src/index.ts
- loadWorkspaceReadiness.ts
- DESIGN.md
- research.ts
- report.ts
- seed.ts
- [slug]/page.tsx
- tenantActions.ts
- auditTypes.ts
- icp.ts
- GlobalRunBar.tsx
- config.ts
- assist.ts
- tenantActions.int.spec.ts
- ahrefs.ts
- richtext.ts
- NewContentFlow.tsx
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- evidenceBank.test.ts
- parsers.ts
- review/index.ts
- evidenceBank.ts
- workspaceReadiness.ts
- lib/informationGain/candidates.ts
- qaStagePrompts.test.ts
- fetchPage.ts
- EvidenceBankEditor.tsx
- positioning.ts
- package.json
- sourceReviewActions.ts
- setupActions.ts
- boardActions.ts
- igCandidates.test.ts
- compilerOptions
- sourceReviewTypes.ts
- topicDiscoveryActions.ts
- BrandVoiceView.tsx
- Icps.ts
- briefActions.ts
- assist.test.ts
- llm.ts
- dependencies
- ContentList.tsx
- ArticleReview.tsx
- README.md
- NeedsRevisionPanel.tsx
- devDependencies
- ReportsPanel.tsx
- corpusSnapshots.int.spec.ts
- scripts
- reviewPanels.int.spec.ts
- EvidenceBank.ts
- llmSettings.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- src/fixtures.ts
- generatePrompt.ts
- generateStage.test.ts
- mockPages.ts
- findPublishedArticle.ts
- Template
- tenantPrompts.test.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- payloadClient.ts
- brandVoiceActions.ts
- RealAhrefsClient
- dependencies
- checkEvidenceRefs
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- Tenant context
- informationGainRuns.int.spec.ts
- evidenceBankToPrompt
- scripts
- ig-e2e.sh
- devDependencies
- Operations
- [...slug]/route.ts
- repository
- @payloadcms/db-postgres
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
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
1. `react` - 82 edges
2. `vitest` - 61 edges
3. `next` - 54 edges
4. `resolveWorkspaceProfile()` - 45 edges
5. `loadWorkspaceSetup()` - 32 edges
6. `Field()` - 31 edges
7. `Article` - 27 edges
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
- `Task 1: Remove `codex/*` end to end (L-1, L-2, F-013)` --references--> `providerForModel()`  [INFERRED]
  docs/superpowers/plans/2026-09-11-phase2-ui-workflow-polish.md → cms/src/lib/llmProvider.ts
- `Model, mock mode, and cost` --references--> `resolveSetupAssistModel()`  [INFERRED]
  docs/tenant-context.md → cms/src/lib/llmSettings.ts

## Import Cycles
- None detected.

## Communities (123 total, 9 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.07
Nodes (40): asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf(), EvidenceFindingRow (+32 more)

### Community 1 - "batching.ts"
Cohesion: 0.07
Nodes (27): DEFAULT_POLICY, excerptFoundIn(), keywordTokens(), nearDuplicateJaccard(), normaliseWhitespace(), STOPWORDS, tokenOverlap(), BaselineContextOptions (+19 more)

### Community 2 - "tenant.ts"
Cohesion: 0.11
Nodes (22): hasSectionContent(), PositioningEditor(), SECTION_KEYS, PositioningView(), loadAssistContext(), upsertEvidenceBank(), evidenceBankContentOf(), isEvidenceBankEmpty() (+14 more)

### Community 3 - "sitePages.int.spec.ts"
Cohesion: 0.11
Nodes (15): candidatePagePaths(), FetchedPageLike, hostKey(), isSameSite(), MAX_DISCOVERED_PAGES, MAX_SITE_PAGES, pathKey(), SITE_PAGE_PATH_PATTERN (+7 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (56): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+48 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.06
Nodes (39): internalDuplicationRate(), JudgeSignals, VerifierSignals, hostnameOf(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP, BaselineClaimSource (+31 more)

### Community 6 - "igPolicy.test.ts"
Cohesion: 0.07
Nodes (31): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), InformationGainPolicy (+23 more)

### Community 7 - "igScoring.test.ts"
Cohesion: 0.07
Nodes (30): compareValues(), clamp01(), clampImportance(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE, ratio() (+22 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (35): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT, directionCompatible() (+27 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.08
Nodes (42): BrandVoiceFiles, BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), BrandVoiceGuide() (+34 more)

### Community 10 - "qa/index.ts"
Cohesion: 0.09
Nodes (22): sumArticleCost(), qaStage, CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus (+14 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.11
Nodes (35): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SectionProps, ValuesSection() (+27 more)

### Community 13 - "payload.config.ts"
Cohesion: 0.06
Nodes (22): dirname, __filename, nextConfig, GET, OPTIONS, POST, EvidenceSourceCandidates, EvidenceSources (+14 more)

### Community 14 - "governanceAudit.ts"
Cohesion: 0.17
Nodes (16): GovernanceAudit, auditArticleChange(), AuditRequestContext, auditActor(), changedFieldsOf(), humanize(), auditGlobalChange(), auditGovernanceChange() (+8 more)

### Community 15 - "react"
Cohesion: 0.08
Nodes (31): importMap, Args, Args, Args, ArticleReviewView(), formatAuditTimestamp(), isScheduleExpired(), toBoardArticle() (+23 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.10
Nodes (28): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+20 more)

### Community 17 - "stages.ts"
Cohesion: 0.10
Nodes (17): PipelineStageName, EvidenceSourceRule, Article, InternalCorpusDoc, LlmClient, StageModels, ArticleStatus, RunPipelineOptions (+9 more)

### Community 18 - "tenantLib.test.ts"
Cohesion: 0.09
Nodes (17): HomePage(), WorkspaceProfile, ICP_FIXTURE_SECONDARY, clean(), Competitor, COMPETITOR_DOMAINS_ENV_VAR, competitorsFromDoc(), MOCK_COMPETITOR_DOMAINS (+9 more)

### Community 19 - "src/informationGain/index.ts"
Cohesion: 0.09
Nodes (23): DEFAULT_MAX_DRAFT_CLAIMS, CLAIM_TYPES, DraftClaim, CorpusSnapshot, VerificationCandidate, IG_COST_STAGES, informationGainStage, firstPartyMatches() (+15 more)

### Community 20 - "ref_payload"
Cohesion: 0.09
Nodes (19): StartContentRunInput, StartContentRunResult, loadSourceReviewArticles(), ActivePipelineRunError, createPipelineRun(), CreatePipelineRunInput, AFFECTED_PATHS, plural() (+11 more)

### Community 21 - "src/index.ts"
Cohesion: 0.14
Nodes (24): executeContentRun(), safeError(), PipelineRun, createAhrefsClient(), FetchContext, fetchTopics(), FetchTopicsOptions, FetchTopicsResult (+16 more)

### Community 22 - "loadWorkspaceReadiness.ts"
Cohesion: 0.20
Nodes (17): OnboardingDashboardView(), checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklist(), SetupChecklistData (+9 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "research.ts"
Cohesion: 0.08
Nodes (17): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), buildQueryCluster() (+9 more)

### Community 25 - "report.ts"
Cohesion: 0.07
Nodes (34): stageKpis(), Consolidation proposals, Content list, Findings, Globals rendered raw, How to read this, Journey map, Legacy removal list (+26 more)

### Community 26 - "seed.ts"
Cohesion: 0.08
Nodes (35): evidenceSources, heading(), Node, paragraph(), RichText, seed(), templates, TemplateSeed (+27 more)

### Community 27 - "[slug]/page.tsx"
Cohesion: 0.22
Nodes (11): generateMetadata(), Props, PublishedArticlePage(), revalidate, findPublishedArticle, escapeHtml(), lastH2HeadingText(), lexicalBodyToHtml() (+3 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.17
Nodes (35): gateIcpActivation(), IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), IcpDTO, activateDefaultBrandVoiceAction(), activateDefaultTenantAction() (+27 more)

### Community 29 - "auditTypes.ts"
Cohesion: 0.12
Nodes (21): ArticleAudit, CostLog, AuditTimelineEntry, auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult (+13 more)

### Community 30 - "icp.ts"
Cohesion: 0.11
Nodes (31): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_LEVELS, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf() (+23 more)

### Community 31 - "GlobalRunBar.tsx"
Cohesion: 0.13
Nodes (18): CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO, STAGE_PROGRESS (+10 more)

### Community 32 - "config.ts"
Cohesion: 0.11
Nodes (11): execute, all, extra, results, routes, viewports, buildConfig(), here (+3 more)

### Community 33 - "assist.ts"
Cohesion: 0.11
Nodes (30): applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, AssistMode, assistRules(), assistSectionKeys() (+22 more)

### Community 34 - "tenantActions.int.spec.ts"
Cohesion: 0.05
Nodes (26): GovernanceAudit, authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createRunMock (+18 more)

### Community 35 - "ahrefs.ts"
Cohesion: 0.11
Nodes (11): AhrefsClient, AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, MockAhrefsClient, OrganicKeywordRow, SerpPage (+3 more)

### Community 36 - "richtext.ts"
Cohesion: 0.10
Nodes (27): BRAND_VOICE_FIXTURE, bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks() (+19 more)

### Community 37 - "NewContentFlow.tsx"
Cohesion: 0.15
Nodes (14): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+6 more)

### Community 38 - "actions.ts"
Cohesion: 0.22
Nodes (23): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+15 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.12
Nodes (34): selectInternalCorpus(), BaselineClaim, QueryClusterEntry, Corpus snapshots, adopt(), articleText(), cachedClaims(), countUnverifiedExcerpts() (+26 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.07
Nodes (27): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+19 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.14
Nodes (24): Articles, SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(), ArticleAuditContext, CLEARED_INFORMATION_GAIN, freshJustification(), gateArchivedStatus(), gateReadOnlyStatus() (+16 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.10
Nodes (32): AuditTimeline(), Props, BrandVoiceEditor(), BrandVoiceReview(), clampQuestion(), contentOf(), EntryCards(), initialStep() (+24 more)

### Community 44 - "evidenceBank.test.ts"
Cohesion: 0.10
Nodes (9): evidenceBankSummary, expiredClaims(), incompleteClaims(), isClaimComplete(), MAX_PROMPT_CLAIMS, neverUseClaims(), verifiedClaimProblems(), What makes a claim usable (+1 more)

### Community 45 - "parsers.ts"
Cohesion: 0.09
Nodes (38): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+30 more)

### Community 46 - "review/index.ts"
Cohesion: 0.23
Nodes (19): sendBackAction(), isRunnableStatus(), ArchiveAction(), OpenInAdmin(), PANEL_FOR_STATUS, ApprovedPanel(), toUtcInputValue(), utcInputValueToIso() (+11 more)

### Community 47 - "evidenceBank.ts"
Cohesion: 0.16
Nodes (21): asArray(), asDay(), asRecord(), asString(), ClearedSurface, depthOf(), emptyEvidenceBankContent(), EvidenceRefCheck (+13 more)

### Community 48 - "workspaceReadiness.ts"
Cohesion: 0.10
Nodes (27): runtimeStatusAction(), LlmSettingsDoc, AssistContext, EvidenceBankContent, WORKSPACE_PROFILE_FIXTURE, IcpContent, icpIdOf(), selectIcp() (+19 more)

### Community 49 - "lib/informationGain/candidates.ts"
Cohesion: 0.18
Nodes (15): CANDIDATE_RANK, CandidateKind, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings(), modalBy(), SERP_SECONDARY_MIN_DR (+7 more)

### Community 50 - "qaStagePrompts.test.ts"
Cohesion: 0.12
Nodes (18): emptyTenantContext(), emptyPositioningContent(), LlmRequest, loadStyleGuide(), parseBannedPhrases(), namedOnly(), tenantFor(), withBank() (+10 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (16): Mock mode, ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS, FetchedPage (+8 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.08
Nodes (30): asRecord(), AssetStep, AssetStepper(), AssistConfig, Props, AssistPanel(), claimProblems(), DEPTH_LABEL (+22 more)

### Community 53 - "positioning.ts"
Cohesion: 0.20
Nodes (14): asArray(), asRecord(), asString(), evidenceRefOf(), Loose, OpenRulingStatus, parsePositioningContent(), PositioningClaim (+6 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewActions.ts"
Cohesion: 0.17
Nodes (18): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), errorMessage(), governanceAuditContext(), isQualityClass(), reopenCandidateAction() (+10 more)

### Community 56 - "setupActions.ts"
Cohesion: 0.20
Nodes (17): assistAction(), assistError(), AssistMode, AssistResult, governanceAuditContext(), pageWarning(), refreshSitePagesAction(), RefreshSitePagesResult (+9 more)

### Community 57 - "boardActions.ts"
Cohesion: 0.14
Nodes (21): queueRunAfterRework(), BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), requireUser(), runSelectedArticlesAction(), toRunFailures() (+13 more)

### Community 58 - "igCandidates.test.ts"
Cohesion: 0.11
Nodes (7): CandidateSighting, isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), Call

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "sourceReviewTypes.ts"
Cohesion: 0.15
Nodes (14): ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES, num() (+6 more)

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.23
Nodes (17): compact(), difficultyLabel(), Props, TopicDiscovery(), createTopicsAction(), discoverTopicsAction(), errorMessage(), isFresh() (+9 more)

### Community 62 - "BrandVoiceView.tsx"
Cohesion: 0.31
Nodes (8): BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), brandVoiceContentOf(), BrandVoice, loadActiveBrandVoice()

### Community 63 - "Icps.ts"
Cohesion: 0.10
Nodes (10): CascadeContext, Icps, ICP_FIXTURE, create(), createdArticleIds, createdIds, icpData(), read() (+2 more)

### Community 64 - "briefActions.ts"
Cohesion: 0.34
Nodes (13): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), errorMessage(), icpIdOf(), requireUser() (+5 more)

### Community 65 - "assist.test.ts"
Cohesion: 0.11
Nodes (16): AssistInput, ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS, AssistAsset, AssistInput, ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE (+8 more)

### Community 66 - "llm.ts"
Cohesion: 0.13
Nodes (18): costUsd(), Cost, mapWithConcurrency(), mockUsage, pickForVerification(), runVerifier(), completeJSON(), completeJSONAnthropic() (+10 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "ContentList.tsx"
Cohesion: 0.08
Nodes (34): isStalled(), OWNER_LABEL, STAGE_LABEL, StageInfo, stageOf(), ageLabel(), ContentList(), Filter (+26 more)

### Community 69 - "ArticleReview.tsx"
Cohesion: 0.19
Nodes (16): ArticleReview(), Props, BoardArticle, BriefEditor(), BriefIcpOption, Props, Section, ArticleBody() (+8 more)

### Community 71 - "NeedsRevisionPanel.tsx"
Cohesion: 0.33
Nodes (9): evidenceFindingsOf(), qaFailures(), EvidenceCard(), IgReasonsAside(), NeedsRevisionPanel(), CheckRow(), QaFailures(), QaTriage() (+1 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.12
Nodes (26): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+18 more)

### Community 74 - "corpusSnapshots.int.spec.ts"
Cohesion: 0.33
Nodes (4): CorpusSnapshots, internalCorpusSubfields, pagesSubfields, topLevelFields

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "reviewPanels.int.spec.ts"
Cohesion: 0.19
Nodes (15): InformationGainRunView, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags(), dec() (+7 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.20
Nodes (17): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), EvidenceBank, highestRefIn(), idOf(), Prefix (+9 more)

### Community 78 - "llmSettings.ts"
Cohesion: 0.06
Nodes (54): LlmSettings, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), ExtractionResult, mockExtraction() (+46 more)

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
Cohesion: 0.12
Nodes (17): Article status flow, Datum, Documentation, Environment variables, First run and making content, License, Pipeline and data integration, Pipeline mock mode (+9 more)

### Community 83 - "fetchPage.test.ts"
Cohesion: 0.12
Nodes (12): FETCH_MAX_BYTES, LookupFn, MAX_REDIRECTS, PAGE_TEXT_CAP_CHARS, ResolvedAddress, USER_AGENT, bodyOf(), encoder (+4 more)

### Community 84 - "src/fixtures.ts"
Cohesion: 0.12
Nodes (14): PipelineStage, ModelReadiness, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture, fixtures (+6 more)

### Community 85 - "generatePrompt.ts"
Cohesion: 0.10
Nodes (24): brandVoiceSamplesToPrompt(), evidenceRules(), Gap-fed generation, BriefDraft, BriefSection, BriefSectionSource, buildBrief(), clean() (+16 more)

### Community 86 - "generateStage.test.ts"
Cohesion: 0.14
Nodes (10): stripEvidenceRefs(), EvidenceCitation, extractEvidenceCitations(), GeneratedArticle, generateStage, sentencesOf(), RichText, article (+2 more)

### Community 87 - "mockPages.ts"
Cohesion: 0.13
Nodes (13): competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST, pathOf() (+5 more)

### Community 88 - "findPublishedArticle.ts"
Cohesion: 0.22
Nodes (8): metadata, metadataBase, buildArticleMetadata(), publicFields, PublishedArticle, getMetadataBase(), getSiteUrl(), article()

### Community 89 - "Template"
Cohesion: 0.27
Nodes (12): createTemplateAction(), requireUser(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigDTO (+4 more)

### Community 90 - "tenantPrompts.test.ts"
Cohesion: 0.14
Nodes (6): positioningToPrompt(), sentence(), term(), buildSystemPrompt(), ICP, POSITIONING

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 94 - "brandVoiceActions.ts"
Cohesion: 0.13
Nodes (26): activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), errorMessage(), extractBrandVoiceFromUploadAction(), governanceAuditContext(), requireUser() (+18 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "checkEvidenceRefs"
Cohesion: 0.25
Nodes (8): checkEvidenceRefs(), Evidence bank, Expiry, Information gain, Prompt size, Readiness, Refs, The QA evidence check

### Community 98 - "Contributing to Datum"
Cohesion: 0.20
Nodes (10): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+2 more)

### Community 99 - "open-source-checklist.md"
Cohesion: 0.20
Nodes (9): 1. Settings → General → Danger Zone → Change visibility → Public, 2. Settings → General → Features → enable Issues (and Discussions if desired), 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting, 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`, 5. Confirm SECURITY.md and advisories link work for the public repo, 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public, Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo., Complete these in the GitHub UI after merging open-source readiness changes: (+1 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 101 - "Tenant context"
Cohesion: 0.29
Nodes (6): Gating, How prompts use them, Positioning, Tenant context, The assets, The site crawl

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 103 - "evidenceBankToPrompt"
Cohesion: 0.40
Nodes (6): cleared(), evidenceBankToPrompt(), renderClaim(), renderFact(), sentence(), usableClaims()

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
Cohesion: 0.29
Nodes (6): Cache and revalidation, Fixed limits worth knowing, Job queues, Modes and money, Operations, Scheduled publishing

### Community 108 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 112 - "@payloadcms/db-postgres"
Cohesion: 0.05
Nodes (3): up(), migrations, @payloadcms/db-postgres

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

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
- **798 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+793 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1066 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `tenant.ts`, `lib/brandVoice.ts`, `Field`, `tenantLib.test.ts`, `loadWorkspaceReadiness.ts`, `[slug]/page.tsx`, `tenantActions.ts`, `auditTypes.ts`, `icp.ts`, `GlobalRunBar.tsx`, `NewContentFlow.tsx`, `cms/package.json`, `BrandVoiceEditor.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `sourceReviewActions.ts`, `topicDiscoveryActions.ts`, `BrandVoiceView.tsx`, `ContentList.tsx`, `ArticleReview.tsx`, `NeedsRevisionPanel.tsx`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `findPublishedArticle.ts`, `Template`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _798 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06914893617021277 - nodes in this community are weakly interconnected._
- **Why does `next` connect `react` to `tenant.ts`, `payload.config.ts`, `webhookDeliver.int.spec.ts`, `tenantLib.test.ts`, `ref_payload`, `loadWorkspaceReadiness.ts`, `[slug]/page.tsx`, `tenantActions.ts`, `auditTypes.ts`, `GlobalRunBar.tsx`, `NewContentFlow.tsx`, `actions.ts`, `cms/package.json`, `BrandVoiceEditor.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `sourceReviewActions.ts`, `setupActions.ts`, `boardActions.ts`, `topicDiscoveryActions.ts`, `BrandVoiceView.tsx`, `briefActions.ts`, `ContentList.tsx`, `ArticleReview.tsx`, `ReportsPanel.tsx`, `findPublishedArticle.ts`, `Template`, `brandVoiceActions.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `batching.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06859903381642513 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ref_payload` to `articleStatus.ts`, `tenant.ts`, `sitePages.int.spec.ts`, `lib/brandVoice.ts`, `payload.config.ts`, `governanceAudit.ts`, `InformationGainPolicy.ts`, `webhookDeliver.int.spec.ts`, `react`, `tenantLib.test.ts`, `loadWorkspaceReadiness.ts`, `auditTypes.ts`, `GlobalRunBar.tsx`, `config.ts`, `tenantActions.int.spec.ts`, `NewContentFlow.tsx`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `Icps.ts`, `assist.test.ts`, `ContentList.tsx`, `corpusSnapshots.int.spec.ts`, `reviewPanels.int.spec.ts`, `llmSettings.ts`, `findPublishedArticle.ts`, `brandVoiceActions.ts`, `informationGainRuns.int.spec.ts`, `@payloadcms/db-postgres`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `tenant.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1066066066066066 - nodes in this community are weakly interconnected._