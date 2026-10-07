# Graph Report - t3-97776b53  (2026-10-07)

## Corpus Check
- 431 files · ~1,027,062 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 2)

## Summary
- 3063 nodes · 8173 edges · 133 communities (120 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 315 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ead0a077`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- igText.test.ts
- loadWorkspaceReadiness.ts
- setupActions.ts
- payload-types.ts
- scorecard.ts
- src/index.ts
- tenantLib.test.ts
- exactness.ts
- lib/brandVoice.ts
- verdicts.ts
- pipeline/package.json
- Field
- ref_payload
- icp.ts
- next
- webhookDeliver.int.spec.ts
- ContentList.tsx
- igQueryCluster.test.ts
- passes.ts
- informationGain/types.ts
- collect.ts
- DESIGN.md
- LlmProvider
- report.ts
- cmsLlm.ts
- tenant/fixtures.ts
- tenantActions.ts
- llm.ts
- topicDiscoveryActions.ts
- seedContentOps.ts
- capture.mjs
- generatePrompt.ts
- igPrompts.test.ts
- ahrefs.ts
- richtext.ts
- RunBarProvider.tsx
- requireUser
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- evidenceBank.ts
- parsers.ts
- review/index.ts
- stages.ts
- react
- resolveWorkspaceProfile
- workspaceReadiness.ts
- fetchPage.ts
- EvidenceBankEditor.tsx
- payloadClient.ts
- package.json
- sourceReviewTypes.ts
- llmSettings.ts
- topicRelevance.ts
- igCandidates.test.ts
- compilerOptions
- evidenceBank.test.ts
- lib/informationGain/index.ts
- briefActions.ts
- sourceReviewActions.ts
- src/informationGain/candidates.ts
- assist.ts
- ref_node_assert
- dependencies
- boardActions.ts
- queueRunForArticles.ts
- README.md
- [slug]/page.tsx
- devDependencies
- ReportsPanel.tsx
- ArticleReview.tsx
- scripts
- TemplateConfigEditor.tsx
- EvidenceBank.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- tenant.ts
- InformationGainPolicy.ts
- mockPages.ts
- admin.e2e.spec.ts
- Findings
- models.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- cms_src_components_ops_ops
- brandVoiceActions.ts
- createPipelineRun.ts
- dependencies
- Evidence bank
- Contributing to Datum
- brief.ts
- Agent instructions
- EvidenceSourceCandidates.ts
- next.config.ts
- positioning.ts
- scripts
- ig-e2e.sh
- open-source-checklist.md
- Operations
- lexicalHtml.ts
- repository
- BrandVoiceGuide.tsx
- EvidenceBankView.tsx
- Releasing
- informationGainRuns.int.spec.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- Global Constraints
- vitest
- repository
- eslint.config.mjs
- auditTypes.ts
- evidenceBankSummary
- @payloadcms/db-postgres
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- [...slug]/route.ts
- tenantActions.int.spec.ts
- bugs
- engines

## God Nodes (most connected - your core abstractions)
1. `react` - 84 edges
2. `vitest` - 63 edges
3. `next` - 57 edges
4. `requireUser()` - 57 edges
5. `resolveWorkspaceProfile()` - 46 edges
6. `errorMessage()` - 38 edges
7. `loadWorkspaceSetup()` - 32 edges
8. `Field()` - 31 edges
9. `Article` - 30 edges
10. `@payloadcms/db-postgres` - 26 edges

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

## Communities (133 total, 13 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.07
Nodes (38): asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf(), EvidenceFindingRow (+30 more)

### Community 1 - "igText.test.ts"
Cohesion: 0.18
Nodes (5): keywordTokens(), nearDuplicateJaccard(), selectInternalCorpus(), STOPWORDS, tokenOverlap()

### Community 2 - "loadWorkspaceReadiness.ts"
Cohesion: 0.18
Nodes (21): OnboardingDashboardView(), checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklist(), SetupChecklistData (+13 more)

### Community 3 - "setupActions.ts"
Cohesion: 0.07
Nodes (35): asRecord(), AssetStepper(), AssistConfig, Props, assistAction(), assistError(), AssistInput, AssistMode (+27 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.03
Nodes (61): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+53 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.05
Nodes (42): internalDuplicationRate(), JudgeSignals, InformationGainPolicy, clamp01(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE (+34 more)

### Community 6 - "src/index.ts"
Cohesion: 0.13
Nodes (26): executeContentRun(), safeError(), Policy and evidence sources are run-scoped, createAhrefsClient(), loadActiveBrandVoice(), FetchContext, fetchTopics(), FetchTopicsOptions (+18 more)

### Community 7 - "tenantLib.test.ts"
Cohesion: 0.07
Nodes (19): WorkspaceProfile, findActiveIcps(), loadTenantContextCms(), clean(), Competitor, COMPETITOR_DOMAINS_ENV_VAR, competitorsFromDoc(), MOCK_COMPETITOR_DOMAINS (+11 more)

### Community 8 - "exactness.ts"
Cohesion: 0.05
Nodes (45): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+37 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.07
Nodes (41): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), toData(), AudienceSection() (+33 more)

### Community 10 - "verdicts.ts"
Cohesion: 0.13
Nodes (20): CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision, EvidenceFindingStatus (+12 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.08
Nodes (24): bugs, url, description, devDependencies, tsx, @types/node, typescript, engines (+16 more)

### Community 12 - "Field"
Cohesion: 0.11
Nodes (35): AssetStep, AdjectivesSection(), NotTraitsSection(), SamplesSection(), ValuesSection(), WordsSection(), ConfidenceSelect(), BoundariesSection() (+27 more)

### Community 13 - "ref_payload"
Cohesion: 0.05
Nodes (33): GET, OPTIONS, POST, BrandVoiceFiles, GovernanceAudit, Icps, Media, PipelineRuns (+25 more)

### Community 14 - "icp.ts"
Cohesion: 0.12
Nodes (30): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_LEVELS, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf() (+22 more)

### Community 15 - "next"
Cohesion: 0.12
Nodes (21): HomePage(), importMap, Args, Args, Args, ArticleReviewView(), formatAuditTimestamp(), isScheduleExpired() (+13 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (26): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+18 more)

### Community 17 - "ContentList.tsx"
Cohesion: 0.08
Nodes (36): isStalled(), OWNER_LABEL, STAGE_LABEL, StageInfo, stageOf(), plural(), removeTopicsAction(), runSelectedArticlesAction() (+28 more)

### Community 18 - "igQueryCluster.test.ts"
Cohesion: 0.24
Nodes (4): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT

### Community 19 - "passes.ts"
Cohesion: 0.07
Nodes (38): VerifierSignals, DEFAULT_POLICY, DraftClaim, Claims nobody checked, Cost, Scoring a draft, What is written, mapWithConcurrency() (+30 more)

### Community 20 - "informationGain/types.ts"
Cohesion: 0.06
Nodes (40): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+32 more)

### Community 21 - "collect.ts"
Cohesion: 0.09
Nodes (53): saveBrandVoiceDraftAction(), SetupSuggestions(), SuggestionEditorContext(), suggestionLabel(), SuggestionRow(), acceptSuggestionAction(), dismissSuggestionAction(), refresh() (+45 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "LlmProvider"
Cohesion: 0.40
Nodes (5): ExtractionResult, CmsLlmResult, LlmModel, LlmProvider, LlmResult

### Community 25 - "report.ts"
Cohesion: 0.15
Nodes (17): articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate(), ReasonLike (+9 more)

### Community 26 - "cmsLlm.ts"
Cohesion: 0.09
Nodes (20): CmsCostStage, CmsLlmRequest, cmsMockMode(), completeJsonCms(), logCmsCost(), parseBool(), parseJsonReply(), LLM_CATALOG (+12 more)

### Community 27 - "tenant/fixtures.ts"
Cohesion: 0.10
Nodes (27): ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE, ICP_FIXTURE, ICP_FIXTURE_SECONDARY, POSITIONING_FIXTURE, WORKSPACE_PROFILE_FIXTURE, LlmSetting (+19 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.10
Nodes (35): CascadeContext, gateIcpActivation(), activateBrandVoiceAction(), IcpEditor(), IcpReview(), mergeAssist(), activateDefaultBrandVoiceAction(), activateDefaultTenantAction() (+27 more)

### Community 29 - "llm.ts"
Cohesion: 0.09
Nodes (28): PipelineStage, ModelReadiness, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture, fixtures (+20 more)

### Community 30 - "topicDiscoveryActions.ts"
Cohesion: 0.18
Nodes (21): compact(), difficultyLabel(), Props, TopicDiscovery(), cachedCandidates(), createTopicsAction(), discoverTopicsAction(), isFresh() (+13 more)

### Community 31 - "seedContentOps.ts"
Cohesion: 0.20
Nodes (16): ids, user, deliveries, Delivery, seededIds, seededIds, cleanupOpsUser(), ensureRunReadiness() (+8 more)

### Community 32 - "capture.mjs"
Cohesion: 0.15
Nodes (6): execute, all, extra, results, routes, viewports

### Community 33 - "generatePrompt.ts"
Cohesion: 0.08
Nodes (38): BrandVoiceContent, brandVoiceSamplesToPrompt(), companyMentionsOf(), evidenceRules(), isEvidenceBankEmpty(), IcpContent, TenantContext, positioningToPrompt() (+30 more)

### Community 34 - "igPrompts.test.ts"
Cohesion: 0.09
Nodes (21): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), DEFAULT_MAX_DRAFT_CLAIMS (+13 more)

### Community 35 - "ahrefs.ts"
Cohesion: 0.08
Nodes (14): AhrefsClient, AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, MockAhrefsClient, opportunityScore(), OrganicKeywordRow (+6 more)

### Community 36 - "richtext.ts"
Cohesion: 0.10
Nodes (30): Template, repoRoot, bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations() (+22 more)

### Community 37 - "RunBarProvider.tsx"
Cohesion: 0.39
Nodes (5): RunBarProvider(), RuntimeBanner(), runtimeStatusAction(), mocks, show()

### Community 38 - "requireUser"
Cohesion: 0.14
Nodes (34): archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction(), publishArticleAction() (+26 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.09
Nodes (41): parsePageClaims(), excerptFoundIn(), BaselineClaim, QueryClusterEntry, userAgentFor(), find(), Baseline claims and facets, Corpus snapshots (+33 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (25): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+17 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.13
Nodes (31): SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(), ArticleAuditContext, auditArticleChange(), AuditRequestContext, emitArticleStatusEvent(), CLEARED_INFORMATION_GAIN, freshJustification() (+23 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.08
Nodes (40): AuditTimelineEntry, AuditTimeline(), Props, archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), BrandVoiceEditor(), BrandVoiceReview() (+32 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.19
Nodes (20): asArray(), asDay(), asRecord(), asString(), depthOf(), emptyEvidenceBankContent(), evidenceBankToPrompt(), EvidenceRefCheck (+12 more)

### Community 45 - "parsers.ts"
Cohesion: 0.16
Nodes (27): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+19 more)

### Community 46 - "review/index.ts"
Cohesion: 0.24
Nodes (16): approveArticleAction(), ArchiveAction(), OpenInAdmin(), PANEL_FOR_STATUS, ArchivedPanel(), BriefPanel(), PublishedPanel(), ReviewDecisionPanel() (+8 more)

### Community 47 - "stages.ts"
Cohesion: 0.08
Nodes (20): PipelineStageName, Article, EvidenceCitation, GeneratedArticle, generateStage, LlmClient, LlmRequest, StageModels (+12 more)

### Community 48 - "react"
Cohesion: 0.13
Nodes (19): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+11 more)

### Community 49 - "resolveWorkspaceProfile"
Cohesion: 0.16
Nodes (19): emptyTenantContext(), resolveWorkspaceProfile(), loadStyleGuide(), parseBannedPhrases(), loadWorkspaceProfile(), context(), namedOnly(), tenantFor() (+11 more)

### Community 50 - "workspaceReadiness.ts"
Cohesion: 0.08
Nodes (28): AssistContext, EvidenceBankContent, icpIdOf(), selectIcp(), tenantFingerprint(), PositioningContent, ResolvedWorkspaceProfile, WorkspaceProfileSource (+20 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (17): normaliseWhitespace(), ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS, FetchedPage (+9 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.13
Nodes (17): AssistPanel(), DEPTH_LABEL, SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankDraft, EvidenceBankInput (+9 more)

### Community 53 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.16
Nodes (13): ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES, num() (+5 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.15
Nodes (23): LlmSettings, DEFAULT_MODEL, LLM_MODEL_OPTIONS, money(), PROVIDER_LABEL, clean(), EXTRACTION_ENV_VAR, LLM_SETTING_FIELDS (+15 more)

### Community 57 - "topicRelevance.ts"
Cohesion: 0.22
Nodes (21): scoreTopicRelevance(), emptyPositioningContent(), audienceVocabulary(), buildTopicRelevancePrompt(), cachedTopicRelevance(), distinctiveStems(), excludedVerdict(), exclusionWords() (+13 more)

### Community 58 - "igCandidates.test.ts"
Cohesion: 0.10
Nodes (15): CANDIDATE_RANK, CandidateClass, CandidateKind, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, modalBy(), SERP_SECONDARY_MIN_DR (+7 more)

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 61 - "lib/informationGain/index.ts"
Cohesion: 0.10
Nodes (16): VerifierEvidence, EvidenceSourceRule, hostnameOf(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP, QualitySource, SourceQualityClass (+8 more)

### Community 62 - "briefActions.ts"
Cohesion: 0.19
Nodes (20): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+12 more)

### Community 63 - "sourceReviewActions.ts"
Cohesion: 0.15
Nodes (17): EvidenceSources, ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus() (+9 more)

### Community 64 - "src/informationGain/candidates.ts"
Cohesion: 0.23
Nodes (8): CandidateSighting, mergeSightings(), isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), Call

### Community 65 - "assist.ts"
Cohesion: 0.11
Nodes (30): applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS, AssistInput (+22 more)

### Community 66 - "ref_node_assert"
Cohesion: 0.12
Nodes (9): BRAND_VOICE_FIXTURE, PIPELINE_STAGES, emptyIcpContent(), mockUsage, allowed, option, template, ICP (+1 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "boardActions.ts"
Cohesion: 0.11
Nodes (22): BoardActionResult, latestRunAction(), CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress() (+14 more)

### Community 69 - "queueRunForArticles.ts"
Cohesion: 0.23
Nodes (10): isRunnableStatus(), ActivePipelineRunError, createPipelineRun(), AFFECTED_PATHS, plural(), queueRunForArticles(), Content runs, Phase 2: UI and workflow polish Implementation Plan (+2 more)

### Community 70 - "README.md"
Cohesion: 0.24
Nodes (3): cms, Useful scripts (from `cms/` or `npm run … --workspace cms`), Setup suggestions

### Community 71 - "[slug]/page.tsx"
Cohesion: 0.16
Nodes (11): generateMetadata(), Props, revalidate, metadata, metadataBase, buildArticleMetadata(), findPublishedArticle, publicFields (+3 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.12
Nodes (26): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+18 more)

### Community 74 - "ArticleReview.tsx"
Cohesion: 0.11
Nodes (26): ArticleReview(), Props, BoardArticle, InformationGainRunView, ScorecardClaim, TemplateOption, AuditSummary, PANEL_FOR_KEY (+18 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "TemplateConfigEditor.tsx"
Cohesion: 0.21
Nodes (15): Templates, createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView() (+7 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.24
Nodes (15): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), EvidenceBank, highestRefIn(), idOf(), Prefix (+7 more)

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

### Community 85 - "tenant.ts"
Cohesion: 0.14
Nodes (10): clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh(), buildConfig(), config, here (+2 more)

### Community 86 - "InformationGainPolicy.ts"
Cohesion: 0.27
Nodes (6): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS

### Community 87 - "mockPages.ts"
Cohesion: 0.13
Nodes (13): competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST, pathOf() (+5 more)

### Community 88 - "admin.e2e.spec.ts"
Cohesion: 0.22
Nodes (6): login(), LoginOptions, cleanupTestUser(), seedTestUser(), testUser, @playwright/test

### Community 89 - "Findings"
Cohesion: 0.12
Nodes (16): Consolidation proposals, Content list, Findings, Globals rendered raw, How to read this, Journey map, Legacy removal list, Navigation and information architecture (+8 more)

### Community 90 - "models.ts"
Cohesion: 0.29
Nodes (9): apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement, requirementForModel(), loadStageModels() (+1 more)

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "cms_src_components_ops_ops"
Cohesion: 0.22
Nodes (5): ExtraOpsNavLinks(), NavLink, Section, SECTIONS, SecretField()

### Community 94 - "brandVoiceActions.ts"
Cohesion: 0.11
Nodes (27): extractBrandVoiceFromUploadAction(), UPLOAD_MIMETYPES, UploadExtractResult, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel() (+19 more)

### Community 95 - "createPipelineRun.ts"
Cohesion: 0.06
Nodes (30): CreatePipelineRunInput, WorkspaceReadiness, authMock, countMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findByIDMock, findMock, updateMock (+22 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "Evidence bank"
Cohesion: 0.22
Nodes (9): claimProblems(), verifiedClaimProblems(), Evidence bank, Expiry, Information gain, Prompt size, Readiness, Refs (+1 more)

### Community 98 - "Contributing to Datum"
Cohesion: 0.18
Nodes (11): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+3 more)

### Community 99 - "brief.ts"
Cohesion: 0.12
Nodes (19): InformationGap, Global Constraints, Task 1: Split "Not our user" from churn triggers, Task 3: AI-proposed brief angles, BriefAngleOption, BriefDraft, BriefSection, BriefSectionSource (+11 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 102 - "next.config.ts"
Cohesion: 0.33
Nodes (3): dirname, __filename, nextConfig

### Community 103 - "positioning.ts"
Cohesion: 0.10
Nodes (27): hasSectionContent(), PositioningEditor(), SECTION_KEYS, POSITIONING_SECTION_COMPONENTS, POSITIONING_STEPS, PositioningStepId, PositioningView(), loadAssistContext() (+19 more)

### Community 104 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, fetch, report, run, test, typecheck

### Community 105 - "ig-e2e.sh"
Cohesion: 0.42
Nodes (8): assert_eq(), assert_ge(), assert_ne(), info(), log(), ig-e2e.sh script, probe(), value_of()

### Community 106 - "open-source-checklist.md"
Cohesion: 0.20
Nodes (9): 1. Settings → General → Danger Zone → Change visibility → Public, 2. Settings → General → Features → enable Issues (and Discussions if desired), 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting, 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`, 5. Confirm SECURITY.md and advisories link work for the public repo, 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public, Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo., Complete these in the GitHub UI after merging open-source readiness changes: (+1 more)

### Community 107 - "Operations"
Cohesion: 0.29
Nodes (6): Cache and revalidation, Fixed limits worth knowing, Job queues, Modes and money, Operations, Scheduled publishing

### Community 108 - "lexicalHtml.ts"
Cohesion: 0.36
Nodes (8): PublishedArticlePage(), escapeHtml(), lastH2HeadingText(), lexicalBodyToHtml(), lexicalToPlainText(), LexNode, RichText, textOf()

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "BrandVoiceGuide.tsx"
Cohesion: 0.43
Nodes (6): BrandVoiceGuide(), downloadMarkdown(), Empty(), Props, brandVoiceSlug(), TONE_DIALS

### Community 111 - "EvidenceBankView.tsx"
Cohesion: 0.57
Nodes (5): EvidenceBankEditor(), EvidenceBankView(), emptyEvidenceBankDraft(), loadSuggestionForEditor(), suggestionDTO()

### Community 112 - "Releasing"
Cohesion: 0.50
Nodes (4): Hand-edit policy, How it works, One-time repository settings, Releasing

### Community 114 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 117 - "Global Constraints"
Cohesion: 0.20
Nodes (10): OpenRulingStatus, read(), Global Constraints, Task 12: Save-and-activate for audiences, one cost aggregation (F-007, C-6), Task 13: Docs, env examples and public site (2D: F-038, F-039, F-040, C-7 docs half, L-11 docs), Task 1: Remove `codex/*` end to end (L-1, L-2, F-013), Task 2: Delete dead routes, files, exports and unreachable branches (L-3 to L-9, L-11), Task 7: Onboarding gates and New content readiness (F-003, F-006, F-008, F-009, F-017, F-019, F-041) (+2 more)

### Community 118 - "vitest"
Cohesion: 0.08
Nodes (13): Articles, CorpusSnapshots, ARTICLE_STATUSES, internalCorpusSubfields, pagesSubfields, topLevelFields, { graphql }, authMock (+5 more)

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 121 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 122 - "auditTypes.ts"
Cohesion: 0.13
Nodes (19): ArticleAudit, CostLog, auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, auditEventLabel() (+11 more)

### Community 124 - "evidenceBankSummary"
Cohesion: 0.20
Nodes (14): checkEvidenceRefs(), cleared(), evidenceBankSummary, expired(), expiredClaims(), incompleteClaims(), isClaimComplete(), neverUseClaims() (+6 more)

### Community 128 - "@payloadcms/db-postgres"
Cohesion: 0.04
Nodes (3): up(), migrations, @payloadcms/db-postgres

### Community 138 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 146 - "tenantActions.int.spec.ts"
Cohesion: 0.25
Nodes (3): GovernanceAudit, authStub, createdIcpIds

## Knowledge Gaps
- **824 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+819 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1111 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `@payloadcms/db-postgres`, `loadWorkspaceReadiness.ts`, `setupActions.ts`, `tenantLib.test.ts`, `lib/brandVoice.ts`, `ref_payload`, `webhookDeliver.int.spec.ts`, `ContentList.tsx`, `tenantActions.int.spec.ts`, `cmsLlm.ts`, `tenant/fixtures.ts`, `capture.mjs`, `RunBarProvider.tsx`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `react`, `sourceReviewTypes.ts`, `llmSettings.ts`, `sourceReviewActions.ts`, `boardActions.ts`, `[slug]/page.tsx`, `ArticleReview.tsx`, `tenant.ts`, `InformationGainPolicy.ts`, `cms_src_components_ops_ops`, `brandVoiceActions.ts`, `createPipelineRun.ts`, `EvidenceSourceCandidates.ts`, `positioning.ts`, `informationGainRuns.int.spec.ts`, `auditTypes.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _824 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07123034227567067 - nodes in this community are weakly interconnected._
- **Why does `@payloadcms/db-postgres` connect `@payloadcms/db-postgres` to `ReportsPanel.tsx`, `cms/package.json`, `ref_payload`, `createPipelineRun.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `setupActions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06857142857142857 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `articleStatus.ts`, `loadWorkspaceReadiness.ts`, `setupActions.ts`, `lib/brandVoice.ts`, `Field`, `icp.ts`, `next`, `ContentList.tsx`, `collect.ts`, `tenantActions.ts`, `topicDiscoveryActions.ts`, `RunBarProvider.tsx`, `requireUser`, `cms/package.json`, `BrandVoiceEditor.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `briefActions.ts`, `sourceReviewActions.ts`, `boardActions.ts`, `[slug]/page.tsx`, `ReportsPanel.tsx`, `ArticleReview.tsx`, `TemplateConfigEditor.tsx`, `cms_src_components_ops_ops`, `positioning.ts`, `BrandVoiceGuide.tsx`, `EvidenceBankView.tsx`, `auditTypes.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `payload-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03278688524590164 - nodes in this community are weakly interconnected._