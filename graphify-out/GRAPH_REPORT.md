# Graph Report - datum  (2026-10-06)

## Corpus Check
- 400 files · ~1,004,061 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 3, .example 2)

## Summary
- 2876 nodes · 7426 edges · 130 communities (118 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 251 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b6db4620`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- ref_node_assert
- loadWorkspaceReadiness.ts
- sitePages.int.spec.ts
- payload-types.ts
- scorecard.ts
- igPolicy.test.ts
- stages.ts
- exactness.ts
- lib/brandVoice.ts
- qa/index.ts
- pipeline/package.json
- Field
- ref_payload
- Information gain (VMIG)
- importMap.js
- webhookDeliver.int.spec.ts
- boardActions.ts
- tenantLib.test.ts
- passes.ts
- queueRunForArticles.ts
- src/index.ts
- seedContentOps.ts
- DESIGN.md
- igPrompts.test.ts
- report.ts
- brandVoiceExtract.ts
- resolveWorkspaceProfile
- tenantActions.ts
- llm.ts
- icp.ts
- seed.ts
- config.ts
- models.ts
- sourceReviewActions.int.spec.ts
- ahrefs.ts
- richtext.ts
- NewContentFlow.tsx
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- evidenceBank.ts
- parsers.ts
- review/index.ts
- src/fixtures.ts
- workspaceReadiness.ts
- lib/informationGain/candidates.ts
- qaStagePrompts.test.ts
- fetchPage.ts
- EvidenceBankEditor.tsx
- positioning.ts
- package.json
- sourceReviewTypes.ts
- llmSettings.ts
- sourceReviewActions.ts
- igCandidates.test.ts
- compilerOptions
- evidenceBank.test.ts
- topicDiscoveryActions.ts
- [slug]/page.tsx
- icps.int.spec.ts
- BrandVoiceView.tsx
- setupActions.ts
- NeedsRevisionPanel.tsx
- dependencies
- react
- ArticleReview.tsx
- README.md
- next
- devDependencies
- ReportsPanel.tsx
- Scorecard.tsx
- scripts
- ArticleReviewView.tsx
- EvidenceBank.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- generatePrompt.ts
- InformationGainPolicy.ts
- mockPages.ts
- workspaceProfile.int.spec.ts
- runContext.ts
- lib/llmProvider.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- [...slug]/route.ts
- extractText.ts
- briefActions.int.spec.ts
- dependencies
- Evidence bank
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- lib/informationGain/index.ts
- informationGainRuns.int.spec.ts
- lib/pricing.ts
- scripts
- ig-e2e.sh
- devDependencies
- Operations
- fetchTopics.ts
- repository
- vitest
- SetupWorkspaceEditor.tsx
- @payloadcms/db-postgres
- next.config.ts
- briefActions.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- (frontend)/layout.tsx
- Quick start
- PinnedDispatcher
- repository
- reviewPanels.int.spec.ts
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- tenant.ts
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
10. `StageContext` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Setup asset editors` --references--> `AssetStepper()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/AssetStepper.tsx
- `Webhooks` --references--> `verifyWebhookSignature()`  [INFERRED]
  docs/operations.md → cms/src/jobs/webhookDeliver.ts
- `4. Settings → Branches → protect `main`: require PR + require CI status check `ci`` --references--> `main()`  [INFERRED]
  docs/open-source-checklist.md → pipeline/src/index.ts
- `Supported versions` --references--> `main()`  [INFERRED]
  SECURITY.md → pipeline/src/index.ts
- `Onboarding` --references--> `checklistRows()`  [INFERRED]
  docs/audits/2026-09-11-ui-workflow-audit.md → cms/src/components/ops/SetupChecklist.tsx

## Import Cycles
- None detected.

## Communities (130 total, 12 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.07
Nodes (36): asRecord(), asRecordArray(), asStringSet(), CHECK_LABEL, DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf() (+28 more)

### Community 1 - "ref_node_assert"
Cohesion: 0.07
Nodes (10): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT, keywordTokens(), nearDuplicateJaccard(), STOPWORDS, tokenOverlap() (+2 more)

### Community 2 - "loadWorkspaceReadiness.ts"
Cohesion: 0.11
Nodes (24): OnboardingDashboardView(), checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklist(), SetupChecklistData (+16 more)

### Community 3 - "sitePages.int.spec.ts"
Cohesion: 0.11
Nodes (18): pageWarning(), refreshSitePagesAction(), candidatePagePaths(), FetchedPageLike, hostKey(), isSameSite(), MAX_DISCOVERED_PAGES, MAX_SITE_PAGES (+10 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (55): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+47 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.05
Nodes (53): internalDuplicationRate(), JudgeSignals, VerifierSignals, PolicyCode, clamp01(), clampImportance(), estimateTokens(), evidenceFloorFor() (+45 more)

### Community 6 - "igPolicy.test.ts"
Cohesion: 0.07
Nodes (28): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), InformationGainPolicy (+20 more)

### Community 7 - "stages.ts"
Cohesion: 0.07
Nodes (23): PipelineStageName, stripEvidenceRefs(), Article, InternalCorpusDoc, EvidenceCitation, extractEvidenceCitations(), GeneratedArticle, generateStage (+15 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (31): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT, directionCompatible() (+23 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.08
Nodes (41): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), BrandVoiceGuide(), downloadMarkdown() (+33 more)

### Community 10 - "qa/index.ts"
Cohesion: 0.09
Nodes (22): sumArticleCost(), qaStage, CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus (+14 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.12
Nodes (34): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SectionProps, ValuesSection() (+26 more)

### Community 13 - "ref_payload"
Cohesion: 0.07
Nodes (22): ArticleAudit, Articles, BrandVoiceFiles, CorpusSnapshots, CostLog, Media, PipelineRuns, Templates (+14 more)

### Community 14 - "Information gain (VMIG)"
Cohesion: 0.08
Nodes (22): compareValues(), extractValues(), EvidenceSourceRule, hostnameOf(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP, QualitySource (+14 more)

### Community 15 - "importMap.js"
Cohesion: 0.10
Nodes (13): importMap, Args, Args, GET, OPTIONS, POST, Args, inPersistBand() (+5 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (27): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+19 more)

### Community 17 - "boardActions.ts"
Cohesion: 0.09
Nodes (32): OWNER_LABEL, BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), runSelectedArticlesAction(), toRunFailures(), ageLabel() (+24 more)

### Community 18 - "tenantLib.test.ts"
Cohesion: 0.10
Nodes (10): capAssistConfidence(), workspaceProfileToPrompt(), AI assist, Model, mock mode, and cost, Sections, What it never does, What it reads, buildSystemPrompt() (+2 more)

### Community 19 - "passes.ts"
Cohesion: 0.07
Nodes (41): DEFAULT_POLICY, DraftClaim, Cost, SerpResearch, mapWithConcurrency(), BaselineContextOptions, batchFacetId(), chunk() (+33 more)

### Community 20 - "queueRunForArticles.ts"
Cohesion: 0.13
Nodes (19): StartContentRunInput, StartContentRunResult, ActivePipelineRunError, createPipelineRun(), CreatePipelineRunInput, AFFECTED_PATHS, plural(), queueRunForArticles() (+11 more)

### Community 21 - "src/index.ts"
Cohesion: 0.13
Nodes (17): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], CliArgs, main(), parseArgs() (+9 more)

### Community 22 - "seedContentOps.ts"
Cohesion: 0.15
Nodes (19): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+11 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "igPrompts.test.ts"
Cohesion: 0.09
Nodes (22): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), DEFAULT_MAX_DRAFT_CLAIMS (+14 more)

### Community 25 - "report.ts"
Cohesion: 0.15
Nodes (17): articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate(), ReasonLike (+9 more)

### Community 26 - "brandVoiceExtract.ts"
Cohesion: 0.15
Nodes (17): BrandVoiceContent, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), ExtractionResult, logExtractionCost() (+9 more)

### Community 27 - "resolveWorkspaceProfile"
Cohesion: 0.16
Nodes (23): HomePage(), SetupWorkspaceEditor(), SetupWorkspaceView(), runtimeStatusAction(), saveWorkspaceProfileAction(), emptyPositioningContent(), clean(), Competitor (+15 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.09
Nodes (37): CascadeContext, gateIcpActivation(), formatAuditTimestamp(), IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), IcpListView() (+29 more)

### Community 29 - "llm.ts"
Cohesion: 0.14
Nodes (19): CmsCostStage, CmsLlmRequest, CmsLlmResult, parseBool(), parseJsonReply(), LlmModel, LlmProvider, PipelineStage (+11 more)

### Community 30 - "icp.ts"
Cohesion: 0.08
Nodes (33): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_LEVELS, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf() (+25 more)

### Community 31 - "seed.ts"
Cohesion: 0.15
Nodes (16): evidenceBankFixtureDoc(), positioningFixtureDoc(), evidenceSources, heading(), Node, paragraph(), RichText, seed() (+8 more)

### Community 32 - "config.ts"
Cohesion: 0.10
Nodes (13): execute, all, extra, results, routes, viewports, buildConfig(), here (+5 more)

### Community 33 - "models.ts"
Cohesion: 0.33
Nodes (5): LlmSettingsDoc, PIPELINE_STAGES, ResolvedModel, loadStageModels(), StageModelDeps

### Community 34 - "sourceReviewActions.int.spec.ts"
Cohesion: 0.29
Nodes (5): authMock, createMock, findByIDMock, findMock, updateMock

### Community 35 - "ahrefs.ts"
Cohesion: 0.10
Nodes (11): AhrefsClient, AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, MockAhrefsClient, opportunityScore(), OrganicKeywordRow (+3 more)

### Community 36 - "richtext.ts"
Cohesion: 0.11
Nodes (25): bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks(), StructuralCheckOptions (+17 more)

### Community 37 - "NewContentFlow.tsx"
Cohesion: 0.15
Nodes (16): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+8 more)

### Community 38 - "actions.ts"
Cohesion: 0.18
Nodes (29): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+21 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.10
Nodes (43): parsePageClaims(), excerptFoundIn(), selectInternalCorpus(), BaselineClaim, InformationGap, userAgentFor(), CorpusSnapshot, Baseline claims and facets (+35 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.06
Nodes (31): eslintConfig, bugs, url, description, engines, node, homepage, @anthropic-ai/sdk (+23 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.06
Nodes (58): auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, AuditSource, SCORE_INVALIDATED_EVENT, scoreInvalidatedFields() (+50 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.09
Nodes (40): AuditTimelineEntry, AuditTimeline(), Props, activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), saveBrandVoiceDraftAction() (+32 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.15
Nodes (29): asArray(), asDay(), asRecord(), asString(), checkEvidenceRefs(), cleared(), depthOf(), emptyEvidenceBankContent() (+21 more)

### Community 45 - "parsers.ts"
Cohesion: 0.09
Nodes (37): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+29 more)

### Community 46 - "review/index.ts"
Cohesion: 0.25
Nodes (14): isRunnableStatus(), ArchiveAction(), OpenInAdmin(), PANEL_FOR_STATUS, ArchivedPanel(), BriefPanel(), PublishedPanel(), ReviewDecisionPanel() (+6 more)

### Community 47 - "src/fixtures.ts"
Cohesion: 0.14
Nodes (12): draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture, fixtures, FixtureTable, generateFixture (+4 more)

### Community 48 - "workspaceReadiness.ts"
Cohesion: 0.10
Nodes (24): AssistContext, EvidenceBankContent, IcpContent, icpIdOf(), selectIcp(), TenantContext, tenantFingerprint(), PositioningContent (+16 more)

### Community 49 - "lib/informationGain/candidates.ts"
Cohesion: 0.12
Nodes (19): CANDIDATE_RANK, CandidateClass, CandidateKind, CandidateSighting, isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings(), modalBy() (+11 more)

### Community 50 - "qaStagePrompts.test.ts"
Cohesion: 0.13
Nodes (16): emptyTenantContext(), LlmRequest, loadStyleGuide(), article, ctxWith(), GENERATED, template, article() (+8 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.14
Nodes (11): normaliseWhitespace(), ALLOWED_PROTOCOLS, Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS, FetchedPage, HTML_CONTENT_TYPES (+3 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.12
Nodes (21): AssistPanel(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankView() (+13 more)

### Community 53 - "positioning.ts"
Cohesion: 0.20
Nodes (15): asArray(), asRecord(), asString(), evidenceRefOf(), Loose, parsePositioningContent(), PositioningClaim, PositioningDescriptor (+7 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.14
Nodes (15): loadSourceReviewArticles(), ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES (+7 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.19
Nodes (17): LlmSettings, DEFAULT_MODEL, LLM_MODEL_OPTIONS, money(), PROVIDER_LABEL, clean(), EXTRACTION_ENV_VAR, LLM_SETTING_FIELDS (+9 more)

### Community 57 - "sourceReviewActions.ts"
Cohesion: 0.18
Nodes (15): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), Badges() (+7 more)

### Community 58 - "igCandidates.test.ts"
Cohesion: 0.14
Nodes (6): collectCandidateSightings(), matchesDomain(), matchEvidenceRule(), normaliseDomain(), The source review queue, collect()

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.22
Nodes (16): compact(), difficultyLabel(), Props, TopicDiscovery(), createTopicsAction(), discoverTopicsAction(), isFresh(), recentSearchesAction() (+8 more)

### Community 62 - "[slug]/page.tsx"
Cohesion: 0.22
Nodes (10): generateMetadata(), Props, PublishedArticlePage(), revalidate, buildArticleMetadata(), findPublishedArticle, publicFields, PublishedArticle (+2 more)

### Community 63 - "icps.int.spec.ts"
Cohesion: 0.16
Nodes (9): GovernanceAudit, Icps, GovernanceSubject, hook, create(), createdArticleIds, createdIds, icpData() (+1 more)

### Community 64 - "BrandVoiceView.tsx"
Cohesion: 0.31
Nodes (8): BrandVoiceAuditEntry, BrandVoiceMode, BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), BrandVoice

### Community 65 - "setupActions.ts"
Cohesion: 0.07
Nodes (50): assistAction(), assistError(), AssistInput, AssistMode, AssistResult, RefreshSitePagesResult, logCmsCost(), applyEvidenceRules() (+42 more)

### Community 66 - "NeedsRevisionPanel.tsx"
Cohesion: 0.33
Nodes (9): evidenceFindingsOf(), qaFailures(), EvidenceCard(), IgReasonsAside(), NeedsRevisionPanel(), CheckRow(), QaFailures(), QaTriage() (+1 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "react"
Cohesion: 0.10
Nodes (23): CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO, STAGE_PROGRESS (+15 more)

### Community 69 - "ArticleReview.tsx"
Cohesion: 0.13
Nodes (20): ArticleReview(), Props, BoardArticle, isStalled(), NEXT_STAGE_VERB_FOR_STATUS, STAGE_LABEL, StageInfo, stageOf() (+12 more)

### Community 71 - "next"
Cohesion: 0.25
Nodes (13): createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView(), TemplateConfigDTO (+5 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.13
Nodes (25): BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel(), ReportsView() (+17 more)

### Community 74 - "Scorecard.tsx"
Cohesion: 0.28
Nodes (13): InformationGainRunView, ScorecardClaim, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+5 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "ArticleReviewView.tsx"
Cohesion: 0.31
Nodes (9): ArticleReviewView(), isScheduleExpired(), toBoardArticle(), escapeHtml(), lastH2HeadingText(), lexicalBodyToHtml(), LexNode, RichText (+1 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.22
Nodes (16): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), highestRefIn(), idOf(), Prefix, REF_FIELD (+8 more)

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
Cohesion: 0.15
Nodes (13): Article status flow, Datum, Documentation, Environment variables, License, Pipeline and data integration, Prerequisites, Root scripts (+5 more)

### Community 83 - "fetchPage.test.ts"
Cohesion: 0.12
Nodes (12): FETCH_MAX_BYTES, LookupFn, MAX_REDIRECTS, PAGE_TEXT_CAP_CHARS, ResolvedAddress, USER_AGENT, bodyOf(), encoder (+4 more)

### Community 85 - "generatePrompt.ts"
Cohesion: 0.08
Nodes (30): brandVoiceSamplesToPrompt(), evidenceRules(), isEvidenceBankEmpty(), Gap-fed generation, BriefDraft, BriefSection, BriefSectionSource, buildBrief() (+22 more)

### Community 86 - "InformationGainPolicy.ts"
Cohesion: 0.24
Nodes (7): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS, PolicyFieldDef

### Community 87 - "mockPages.ts"
Cohesion: 0.13
Nodes (13): competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST, pathOf() (+5 more)

### Community 88 - "workspaceProfile.int.spec.ts"
Cohesion: 0.22
Nodes (4): WorkspaceProfile, COMPETITOR_DOMAINS_ENV_VAR, MOCK_TARGET_DOMAIN, TARGET_DOMAIN_ENV_VAR

### Community 89 - "runContext.ts"
Cohesion: 0.32
Nodes (10): executeContentRun(), safeError(), PipelineRun, Policy and evidence sources are run-scoped, loadEvidenceSources(), loadInformationGainPolicy(), createLlmClient(), buildStageContext() (+2 more)

### Community 90 - "lib/llmProvider.ts"
Cohesion: 0.51
Nodes (7): apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement, requirementForModel()

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 94 - "extractText.ts"
Cohesion: 0.17
Nodes (15): extractBrandVoiceFromUploadAction(), detectKind(), docxToText(), ExtractedKind, ExtractedText, extractText(), hideArrayPrototypePollution(), MAX_EXTRACT_CHARS (+7 more)

### Community 95 - "briefActions.int.spec.ts"
Cohesion: 0.11
Nodes (13): authMock, createRunMock, edits, findByIDMock, ICPS, setupMock, updateMock, readiness() (+5 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "Evidence bank"
Cohesion: 0.20
Nodes (10): claimProblems(), verifiedClaimProblems(), Evidence bank, Expiry, Information gain, Prompt size, Readiness, Refs (+2 more)

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
Cohesion: 0.27
Nodes (4): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 103 - "lib/pricing.ts"
Cohesion: 0.33
Nodes (5): LLM_CATALOG, costUsd(), LEGACY_PRICES, PRICES, warnedModels

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

### Community 108 - "fetchTopics.ts"
Cohesion: 0.38
Nodes (5): FetchContext, fetchTopics(), FetchTopicsOptions, FetchTopicsResult, sentenceCase()

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "vitest"
Cohesion: 0.09
Nodes (10): evaluateWorkspaceReadiness(), GovernanceAudit, privateCollections, privateGlobals, ids, { graphql }, runIds, authStub (+2 more)

### Community 111 - "SetupWorkspaceEditor.tsx"
Cohesion: 0.11
Nodes (16): asRecord(), AssetStep, AssetStepper(), AssistConfig, Props, ExtraOpsNavLinks(), NavLink, Section (+8 more)

### Community 112 - "@payloadcms/db-postgres"
Cohesion: 0.05
Nodes (3): up(), migrations, @payloadcms/db-postgres

### Community 113 - "next.config.ts"
Cohesion: 0.33
Nodes (3): dirname, __filename, nextConfig

### Community 114 - "briefActions.ts"
Cohesion: 0.20
Nodes (18): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+10 more)

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 118 - "Quick start"
Cohesion: 0.50
Nodes (4): First run and making content, Pipeline mock mode, Quick start, Seeded local admin

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 122 - "reviewPanels.int.spec.ts"
Cohesion: 0.22
Nodes (11): auditEventLabel(), AuditSummary, AuditRow, AuditTrail(), groupAuditEvents(), money(), RunGroup(), TimelineEntry() (+3 more)

### Community 138 - "tenant.ts"
Cohesion: 0.15
Nodes (15): hasSectionContent(), PositioningEditor(), SECTION_KEYS, PositioningView(), loadAssistContext(), savePositioningAction(), upsertPositioning(), Positioning (+7 more)

### Community 149 - "Findings"
Cohesion: 0.12
Nodes (15): Content list, Findings, Globals rendered raw, How to read this, Journey map, Legacy removal list, Navigation and information architecture, New content (+7 more)

## Knowledge Gaps
- **798 isolated node(s):** `article`, `claims`, `EvidenceCitationRow`, `EvidenceFindingRow`, `QaFailure` (+793 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1066 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `loadWorkspaceReadiness.ts`, `sitePages.int.spec.ts`, `lib/brandVoice.ts`, `tenant.ts`, `ref_payload`, `webhookDeliver.int.spec.ts`, `boardActions.ts`, `queueRunForArticles.ts`, `brandVoiceExtract.ts`, `config.ts`, `sourceReviewActions.int.spec.ts`, `NewContentFlow.tsx`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `llmSettings.ts`, `[slug]/page.tsx`, `icps.int.spec.ts`, `setupActions.ts`, `react`, `ArticleReview.tsx`, `ReportsPanel.tsx`, `InformationGainPolicy.ts`, `workspaceProfile.int.spec.ts`, `briefActions.int.spec.ts`, `lib/informationGain/index.ts`, `informationGainRuns.int.spec.ts`, `SetupWorkspaceEditor.tsx`, `@payloadcms/db-postgres`, `reviewPanels.int.spec.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `article`, `claims`, `EvidenceCitationRow` to the rest of the system?**
  _798 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0673758865248227 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `loadWorkspaceReadiness.ts`, `lib/brandVoice.ts`, `tenant.ts`, `Field`, `importMap.js`, `boardActions.ts`, `resolveWorkspaceProfile`, `tenantActions.ts`, `icp.ts`, `NewContentFlow.tsx`, `actions.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `sourceReviewActions.ts`, `topicDiscoveryActions.ts`, `[slug]/page.tsx`, `BrandVoiceView.tsx`, `NeedsRevisionPanel.tsx`, `ArticleReview.tsx`, `next`, `ReportsPanel.tsx`, `Scorecard.tsx`, `ArticleReviewView.tsx`, `SetupWorkspaceEditor.tsx`, `briefActions.ts`, `(frontend)/layout.tsx`, `reviewPanels.int.spec.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `ref_node_assert` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `loadWorkspaceReadiness.ts`, `tenant.ts`, `importMap.js`, `webhookDeliver.int.spec.ts`, `boardActions.ts`, `queueRunForArticles.ts`, `resolveWorkspaceProfile`, `tenantActions.ts`, `NewContentFlow.tsx`, `actions.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `review/index.ts`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `sourceReviewActions.ts`, `topicDiscoveryActions.ts`, `[slug]/page.tsx`, `BrandVoiceView.tsx`, `setupActions.ts`, `react`, `ArticleReview.tsx`, `ReportsPanel.tsx`, `ArticleReviewView.tsx`, `SetupWorkspaceEditor.tsx`, `next.config.ts`, `briefActions.ts`, `(frontend)/layout.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `loadWorkspaceReadiness.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._