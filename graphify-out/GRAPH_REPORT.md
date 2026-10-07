# Graph Report - t3-97776b53  (2026-10-07)

## Corpus Check
- 402 files · ~1,006,531 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 2)

## Summary
- 2899 nodes · 7502 edges · 149 communities (119 shown, 30 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 254 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2dceecd7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- igText.test.ts
- loadWorkspaceSetup
- sitePages.int.spec.ts
- payload-types.ts
- scorecard.ts
- informationGain/types.ts
- stages.ts
- exactness.ts
- lib/brandVoice.ts
- qa/index.ts
- pipeline/package.json
- Field
- ref_payload
- igFixtures.test.ts
- next
- webhookDeliver.int.spec.ts
- ContentList.tsx
- tenantLib.test.ts
- passes.ts
- boardActions.ts
- src/index.ts
- seedContentOps.ts
- DESIGN.md
- src/informationGain/index.ts
- report.ts
- brandVoiceExtract.ts
- tenant/fixtures.ts
- tenantActions.ts
- llm.ts
- icp.ts
- seed.ts
- capture.mjs
- igScoring.test.ts
- governanceAudit.ts
- ahrefs.ts
- richtext.ts
- NewContentFlow.tsx
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- requireUser
- evidenceBank.ts
- parsers.ts
- react
- ref_node_assert
- workspaceReadiness.ts
- src/informationGain/candidates.ts
- resolveWorkspaceProfile
- fetchPage.ts
- EvidenceBankEditor.tsx
- positioning.ts
- package.json
- sourceReviewTypes.ts
- llmSettings.ts
- errorMessage
- compilerOptions
- evidenceBank.test.ts
- topicDiscoveryActions.ts
- [slug]/page.tsx
- icps.int.spec.ts
- research.ts
- setupActions.ts
- brandVoice.int.spec.ts
- dependencies
- GlobalRunBar.tsx
- ArticleReview.tsx
- README.md
- Template
- devDependencies
- ReportsPanel.tsx
- Scorecard.tsx
- scripts
- lib/informationGain/candidates.ts
- EvidenceBank.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- generatePrompt.ts
- InformationGainPolicy.ts
- mockPages.ts
- icpSections.tsx
- contentRun.ts
- models.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- [...slug]/route.ts
- extractText.ts
- briefActions.int.spec.ts
- dependencies
- evidenceBankSummary
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- lib/informationGain/index.ts
- informationGainRuns.int.spec.ts
- evidenceBank.int.spec.ts
- scripts
- ig-e2e.sh
- devDependencies
- Operations
- BrandVoiceGuide.tsx
- repository
- igQueryCluster.test.ts
- SetupWorkspaceEditor.tsx
- @payloadcms/db-postgres
- payloadClient.ts
- briefActions.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- corpusSnapshots.int.spec.ts
- SourceReviewView.tsx
- migrations/index.ts
- repository
- eslint.config.mjs
- auditTypes.ts
- 20260826_015027_existing_schema_baseline.ts
- SourceQualityClass
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- runContext.ts
- bugs
- engines

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
10. `@payloadcms/db-postgres` - 23 edges

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

## Communities (149 total, 30 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.07
Nodes (46): ArticleReviewView(), asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf() (+38 more)

### Community 1 - "igText.test.ts"
Cohesion: 0.18
Nodes (5): keywordTokens(), nearDuplicateJaccard(), selectInternalCorpus(), STOPWORDS, tokenOverlap()

### Community 2 - "loadWorkspaceSetup"
Cohesion: 0.22
Nodes (16): OnboardingDashboardView(), checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklist(), SetupChecklistData (+8 more)

### Community 3 - "sitePages.int.spec.ts"
Cohesion: 0.11
Nodes (18): pageWarning(), refreshSitePagesAction(), candidatePagePaths(), FetchedPageLike, hostKey(), isSameSite(), MAX_DISCOVERED_PAGES, MAX_SITE_PAGES (+10 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (55): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+47 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.07
Nodes (32): internalDuplicationRate(), JudgeSignals, VerifierSignals, EvidenceSourceRule, hostnameOf(), matchesDomain(), resolveSourceQuality(), SOURCE_QUALITY_SCORE (+24 more)

### Community 6 - "informationGain/types.ts"
Cohesion: 0.06
Nodes (35): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+27 more)

### Community 7 - "stages.ts"
Cohesion: 0.10
Nodes (15): PipelineStageName, Article, InternalCorpusDoc, informationGainStage, StageModels, ArticleStatus, RunPipelineOptions, RunPipelineResult (+7 more)

### Community 8 - "exactness.ts"
Cohesion: 0.09
Nodes (27): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT, directionCompatible(), MONTH_SRC (+19 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.16
Nodes (18): asArray(), asRecord(), asString(), bannedWordsOf(), BrandVoiceGuideMeta, brandVoiceToPrompt(), bullet(), clampDial() (+10 more)

### Community 10 - "qa/index.ts"
Cohesion: 0.09
Nodes (22): sumArticleCost(), qaStage, CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus (+14 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.14
Nodes (25): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SECTION_COMPONENTS, SectionProps (+17 more)

### Community 13 - "ref_payload"
Cohesion: 0.06
Nodes (28): dirname, __filename, nextConfig, OPTIONS, POST, ArticleAudit, BrandVoiceFiles, CostLog (+20 more)

### Community 14 - "igFixtures.test.ts"
Cohesion: 0.07
Nodes (29): comparativeOf(), compareValues(), directionOf(), ExtractedValue, extractValues(), TextValues, fixture(), Claims nobody checked (+21 more)

### Community 15 - "next"
Cohesion: 0.08
Nodes (20): importMap, Args, Args, GET, Args, ExtraOpsNavLinks(), NavLink, Section (+12 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (26): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+18 more)

### Community 17 - "ContentList.tsx"
Cohesion: 0.10
Nodes (26): OWNER_LABEL, ageLabel(), ContentList(), Filter, FILTER_LABEL, FILTERS, Props, active (+18 more)

### Community 18 - "tenantLib.test.ts"
Cohesion: 0.10
Nodes (9): capAssistConfidence(), workspaceProfileToPrompt(), AI assist, Model, mock mode, and cost, Sections, What it never does, What it reads, icp() (+1 more)

### Community 19 - "passes.ts"
Cohesion: 0.07
Nodes (43): DEFAULT_POLICY, DraftClaim, Cost, SerpResearch, config, mapWithConcurrency(), BaselineContextOptions, batchFacetId() (+35 more)

### Community 20 - "boardActions.ts"
Cohesion: 0.09
Nodes (29): BoardActionResult, plural(), removeTopicsAction(), runSelectedArticlesAction(), ActivePipelineRunError, createPipelineRun(), CreatePipelineRunInput, AFFECTED_PATHS (+21 more)

### Community 21 - "src/index.ts"
Cohesion: 0.23
Nodes (11): CliArgs, main(), parseArgs(), resolveTemplateId(), usage(), ReportPeriod, describeFailures(), Hand-edit policy (+3 more)

### Community 22 - "seedContentOps.ts"
Cohesion: 0.14
Nodes (22): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+14 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "src/informationGain/index.ts"
Cohesion: 0.11
Nodes (14): DEFAULT_MAX_DRAFT_CLAIMS, CLAIM_TYPES, IG_COST_STAGES, baselineClaimBrief(), DRAFT_CLAIM_EXTRACTION_SYSTEM, draftClaimUser(), facetBrief(), JUDGE_SYSTEM (+6 more)

### Community 25 - "report.ts"
Cohesion: 0.15
Nodes (18): stageKpis(), articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate() (+10 more)

### Community 26 - "brandVoiceExtract.ts"
Cohesion: 0.11
Nodes (25): BrandVoiceContent, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), ExtractionResult, logExtractionCost() (+17 more)

### Community 27 - "tenant/fixtures.ts"
Cohesion: 0.09
Nodes (18): AssistInput, ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE, ICP_FIXTURE, POSITIONING_FIXTURE, WORKSPACE_PROFILE_FIXTURE, LlmSetting (+10 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.13
Nodes (32): gateIcpActivation(), AssetStep, IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), ICP_STEPS, IcpDTO (+24 more)

### Community 29 - "llm.ts"
Cohesion: 0.09
Nodes (28): CmsLlmResult, LlmModel, LlmProvider, PipelineStage, ModelReadiness, CostLog, draftClaimsFixture, evidenceCheckFixture (+20 more)

### Community 30 - "icp.ts"
Cohesion: 0.12
Nodes (30): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_LEVELS, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf() (+22 more)

### Community 31 - "seed.ts"
Cohesion: 0.14
Nodes (16): ICP_FIXTURE_SECONDARY, positioningFixtureDoc(), evidenceSources, heading(), Node, paragraph(), RichText, seed() (+8 more)

### Community 32 - "capture.mjs"
Cohesion: 0.15
Nodes (6): execute, all, extra, results, routes, viewports

### Community 33 - "igScoring.test.ts"
Cohesion: 0.10
Nodes (20): InformationGainPolicy, clamp01(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE, ratio(), relevanceFromQueries() (+12 more)

### Community 34 - "governanceAudit.ts"
Cohesion: 0.12
Nodes (14): GovernanceAudit, CascadeContext, auditArticleChange(), AuditRequestContext, auditActor(), changedFieldsOf(), humanize(), auditGlobalChange() (+6 more)

### Community 35 - "ahrefs.ts"
Cohesion: 0.10
Nodes (12): AhrefsClient, AhrefsClientOptions, AhrefsProfile, createAhrefsClient(), GapKeyword, MatchingTermRow, MockAhrefsClient, opportunityScore() (+4 more)

### Community 36 - "richtext.ts"
Cohesion: 0.10
Nodes (30): bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks(), StructuralCheckOptions (+22 more)

### Community 37 - "NewContentFlow.tsx"
Cohesion: 0.13
Nodes (18): startContentRunAction(), StartContentRunInput, StartContentRunResult, ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow() (+10 more)

### Community 38 - "actions.ts"
Cohesion: 0.16
Nodes (28): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+20 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.10
Nodes (35): BaselineClaim, QueryClusterEntry, userAgentFor(), CorpusSnapshot, Corpus snapshots, adopt(), articleText(), cachedClaims() (+27 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (24): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+16 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.12
Nodes (26): Articles, SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(), ArticleAuditContext, CLEARED_INFORMATION_GAIN, freshJustification(), gateArchivedStatus(), gateReadOnlyStatus() (+18 more)

### Community 43 - "requireUser"
Cohesion: 0.08
Nodes (48): AuditTimelineEntry, AuditTimeline(), Props, activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), extractBrandVoiceFromUploadAction() (+40 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.18
Nodes (21): asArray(), asDay(), asRecord(), asString(), depthOf(), emptyEvidenceBankContent(), evidenceBankToPrompt(), EvidenceRefCheck (+13 more)

### Community 45 - "parsers.ts"
Cohesion: 0.15
Nodes (29): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+21 more)

### Community 46 - "react"
Cohesion: 0.17
Nodes (25): evidenceFindingsOf(), qaFailures(), revisitBriefAction(), ArchiveAction(), OpenInAdmin(), EvidenceCard(), PANEL_FOR_STATUS, ArchivedPanel() (+17 more)

### Community 47 - "ref_node_assert"
Cohesion: 0.10
Nodes (10): buildConfig(), here, parseBool(), PipelineConfig, repoRoot, LlmRequest, article, GENERATED (+2 more)

### Community 48 - "workspaceReadiness.ts"
Cohesion: 0.07
Nodes (32): HomePage(), IcpOption, PipelineRunSummary, AssistContext, EvidenceBankContent, IcpContent, icpIdOf(), selectIcp() (+24 more)

### Community 49 - "src/informationGain/candidates.ts"
Cohesion: 0.24
Nodes (7): mergeSightings(), isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), Call

### Community 50 - "resolveWorkspaceProfile"
Cohesion: 0.12
Nodes (25): emptyTenantContext(), clean(), Competitor, COMPETITOR_DOMAINS_ENV_VAR, competitorsFromDoc(), MOCK_COMPETITOR_DOMAINS, normaliseDomain(), parseCompetitorDomainsEnv() (+17 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (17): normaliseWhitespace(), Mock mode, ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS (+9 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.13
Nodes (20): AssistPanel(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankView() (+12 more)

### Community 53 - "positioning.ts"
Cohesion: 0.16
Nodes (18): asArray(), asRecord(), asString(), emptyPositioningContent(), evidenceRefOf(), Loose, OpenRulingStatus, parsePositioningContent() (+10 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.13
Nodes (14): ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES, num() (+6 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.18
Nodes (18): LlmSettings, DEFAULT_MODEL, LLM_CATALOG, LLM_MODEL_OPTIONS, money(), PROVIDER_LABEL, clean(), EXTRACTION_ENV_VAR (+10 more)

### Community 57 - "errorMessage"
Cohesion: 0.23
Nodes (14): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), Badges() (+6 more)

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "evidenceBank.test.ts"
Cohesion: 0.09
Nodes (9): evidenceRefsIn(), MAX_PROMPT_CLAIMS, stripEvidenceRefs(), EvidenceCitation, extractEvidenceCitations(), GeneratedArticle, generateStage, sentencesOf() (+1 more)

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.24
Nodes (15): compact(), difficultyLabel(), Props, TopicDiscovery(), createTopicsAction(), discoverTopicsAction(), isFresh(), recentSearchesAction() (+7 more)

### Community 62 - "[slug]/page.tsx"
Cohesion: 0.16
Nodes (12): generateMetadata(), Props, PublishedArticlePage(), revalidate, metadata, metadataBase, buildArticleMetadata(), findPublishedArticle (+4 more)

### Community 63 - "icps.int.spec.ts"
Cohesion: 0.20
Nodes (8): Icps, create(), createdArticleIds, createdIds, icpData(), read(), Shared code graph, Task 8: One nav, one surface per asset, masked secret (C-1, C-2, F-001, F-002, F-014, F-015, F-016, F-034, F-035)

### Community 64 - "research.ts"
Cohesion: 0.12
Nodes (13): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), Facet (+5 more)

### Community 65 - "setupActions.ts"
Cohesion: 0.10
Nodes (39): assistAction(), assistError(), AssistInput, AssistMode, AssistResult, loadAssistContext(), RefreshSitePagesResult, applyEvidenceRules() (+31 more)

### Community 66 - "brandVoice.int.spec.ts"
Cohesion: 0.18
Nodes (13): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), brandVoiceActivationProblems(), brandVoiceContentOf() (+5 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "GlobalRunBar.tsx"
Cohesion: 0.06
Nodes (38): latestRunAction(), CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO (+30 more)

### Community 69 - "ArticleReview.tsx"
Cohesion: 0.16
Nodes (16): ArticleReview(), Props, BoardArticle, STAGE_LABEL, StageInfo, stageOf(), TemplateOption, PipelineStepper() (+8 more)

### Community 71 - "Template"
Cohesion: 0.16
Nodes (23): Templates, createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView() (+15 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.12
Nodes (27): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+19 more)

### Community 74 - "Scorecard.tsx"
Cohesion: 0.33
Nodes (11): InformationGainRunView, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags(), dec() (+3 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "lib/informationGain/candidates.ts"
Cohesion: 0.19
Nodes (14): CANDIDATE_RANK, CandidateClass, CandidateKind, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, modalBy(), SERP_SECONDARY_MIN_DR (+6 more)

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
Cohesion: 0.12
Nodes (17): Article status flow, Datum, Documentation, Environment variables, First run and making content, License, Pipeline and data integration, Pipeline mock mode (+9 more)

### Community 83 - "fetchPage.test.ts"
Cohesion: 0.12
Nodes (12): FETCH_MAX_BYTES, LookupFn, MAX_REDIRECTS, PAGE_TEXT_CAP_CHARS, ResolvedAddress, USER_AGENT, bodyOf(), encoder (+4 more)

### Community 85 - "generatePrompt.ts"
Cohesion: 0.07
Nodes (33): brandVoiceSamplesToPrompt(), evidenceRules(), Gap-fed generation, Company mentions, How prompts use them, The brief in review, Which description of the reader wins, BriefDraft (+25 more)

### Community 86 - "InformationGainPolicy.ts"
Cohesion: 0.24
Nodes (7): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS, PolicyFieldDef

### Community 87 - "mockPages.ts"
Cohesion: 0.12
Nodes (14): MOCK_TARGET_DOMAIN, competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST (+6 more)

### Community 88 - "icpSections.tsx"
Cohesion: 0.24
Nodes (12): ConfidenceSelect(), BoundariesSection(), ChannelsSection(), CompetitionSection(), ICP_SECTION_COMPONENTS, IcpSectionProps, MotivationSection(), PainsSection() (+4 more)

### Community 89 - "contentRun.ts"
Cohesion: 0.26
Nodes (10): executeContentRun(), safeError(), PipelineRun, FetchContext, fetchTopics(), FetchTopicsOptions, FetchTopicsResult, sentenceCase() (+2 more)

### Community 90 - "models.ts"
Cohesion: 0.23
Nodes (12): apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement, requirementForModel(), LlmSettingsDoc (+4 more)

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
Cohesion: 0.15
Nodes (14): detectKind(), docxToText(), ExtractedKind, ExtractedText, extractText(), hideArrayPrototypePollution(), MAX_EXTRACT_CHARS, MIME_KINDS (+6 more)

### Community 95 - "briefActions.int.spec.ts"
Cohesion: 0.07
Nodes (23): authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createRunMock, edits (+15 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "evidenceBankSummary"
Cohesion: 0.16
Nodes (17): claimProblems(), checkEvidenceRefs(), cleared(), evidenceBankSummary, expired(), incompleteClaims(), isClaimComplete(), usableClaims() (+9 more)

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
Cohesion: 0.16
Nodes (5): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES, { graphql }

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 103 - "evidenceBank.int.spec.ts"
Cohesion: 0.21
Nodes (6): EvidenceBank, clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh()

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
Cohesion: 0.33
Nodes (5): Cache and revalidation, Fixed limits worth knowing, Modes and money, Operations, Webhooks

### Community 108 - "BrandVoiceGuide.tsx"
Cohesion: 0.29
Nodes (9): BrandVoiceGuide(), downloadMarkdown(), Empty(), Props, brandVoiceSlug(), brandVoiceToGuideMarkdown(), cell(), dialBar() (+1 more)

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "igQueryCluster.test.ts"
Cohesion: 0.24
Nodes (4): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT

### Community 111 - "SetupWorkspaceEditor.tsx"
Cohesion: 0.13
Nodes (23): asRecord(), AssetStepper(), AssistConfig, hasSectionContent(), Props, PositioningEditor(), SECTION_KEYS, PositioningView() (+15 more)

### Community 113 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 114 - "briefActions.ts"
Cohesion: 0.21
Nodes (17): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+9 more)

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 117 - "corpusSnapshots.int.spec.ts"
Cohesion: 0.33
Nodes (4): CorpusSnapshots, internalCorpusSubfields, pagesSubfields, topLevelFields

### Community 118 - "SourceReviewView.tsx"
Cohesion: 0.70
Nodes (3): loadSourceReviewArticles(), SourceReviewQueue(), SourceReviewView()

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 121 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 122 - "auditTypes.ts"
Cohesion: 0.14
Nodes (20): auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, auditEventLabel(), AuditSource, AuditSummary (+12 more)

### Community 124 - "SourceQualityClass"
Cohesion: 0.67
Nodes (3): CandidateSighting, VerifierEvidence, SourceQualityClass

### Community 138 - "runContext.ts"
Cohesion: 0.39
Nodes (7): Policy and evidence sources are run-scoped, loadActiveBrandVoice(), loadEvidenceSources(), loadInformationGainPolicy(), loadStageInputs(), loadTenantContext(), loadWorkspaceProfile()

## Knowledge Gaps
- **800 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+795 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1076 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `articleStatus.ts`, `loadWorkspaceSetup`, `ref_payload`, `ContentList.tsx`, `boardActions.ts`, `tenantActions.ts`, `NewContentFlow.tsx`, `actions.ts`, `cms/package.json`, `requireUser`, `react`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `errorMessage`, `topicDiscoveryActions.ts`, `[slug]/page.tsx`, `setupActions.ts`, `GlobalRunBar.tsx`, `ArticleReview.tsx`, `Template`, `ReportsPanel.tsx`, `SetupWorkspaceEditor.tsx`, `briefActions.ts`, `SourceReviewView.tsx`, `auditTypes.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _800 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06641604010025062 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ref_payload` to `articleStatus.ts`, `loadWorkspaceSetup`, `sitePages.int.spec.ts`, `next`, `webhookDeliver.int.spec.ts`, `ContentList.tsx`, `boardActions.ts`, `brandVoiceExtract.ts`, `tenant/fixtures.ts`, `capture.mjs`, `governanceAudit.ts`, `NewContentFlow.tsx`, `cms/package.json`, `articleReviewGate.ts`, `requireUser`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `llmSettings.ts`, `[slug]/page.tsx`, `icps.int.spec.ts`, `brandVoice.int.spec.ts`, `GlobalRunBar.tsx`, `InformationGainPolicy.ts`, `briefActions.int.spec.ts`, `lib/informationGain/index.ts`, `informationGainRuns.int.spec.ts`, `evidenceBank.int.spec.ts`, `corpusSnapshots.int.spec.ts`, `auditTypes.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `sitePages.int.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10591133004926108 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `articleStatus.ts`, `loadWorkspaceSetup`, `Field`, `next`, `ContentList.tsx`, `tenantActions.ts`, `icp.ts`, `NewContentFlow.tsx`, `actions.ts`, `cms/package.json`, `requireUser`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `errorMessage`, `topicDiscoveryActions.ts`, `[slug]/page.tsx`, `GlobalRunBar.tsx`, `ArticleReview.tsx`, `Template`, `ReportsPanel.tsx`, `Scorecard.tsx`, `icpSections.tsx`, `BrandVoiceGuide.tsx`, `SetupWorkspaceEditor.tsx`, `briefActions.ts`, `SourceReviewView.tsx`, `auditTypes.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `payload-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._