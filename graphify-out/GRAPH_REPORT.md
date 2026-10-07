# Graph Report - t3-97776b53  (2026-10-07)

## Corpus Check
- 431 files · ~1,029,140 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 2)

## Summary
- 3069 nodes · 8192 edges · 157 communities (124 shown, 33 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 315 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ce36da3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- igScoring.test.ts
- loadWorkspaceReadiness.ts
- setupActions.ts
- payload-types.ts
- scorecard.ts
- fetchTopics.ts
- tenantLib.test.ts
- exactness.ts
- lib/brandVoice.ts
- verdicts.ts
- pipeline/package.json
- Field
- ref_payload
- icp.ts
- importMap.js
- webhookDeliver.int.spec.ts
- ContentList.tsx
- igQueryCluster.test.ts
- passes.ts
- informationGain/types.ts
- collect.ts
- DESIGN.md
- next
- report.ts
- cmsLlm.ts
- tenant/fixtures.ts
- IcpEditor.tsx
- llm.ts
- topicDiscoveryActions.ts
- seedContentOps.ts
- tenantActions.ts
- generatePrompt.ts
- Facet
- createAhrefsClient
- qa/index.ts
- SetupWorkspaceEditor.tsx
- requireUser
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- evidenceBank.ts
- parsers.ts
- briefActions.ts
- stages.ts
- NewContentFlow.tsx
- llmSettlement.test.ts
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
- igSourceQuality.test.ts
- react
- brandVoice.int.spec.ts
- reviewPanels.int.spec.ts
- assist.ts
- tenant.ts
- dependencies
- GlobalRunBar.tsx
- boardActions.ts
- README.md
- articleMetadata.int.spec.ts
- devDependencies
- ReportsPanel.tsx
- Scorecard.tsx
- scripts
- TemplateConfigEditor.tsx
- EvidenceBank.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- evidenceBank.int.spec.ts
- InformationGainPolicy.ts
- mockPages.ts
- governanceAudit.ts
- QaTriage.tsx
- lib/llmProvider.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- Tenant context
- brandVoiceExtract.ts
- briefActions.int.spec.ts
- dependencies
- Evidence bank
- Contributing to Datum
- positioningToPrompt
- Agent instructions
- lib/informationGain/index.ts
- ref_node_crypto
- positioning.ts
- scripts
- ig-e2e.sh
- open-source-checklist.md
- Operations
- lexicalHtml.ts
- repository
- positioning.int.spec.ts
- BrandVoiceView.tsx
- src/index.ts
- @payloadcms/db-postgres
- informationGainRuns.int.spec.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- icps.int.spec.ts
- vitest
- models.test.ts
- repository
- eslint.config.mjs
- auditTypes.ts
- lib/pricing.ts
- How prompts use them
- loadTenantContextCms.ts
- 20260826_015027_existing_schema_baseline.ts
- devDependencies
- migrations/index.ts
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- [...slug]/route.ts
- tenantActions.int.spec.ts
- bugs
- engines
- setupSuggestions.int.spec.ts

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
- `Webhooks` --references--> `verifyWebhookSignature()`  [INFERRED]
  docs/operations.md → cms/src/jobs/webhookDeliver.ts
- `Task 1: Remove `codex/*` end to end (L-1, L-2, F-013)` --references--> `providerForModel()`  [INFERRED]
  docs/superpowers/plans/2026-09-11-phase2-ui-workflow-polish.md → cms/src/lib/llmProvider.ts
- `Model, mock mode, and cost` --references--> `resolveSetupAssistModel()`  [INFERRED]
  docs/tenant-context.md → cms/src/lib/llmSettings.ts

## Import Cycles
- None detected.

## Communities (157 total, 33 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.06
Nodes (49): ArticleReviewView(), asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf() (+41 more)

### Community 1 - "igScoring.test.ts"
Cohesion: 0.09
Nodes (20): InformationGainPolicy, clamp01(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE, ratio(), relevanceFromQueries(), scoreClaim() (+12 more)

### Community 2 - "loadWorkspaceReadiness.ts"
Cohesion: 0.15
Nodes (22): OnboardingDashboardView(), checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklist(), SetupChecklistData (+14 more)

### Community 3 - "setupActions.ts"
Cohesion: 0.09
Nodes (25): AssistInput, AssistMode, AssistResult, pageWarning(), refreshSitePagesAction(), RefreshSitePagesResult, AssistAsset, candidatePagePaths() (+17 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.03
Nodes (60): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+52 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.07
Nodes (31): internalDuplicationRate(), JudgeSignals, VerifierSignals, ClaimRecord, ClaimSignals, Decision, Evidence, Scorecard (+23 more)

### Community 6 - "fetchTopics.ts"
Cohesion: 0.27
Nodes (9): ContentRunTask, executeContentRun(), safeError(), fetchTopics(), FetchTopicsOptions, FetchTopicsResult, sentenceCase(), buildStageContext() (+1 more)

### Community 7 - "tenantLib.test.ts"
Cohesion: 0.09
Nodes (17): HomePage(), WorkspaceProfile, clean(), Competitor, COMPETITOR_DOMAINS_ENV_VAR, competitorsFromDoc(), MOCK_COMPETITOR_DOMAINS, MOCK_TARGET_DOMAIN (+9 more)

### Community 8 - "exactness.ts"
Cohesion: 0.05
Nodes (48): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+40 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.10
Nodes (29): BrandVoiceGuide(), downloadMarkdown(), Empty(), Props, asArray(), asRecord(), asString(), bannedWordsOf() (+21 more)

### Community 10 - "verdicts.ts"
Cohesion: 0.12
Nodes (22): CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision, EvidenceFindingStatus (+14 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.12
Nodes (34): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SectionProps, ValuesSection() (+26 more)

### Community 13 - "ref_payload"
Cohesion: 0.07
Nodes (22): dirname, __filename, nextConfig, ArticleAudit, BrandVoiceFiles, CorpusSnapshots, Media, PipelineRuns (+14 more)

### Community 14 - "icp.ts"
Cohesion: 0.12
Nodes (28): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_LEVELS, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf() (+20 more)

### Community 15 - "importMap.js"
Cohesion: 0.07
Nodes (20): importMap, Args, Args, GET, OPTIONS, POST, Args, ExtraOpsNavLinks() (+12 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (27): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+19 more)

### Community 17 - "ContentList.tsx"
Cohesion: 0.10
Nodes (26): OWNER_LABEL, ageLabel(), ContentList(), Filter, FILTER_LABEL, FILTERS, Props, active (+18 more)

### Community 18 - "igQueryCluster.test.ts"
Cohesion: 0.24
Nodes (4): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT

### Community 19 - "passes.ts"
Cohesion: 0.05
Nodes (48): DEFAULT_POLICY, keywordTokens(), nearDuplicateJaccard(), STOPWORDS, tokenOverlap(), DraftClaim, BaselineContextOptions, batchFacetId() (+40 more)

### Community 20 - "informationGain/types.ts"
Cohesion: 0.07
Nodes (32): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+24 more)

### Community 21 - "collect.ts"
Cohesion: 0.09
Nodes (45): SetupSuggestionDTO, SuggestionActionResult, CollectSetupSuggestionsTask, collectSetupSuggestions(), normalized(), object(), outputText(), suggestionAssets() (+37 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "next"
Cohesion: 0.22
Nodes (19): createBrandVoiceDraftAction(), saveBrandVoiceDraftAction(), toData(), UPLOAD_MIMETYPES, UploadExtractResult, SetupSuggestions(), SuggestionEditorContext(), suggestionLabel() (+11 more)

### Community 25 - "report.ts"
Cohesion: 0.15
Nodes (17): articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate(), ReasonLike (+9 more)

### Community 26 - "cmsLlm.ts"
Cohesion: 0.18
Nodes (9): CmsCostStage, CmsLlmRequest, cmsMockMode(), completeJsonCms(), parseBool(), parseJsonReply(), CostLog, anthropicCreate (+1 more)

### Community 27 - "tenant/fixtures.ts"
Cohesion: 0.08
Nodes (34): BRAND_VOICE_FIXTURE, AssistInput, ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE, evidenceBankFixtureDoc(), ICP_FIXTURE, ICP_FIXTURE_SECONDARY (+26 more)

### Community 28 - "IcpEditor.tsx"
Cohesion: 0.20
Nodes (21): gateIcpActivation(), AssetStep, IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), ICP_STEPS, IcpDTO (+13 more)

### Community 29 - "llm.ts"
Cohesion: 0.09
Nodes (33): PIPELINE_STAGES, costUsd(), Cost, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture (+25 more)

### Community 30 - "topicDiscoveryActions.ts"
Cohesion: 0.19
Nodes (20): compact(), difficultyLabel(), Props, TopicDiscovery(), cachedCandidates(), createTopicsAction(), discoverTopicsAction(), isFresh() (+12 more)

### Community 31 - "seedContentOps.ts"
Cohesion: 0.11
Nodes (22): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+14 more)

### Community 32 - "tenantActions.ts"
Cohesion: 0.20
Nodes (19): PositioningEditor(), SECTION_KEYS, PositioningView(), loadAssistContext(), activateDefaultBrandVoiceAction(), activateDefaultTenantAction(), createIcpIfMissing(), dateOrNull() (+11 more)

### Community 33 - "generatePrompt.ts"
Cohesion: 0.09
Nodes (32): BrandVoiceContent, brandVoiceSamplesToPrompt(), InformationGap, evidenceRules(), isEvidenceBankEmpty(), Gap-fed generation, Task 3: AI-proposed brief angles, BriefDraft (+24 more)

### Community 34 - "Facet"
Cohesion: 0.20
Nodes (8): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), Facet

### Community 35 - "createAhrefsClient"
Cohesion: 0.19
Nodes (4): createAhrefsClient(), MockAhrefsClient, opportunityScore(), RealAhrefsClient

### Community 36 - "qa/index.ts"
Cohesion: 0.08
Nodes (31): Template, sumArticleCost(), qaStage, bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem (+23 more)

### Community 37 - "SetupWorkspaceEditor.tsx"
Cohesion: 0.20
Nodes (13): formatAuditTimestamp(), asRecord(), AssetStepper(), AssistConfig, hasSectionContent(), Props, SetupWorkspaceEditor(), StepId (+5 more)

### Community 38 - "requireUser"
Cohesion: 0.12
Nodes (43): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+35 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.10
Nodes (38): parsePageClaims(), excerptFoundIn(), selectInternalCorpus(), BaselineClaim, CorpusSnapshot, Baseline claims and facets, Corpus snapshots, mapWithConcurrency() (+30 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (23): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+15 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.15
Nodes (24): Articles, SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(), ArticleAuditContext, auditArticleChange(), AuditRequestContext, CLEARED_INFORMATION_GAIN, freshJustification() (+16 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.09
Nodes (36): AuditTimelineEntry, AuditTimeline(), Props, activateBrandVoiceAction(), archiveBrandVoiceAction(), deleteDraftAction(), BrandVoiceEditor(), BrandVoiceReview() (+28 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.19
Nodes (20): asArray(), asDay(), asRecord(), asString(), depthOf(), emptyEvidenceBankContent(), evidenceBankToPrompt(), EvidenceRefCheck (+12 more)

### Community 45 - "parsers.ts"
Cohesion: 0.15
Nodes (28): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+20 more)

### Community 46 - "briefActions.ts"
Cohesion: 0.33
Nodes (11): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+3 more)

### Community 47 - "stages.ts"
Cohesion: 0.09
Nodes (14): PipelineStageName, Article, EvidenceCitation, GeneratedArticle, generateStage, researchStage, resolveTemplate(), RunPipelineOptions (+6 more)

### Community 48 - "NewContentFlow.tsx"
Cohesion: 0.15
Nodes (16): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+8 more)

### Community 49 - "llmSettlement.test.ts"
Cohesion: 0.07
Nodes (37): PipelineStage, emptyTenantContext(), buildConfig(), config, here, parseBool(), PipelineConfig, repoRoot (+29 more)

### Community 50 - "workspaceReadiness.ts"
Cohesion: 0.10
Nodes (25): AssistContext, EvidenceBankContent, IcpContent, icpIdOf(), selectIcp(), TenantContext, tenantFingerprint(), PositioningContent (+17 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (17): normaliseWhitespace(), Mock mode, ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS (+9 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.11
Nodes (24): AssistPanel(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankView() (+16 more)

### Community 53 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.09
Nodes (32): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), loadSourceReviewArticles() (+24 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.16
Nodes (21): LlmSettings, DEFAULT_MODEL, LLM_MODEL_OPTIONS, money(), PROVIDER_LABEL, EXTRACTION_ENV_VAR, LLM_SETTING_FIELDS, ModelSource (+13 more)

### Community 57 - "topicRelevance.ts"
Cohesion: 0.21
Nodes (22): logCmsCost(), scoreTopicRelevance(), emptyPositioningContent(), audienceVocabulary(), buildTopicRelevancePrompt(), cachedTopicRelevance(), distinctiveStems(), excludedVerdict() (+14 more)

### Community 58 - "igCandidates.test.ts"
Cohesion: 0.08
Nodes (20): CANDIDATE_RANK, CandidateClass, CandidateKind, CandidateSighting, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings() (+12 more)

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "evidenceBank.test.ts"
Cohesion: 0.09
Nodes (16): checkEvidenceRefs(), cleared(), evidenceBankSummary, expired(), expiredClaims(), incompleteClaims(), isClaimComplete(), MAX_PROMPT_CLAIMS (+8 more)

### Community 61 - "igSourceQuality.test.ts"
Cohesion: 0.16
Nodes (10): VerifierEvidence, EvidenceSourceRule, hostnameOf(), matchesDomain(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP, QualitySource (+2 more)

### Community 62 - "react"
Cohesion: 0.18
Nodes (20): ArticleReview(), Props, BoardArticle, isStalled(), BriefEditor(), BriefIcpOption, Props, Section (+12 more)

### Community 63 - "brandVoice.int.spec.ts"
Cohesion: 0.20
Nodes (12): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), auditActor(), LANGUAGE_LEVELS (+4 more)

### Community 64 - "reviewPanels.int.spec.ts"
Cohesion: 0.22
Nodes (11): auditEventLabel(), AuditSummary, AuditRow, AuditTrail(), groupAuditEvents(), money(), RunGroup(), TimelineEntry() (+3 more)

### Community 65 - "assist.ts"
Cohesion: 0.11
Nodes (32): assistAction(), assistError(), applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, ASSIST_PAGE_TEXT_CAP (+24 more)

### Community 66 - "tenant.ts"
Cohesion: 0.06
Nodes (22): AhrefsClient, AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, OrganicKeywordRow, SerpPage, SerpPositionRow (+14 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "GlobalRunBar.tsx"
Cohesion: 0.11
Nodes (20): CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress(), RunStatusDTO, STAGE_PROGRESS (+12 more)

### Community 69 - "boardActions.ts"
Cohesion: 0.07
Nodes (40): isRunnableStatus(), BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), runSelectedArticlesAction(), toRunFailures(), StartContentRunInput (+32 more)

### Community 70 - "README.md"
Cohesion: 0.24
Nodes (3): cms, Useful scripts (from `cms/` or `npm run … --workspace cms`), Setup suggestions

### Community 71 - "articleMetadata.int.spec.ts"
Cohesion: 0.29
Nodes (6): metadata, metadataBase, buildArticleMetadata(), PublishedArticle, getMetadataBase(), getSiteUrl()

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.08
Nodes (33): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+25 more)

### Community 74 - "Scorecard.tsx"
Cohesion: 0.28
Nodes (13): InformationGainRunView, ScorecardClaim, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+5 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "TemplateConfigEditor.tsx"
Cohesion: 0.22
Nodes (16): Templates, createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView() (+8 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.27
Nodes (14): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), highestRefIn(), idOf(), Prefix, REF_FIELD (+6 more)

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

### Community 85 - "evidenceBank.int.spec.ts"
Cohesion: 0.27
Nodes (6): EvidenceBank, clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh()

### Community 86 - "InformationGainPolicy.ts"
Cohesion: 0.24
Nodes (7): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS, PolicyFieldDef

### Community 87 - "mockPages.ts"
Cohesion: 0.13
Nodes (13): competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST, pathOf() (+5 more)

### Community 88 - "governanceAudit.ts"
Cohesion: 0.15
Nodes (3): CascadeContext, AuditRequestContext, IGNORED_GLOBAL_FIELDS

### Community 89 - "QaTriage.tsx"
Cohesion: 0.18
Nodes (12): qaFailures(), CheckRow(), QaFailures(), QaTriage(), sourceLabel(), Consolidation proposals, How to read this, Journey map (+4 more)

### Community 90 - "lib/llmProvider.ts"
Cohesion: 0.24
Nodes (14): ExtractionResult, CmsLlmResult, LlmModel, apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), LlmProvider, PROVIDER_ENV_VAR_NAME (+6 more)

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "Tenant context"
Cohesion: 0.18
Nodes (11): AI assist, Gating, Learning from review, Model, mock mode, and cost, Precedence, Sections, Tenant context, The assets (+3 more)

### Community 94 - "brandVoiceExtract.ts"
Cohesion: 0.11
Nodes (25): extractBrandVoiceFromUploadAction(), BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), logExtractionCost(), mockExtraction() (+17 more)

### Community 95 - "briefActions.int.spec.ts"
Cohesion: 0.07
Nodes (23): authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createRunMock, edits (+15 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "Evidence bank"
Cohesion: 0.22
Nodes (9): claimProblems(), verifiedClaimProblems(), Evidence bank, Expiry, Information gain, Prompt size, Readiness, Refs (+1 more)

### Community 98 - "Contributing to Datum"
Cohesion: 0.20
Nodes (10): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+2 more)

### Community 99 - "positioningToPrompt"
Cohesion: 0.16
Nodes (16): buildAssistUser(), icpToPrompt(), positioningToPrompt(), sentence(), term(), workspaceProfileToPrompt(), Decisions to confirm before starting, Global Constraints (+8 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 101 - "lib/informationGain/index.ts"
Cohesion: 0.27
Nodes (4): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES

### Community 102 - "ref_node_crypto"
Cohesion: 0.33
Nodes (7): Policy and evidence sources are run-scoped, loadActiveBrandVoice(), loadEvidenceSources(), loadInformationGainPolicy(), policyVersion(), loadStageInputs(), loadTenantContext()

### Community 103 - "positioning.ts"
Cohesion: 0.20
Nodes (14): asArray(), asRecord(), asString(), evidenceRefOf(), Loose, OpenRulingStatus, parsePositioningContent(), PositioningClaim (+6 more)

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
Cohesion: 0.33
Nodes (5): Cache and revalidation, Fixed limits worth knowing, Modes and money, Operations, Webhooks

### Community 108 - "lexicalHtml.ts"
Cohesion: 0.18
Nodes (13): generateMetadata(), Props, PublishedArticlePage(), revalidate, findPublishedArticle, publicFields, escapeHtml(), lastH2HeadingText() (+5 more)

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 111 - "BrandVoiceView.tsx"
Cohesion: 0.31
Nodes (9): BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), brandVoiceContentOf(), loadSuggestionForEditor(), suggestionDTO() (+1 more)

### Community 112 - "src/index.ts"
Cohesion: 0.21
Nodes (12): FetchContext, CliArgs, main(), parseArgs(), resolveTemplateId(), usage(), ReportPeriod, describeFailures() (+4 more)

### Community 114 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 115 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Anything reviewers should know, How this affects developers, How this affects users, How to verify, What changed and why

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 117 - "icps.int.spec.ts"
Cohesion: 0.09
Nodes (20): GovernanceAudit, Icps, auditGlobalChange(), GovernanceSubject, pick(), hook, create(), createdArticleIds (+12 more)

### Community 118 - "vitest"
Cohesion: 0.09
Nodes (11): authMock, countMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findByIDMock, findMock, updateMock, article(), mocks (+3 more)

### Community 119 - "models.test.ts"
Cohesion: 0.33
Nodes (3): LlmSettingsDoc, Registering a model setting (shared by Tasks 3 and 4), StageModelDeps

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 121 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 122 - "auditTypes.ts"
Cohesion: 0.23
Nodes (10): CostLog, auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, AuditSource, scoreInvalidatedFields() (+2 more)

### Community 123 - "lib/pricing.ts"
Cohesion: 0.40
Nodes (4): LLM_CATALOG, LEGACY_PRICES, PRICES, warnedModels

### Community 124 - "How prompts use them"
Cohesion: 0.40
Nodes (5): Company mentions, How prompts use them, The brief in review, The brief's angle, Which description of the reader wins

### Community 125 - "loadTenantContextCms.ts"
Cohesion: 0.83
Nodes (3): findActiveIcps(), loadTenantContextCms(), icpsFromDocs()

### Community 127 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, tsx, @types/node, typescript

### Community 138 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 146 - "tenantActions.int.spec.ts"
Cohesion: 0.25
Nodes (3): GovernanceAudit, authStub, createdIcpIds

## Knowledge Gaps
- **826 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+821 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1113 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `loadWorkspaceReadiness.ts`, `setupActions.ts`, `fetchTopics.ts`, `tenantLib.test.ts`, `ref_payload`, `importMap.js`, `webhookDeliver.int.spec.ts`, `ContentList.tsx`, `tenantActions.int.spec.ts`, `cmsLlm.ts`, `tenant/fixtures.ts`, `setupSuggestions.int.spec.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `NewContentFlow.tsx`, `workspaceReadiness.ts`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `llmSettings.ts`, `brandVoice.int.spec.ts`, `reviewPanels.int.spec.ts`, `GlobalRunBar.tsx`, `boardActions.ts`, `articleMetadata.int.spec.ts`, `ReportsPanel.tsx`, `evidenceBank.int.spec.ts`, `InformationGainPolicy.ts`, `brandVoiceExtract.ts`, `briefActions.int.spec.ts`, `lib/informationGain/index.ts`, `positioning.int.spec.ts`, `informationGainRuns.int.spec.ts`, `icps.int.spec.ts`, `auditTypes.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _826 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05837173579109063 - nodes in this community are weakly interconnected._
- **Why does `@payloadcms/db-postgres` connect `@payloadcms/db-postgres` to `migrations/index.ts`, `20260826_225347_information_gain_schema.ts`, `20260827_155913_topic_discovery.ts`, `20260827_183330_board_selected_runs.ts`, `20260827_184000_article_archived.ts`, `20260831_190025_webhook_settings_and_delivery_task.ts`, `20260831_191144_scheduled_publishing.ts`, `20260902_210000_codex_model_options.ts`, `20260903_020919_workspace_profile_global.ts`, `20260903_022301_icps_collection_and_article_icp.ts`, `ref_payload`, `20260903_024506_positioning_global_and_llm_stage_schema.ts`, `20260903_030748_evidence_bank_global_and_qa.ts`, `20260905_232800_graphql_policy_options.ts`, `20260911_145800_drop_codex_model_options.ts`, `20260911_152559_pipeline_runs_drop_onboarding_source.ts`, `20261006_205858_articles_lookup_indexes.ts`, `20261007_121854_template_company_mentions.ts`, `20261007_133223_brief_angles.ts`, `cms/package.json`, `boardActions.ts`, `ReportsPanel.tsx`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `igScoring.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0907563025210084 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `articleStatus.ts`, `loadWorkspaceReadiness.ts`, `tenantLib.test.ts`, `lib/brandVoice.ts`, `Field`, `icp.ts`, `importMap.js`, `ContentList.tsx`, `next`, `IcpEditor.tsx`, `topicDiscoveryActions.ts`, `tenantActions.ts`, `SetupWorkspaceEditor.tsx`, `requireUser`, `cms/package.json`, `BrandVoiceEditor.tsx`, `briefActions.ts`, `NewContentFlow.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `reviewPanels.int.spec.ts`, `GlobalRunBar.tsx`, `boardActions.ts`, `articleMetadata.int.spec.ts`, `ReportsPanel.tsx`, `Scorecard.tsx`, `TemplateConfigEditor.tsx`, `QaTriage.tsx`, `lexicalHtml.ts`, `BrandVoiceView.tsx`, `auditTypes.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `setupActions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09309309309309309 - nodes in this community are weakly interconnected._