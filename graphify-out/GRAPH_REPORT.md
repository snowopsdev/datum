# Graph Report - t3-5044b3e6  (2026-10-21)

## Corpus Check
- 438 files · ~1,031,715 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 2)

## Summary
- 3098 nodes · 8270 edges · 157 communities (123 shown, 34 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 315 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `55b85c07`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- tenant/index.ts
- setupChecklist.int.spec.ts
- sitePages.ts
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
- lib.ts
- ref_node_assert
- informationGain/types.ts
- collect.ts
- DESIGN.md
- errorMessage
- report.ts
- cmsLlm.ts
- tenant/fixtures.ts
- tenantActions.ts
- src/fixtures.ts
- topicDiscoveryActions.ts
- seedContentOps.ts
- react
- generatePrompt.ts
- Facet
- sourceReviewActions.ts
- richtext.ts
- SetupWorkspaceEditor.tsx
- actions.ts
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
- resolveWorkspaceProfile
- workspaceReadiness.ts
- fetchPage.ts
- EvidenceBankEditor.tsx
- igPrompts.test.ts
- package.json
- sourceReviewTypes.ts
- llmSettings.ts
- topicRelevance.ts
- igCandidates.test.ts
- compilerOptions
- evidenceBank.test.ts
- seed.ts
- ArticleReview.tsx
- llm.ts
- setupActions.ts
- assist.ts
- ahrefs.ts
- dependencies
- boardActions.ts
- Findings
- README.md
- workspaceProfile.ts
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
- tenant.ts
- InformationGainPolicy.ts
- mockPages.ts
- Icps.ts
- NeedsRevisionPanel.tsx
- lib/llmProvider.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- Tenant context
- brandVoiceActions.ts
- vitest
- dependencies
- checkEvidenceRefs
- Contributing to Datum
- logCmsCost
- Agent instructions
- lib/informationGain/index.ts
- briefAngle.test.ts
- positioning.ts
- scripts
- ig-e2e.sh
- open-source-checklist.md
- Operations
- sitePages.int.spec.ts
- repository
- governanceAudit.ts
- BrandVoiceView.tsx
- Releasing
- @payloadcms/db-postgres
- informationGainRuns.int.spec.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- Global Constraints
- corpusSnapshots.int.spec.ts
- ExtraOpsNavLinks.tsx
- repository
- eslint.config.mjs
- auditTypes.ts
- next.config.ts
- graphql/route.ts
- 20260826_015027_existing_schema_baseline.ts
- devDependencies
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- [...slug]/route.ts
- migrations/index.ts
- tenantActions.int.spec.ts
- bugs
- engines
- Config

## God Nodes (most connected - your core abstractions)
1. `react` - 85 edges
2. `vitest` - 65 edges
3. `next` - 57 edges
4. `requireUser()` - 57 edges
5. `resolveWorkspaceProfile()` - 46 edges
6. `errorMessage()` - 38 edges
7. `loadWorkspaceSetup()` - 32 edges
8. `Field()` - 31 edges
9. `Article` - 30 edges
10. `@payloadcms/db-postgres` - 27 edges

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

## Communities (157 total, 34 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.07
Nodes (38): asRecord(), asRecordArray(), asStringSet(), CHECK_LABEL, DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf() (+30 more)

### Community 1 - "tenant/index.ts"
Cohesion: 0.12
Nodes (23): BrandVoiceContent, InformationGap, AssistContext, EvidenceBankContent, IcpContent, icpIdOf(), selectIcp(), TenantContext (+15 more)

### Community 2 - "setupChecklist.int.spec.ts"
Cohesion: 0.30
Nodes (10): checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklistData, workspaceState(), readyData (+2 more)

### Community 3 - "sitePages.ts"
Cohesion: 0.26
Nodes (12): refreshSitePagesAction(), candidatePagePaths(), FetchedPageLike, hostKey(), isSameSite(), MAX_DISCOVERED_PAGES, MAX_SITE_PAGES, pathKey() (+4 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.03
Nodes (58): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+50 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.05
Nodes (55): internalDuplicationRate(), JudgeSignals, VerifierSignals, InformationGainPolicy, clamp01(), clampImportance(), estimateTokens(), evidenceFloorFor() (+47 more)

### Community 6 - "src/index.ts"
Cohesion: 0.10
Nodes (30): executeContentRun(), safeError(), PipelineRun, articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest] (+22 more)

### Community 7 - "tenantLib.test.ts"
Cohesion: 0.08
Nodes (18): PositioningEditor(), PositioningView(), loadAssistContext(), savePositioningAction(), upsertPositioning(), CreatePipelineRunInput, findActiveIcps(), IcpOption (+10 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (37): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+29 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.08
Nodes (40): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), toData(), BrandVoiceGuide() (+32 more)

### Community 10 - "verdicts.ts"
Cohesion: 0.11
Nodes (23): mockUsage, CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision (+15 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.12
Nodes (34): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SECTION_COMPONENTS, SectionProps (+26 more)

### Community 13 - "ref_payload"
Cohesion: 0.07
Nodes (25): BrandVoiceFiles, Media, PipelineRuns, SetupSuggestions, TopicSearches, Users, StartContentRunInput, StartContentRunResult (+17 more)

### Community 14 - "icp.ts"
Cohesion: 0.12
Nodes (31): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf(), confidenceTag() (+23 more)

### Community 15 - "next"
Cohesion: 0.11
Nodes (27): importMap, Args, Args, GET, Args, ArticleReviewView(), formatAuditTimestamp(), isScheduleExpired() (+19 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (25): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+17 more)

### Community 17 - "ContentList.tsx"
Cohesion: 0.10
Nodes (28): isStalled(), OWNER_LABEL, STAGE_LABEL, StageInfo, stageOf(), ageLabel(), ContentList(), Filter (+20 more)

### Community 18 - "lib.ts"
Cohesion: 0.22
Nodes (4): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT

### Community 19 - "ref_node_assert"
Cohesion: 0.06
Nodes (42): DEFAULT_POLICY, DraftClaim, Claims nobody checked, Cost, Scoring a draft, What is written, SerpResearch, config (+34 more)

### Community 20 - "informationGain/types.ts"
Cohesion: 0.05
Nodes (43): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+35 more)

### Community 21 - "collect.ts"
Cohesion: 0.10
Nodes (41): SetupSuggestionDTO, SuggestionActionResult, collectSetupSuggestions(), normalized(), object(), outputText(), suggestionSatisfied(), text() (+33 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "errorMessage"
Cohesion: 0.29
Nodes (15): saveBrandVoiceDraftAction(), SetupSuggestions(), SuggestionEditorContext(), suggestionLabel(), SuggestionRow(), acceptSuggestionAction(), dismissSuggestionAction(), refresh() (+7 more)

### Community 25 - "report.ts"
Cohesion: 0.15
Nodes (17): articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate(), ReasonLike (+9 more)

### Community 26 - "cmsLlm.ts"
Cohesion: 0.10
Nodes (19): ExtractionResult, CmsCostStage, CmsLlmRequest, CmsLlmResult, parseBool(), parseJsonReply(), DEFAULT_MODEL, LLM_CATALOG (+11 more)

### Community 27 - "tenant/fixtures.ts"
Cohesion: 0.11
Nodes (20): BRAND_VOICE_FIXTURE, ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS, AssistInput, ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE, ICP_FIXTURE (+12 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.17
Nodes (30): gateIcpActivation(), hasSectionContent(), activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), IcpEditor(), IcpReview(), mergeAssist() (+22 more)

### Community 29 - "src/fixtures.ts"
Cohesion: 0.17
Nodes (11): draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture, fixtures, FixtureTable, generateFixture (+3 more)

### Community 30 - "topicDiscoveryActions.ts"
Cohesion: 0.17
Nodes (22): compact(), difficultyLabel(), Props, TopicDiscovery(), cachedCandidates(), createTopicsAction(), discoverTopicsAction(), isFresh() (+14 more)

### Community 31 - "seedContentOps.ts"
Cohesion: 0.11
Nodes (22): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+14 more)

### Community 32 - "react"
Cohesion: 0.27
Nodes (16): isRunnableStatus(), ArchiveAction(), OpenInAdmin(), PANEL_FOR_STATUS, ArchivedPanel(), BriefPanel(), PublishedPanel(), ReviewDecisionPanel() (+8 more)

### Community 33 - "generatePrompt.ts"
Cohesion: 0.07
Nodes (40): brandVoiceSamplesToPrompt(), buildAssistUser(), companyMentionsOf(), CONFIDENCE_LEVELS, evidenceBankToPrompt(), evidenceRules(), positioningToPrompt(), workspaceProfileToPrompt() (+32 more)

### Community 34 - "Facet"
Cohesion: 0.20
Nodes (8): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), Facet

### Community 35 - "sourceReviewActions.ts"
Cohesion: 0.19
Nodes (17): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), loadSourceReviewArticles() (+9 more)

### Community 36 - "richtext.ts"
Cohesion: 0.11
Nodes (27): bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks(), StructuralCheckOptions (+19 more)

### Community 37 - "SetupWorkspaceEditor.tsx"
Cohesion: 0.10
Nodes (21): asRecord(), AssetStep, AssetStepper(), AssistConfig, Props, AssistPanel(), ICP_STEPS, IcpDTO (+13 more)

### Community 38 - "actions.ts"
Cohesion: 0.14
Nodes (26): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+18 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.08
Nodes (43): parsePageClaims(), excerptFoundIn(), keywordTokens(), nearDuplicateJaccard(), selectInternalCorpus(), STOPWORDS, tokenOverlap(), BaselineClaim (+35 more)

### Community 40 - "Changelog"
Cohesion: 0.06
Nodes (32): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+24 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (24): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+16 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.10
Nodes (36): Articles, SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(), ArticleAuditContext, auditArticleChange(), AuditRequestContext, PUBLIC_CONTENT_FIELDS, publicValue() (+28 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.10
Nodes (32): AuditTimelineEntry, AuditTimeline(), Props, deleteDraftAction(), BrandVoiceEditor(), BrandVoiceReview(), clampQuestion(), contentOf() (+24 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.15
Nodes (23): asArray(), asDay(), asRecord(), asString(), cleared(), depthOf(), emptyEvidenceBankContent(), EvidenceRefCheck (+15 more)

### Community 45 - "parsers.ts"
Cohesion: 0.10
Nodes (36): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+28 more)

### Community 46 - "briefActions.ts"
Cohesion: 0.24
Nodes (16): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+8 more)

### Community 47 - "stages.ts"
Cohesion: 0.11
Nodes (14): PipelineStageName, Article, EvidenceCitation, GeneratedArticle, generateStage, StageModels, resolveTemplate(), RunPipelineOptions (+6 more)

### Community 48 - "NewContentFlow.tsx"
Cohesion: 0.15
Nodes (15): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+7 more)

### Community 49 - "resolveWorkspaceProfile"
Cohesion: 0.10
Nodes (27): emptyTenantContext(), resolveWorkspaceProfile(), Template, LlmClient, LlmRequest, StageContext, loadStyleGuide(), parseBannedPhrases() (+19 more)

### Community 50 - "workspaceReadiness.ts"
Cohesion: 0.11
Nodes (14): PipelineStage, tenantFingerprint(), WorkspaceProfileSource, configured(), evaluateRuntimeReadiness(), evaluateWorkspaceReadiness(), fingerprint(), GovernanceAsset (+6 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (17): normaliseWhitespace(), Mock mode, ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS (+9 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.11
Nodes (18): DEPTH_LABEL, SURFACE_LABEL, Tab, TAB_BLURB, TABS, EvidenceBankDraft, EvidenceBankInput, NewRow (+10 more)

### Community 53 - "igPrompts.test.ts"
Cohesion: 0.16
Nodes (14): DEFAULT_MAX_DRAFT_CLAIMS, CLAIM_TYPES, baselineClaimBrief(), DRAFT_CLAIM_EXTRACTION_SYSTEM, draftClaimUser(), facetBrief(), JUDGE_SYSTEM, judgeClaimBrief() (+6 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.13
Nodes (13): ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES, num() (+5 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.14
Nodes (23): LlmSettings, clean(), EXTRACTION_ENV_VAR, LLM_SETTING_FIELDS, llmSettingsConfigured(), LlmSettingsDoc, ModelSource, PIPELINE_STAGES (+15 more)

### Community 57 - "topicRelevance.ts"
Cohesion: 0.22
Nodes (20): emptyPositioningContent(), audienceVocabulary(), buildTopicRelevancePrompt(), cachedTopicRelevance(), distinctiveStems(), excludedVerdict(), exclusionWords(), FITS (+12 more)

### Community 58 - "igCandidates.test.ts"
Cohesion: 0.06
Nodes (30): CANDIDATE_RANK, CandidateClass, CandidateKind, CandidateSighting, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings() (+22 more)

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "evidenceBank.test.ts"
Cohesion: 0.09
Nodes (9): claimProblems(), evidenceBankSummary, expiredClaims(), incompleteClaims(), isClaimComplete(), neverUseClaims(), verifiedClaimProblems(), What makes a claim usable (+1 more)

### Community 61 - "seed.ts"
Cohesion: 0.18
Nodes (16): evidenceBankFixtureDoc(), positioningFixtureDoc(), evidenceSources, heading(), Node, paragraph(), RichText, seed() (+8 more)

### Community 62 - "ArticleReview.tsx"
Cohesion: 0.14
Nodes (22): ArticleReview(), Props, BoardArticle, TemplateOption, AuditEvidence(), auditEventLabel(), ArticleBody(), AuditRow (+14 more)

### Community 63 - "llm.ts"
Cohesion: 0.20
Nodes (12): buildConfig(), here, parseBool(), PipelineConfig, repoRoot, completeJSONAnthropic(), completeJSONLive(), completeJSONOpenAI() (+4 more)

### Community 64 - "setupActions.ts"
Cohesion: 0.22
Nodes (13): assistAction(), assistError(), AssistInput, AssistMode, AssistResult, pageWarning(), RefreshSitePagesResult, AssistAsset (+5 more)

### Community 65 - "assist.ts"
Cohesion: 0.15
Nodes (22): applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS, AssistMode, assistRules(), assistSectionKeys() (+14 more)

### Community 66 - "ahrefs.ts"
Cohesion: 0.09
Nodes (13): AhrefsClient, AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, MockAhrefsClient, opportunityScore(), OrganicKeywordRow (+5 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "boardActions.ts"
Cohesion: 0.08
Nodes (28): BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO (+20 more)

### Community 69 - "Findings"
Cohesion: 0.12
Nodes (16): Article review, Content list, Findings, Globals rendered raw, How to read this, Journey map, Legacy removal list, Navigation and information architecture (+8 more)

### Community 70 - "README.md"
Cohesion: 0.24
Nodes (3): cms, Useful scripts (from `cms/` or `npm run … --workspace cms`), Setup suggestions

### Community 71 - "workspaceProfile.ts"
Cohesion: 0.24
Nodes (11): WorkspaceProfile, clean(), Competitor, COMPETITOR_DOMAINS_ENV_VAR, competitorsFromDoc(), MOCK_COMPETITOR_DOMAINS, normaliseDomain(), parseCompetitorDomainsEnv() (+3 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.07
Nodes (31): BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel(), ReportsView() (+23 more)

### Community 74 - "reviewPanels.int.spec.ts"
Cohesion: 0.18
Nodes (16): InformationGainRunView, AuditSummary, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+8 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "[slug]/page.tsx"
Cohesion: 0.06
Nodes (46): generateMetadata(), Props, PublishedArticlePage(), revalidate, metadata, metadataBase, HomePage(), Templates (+38 more)

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
Cohesion: 0.23
Nodes (6): isEvidenceBankEmpty(), clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh()

### Community 86 - "InformationGainPolicy.ts"
Cohesion: 0.24
Nodes (7): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS, PolicyFieldDef

### Community 87 - "mockPages.ts"
Cohesion: 0.12
Nodes (14): MOCK_TARGET_DOMAIN, competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST (+6 more)

### Community 88 - "Icps.ts"
Cohesion: 0.12
Nodes (6): CascadeContext, Icps, create(), createdArticleIds, createdIds, icpData()

### Community 89 - "NeedsRevisionPanel.tsx"
Cohesion: 0.24
Nodes (14): queueRunAfterRework(), regenerateArticleAction(), resetToDraftedAction(), buildRegenerateRevisionNotes(), evidenceFindingsOf(), qaFailures(), EvidenceCard(), IgReasonsAside() (+6 more)

### Community 90 - "lib/llmProvider.ts"
Cohesion: 0.51
Nodes (7): apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement, requirementForModel()

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "Tenant context"
Cohesion: 0.17
Nodes (12): AI assist, Gating, Learning from review, Model, mock mode, and cost, Positioning, Precedence, Sections, Tenant context (+4 more)

### Community 94 - "brandVoiceActions.ts"
Cohesion: 0.11
Nodes (29): extractBrandVoiceFromUploadAction(), UPLOAD_MIMETYPES, UploadExtractResult, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel() (+21 more)

### Community 95 - "vitest"
Cohesion: 0.06
Nodes (28): mocks, authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createRunMock (+20 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "checkEvidenceRefs"
Cohesion: 0.17
Nodes (12): checkEvidenceRefs(), stripEvidenceRefs(), Task 2: One coherent demo workspace, Evidence bank, Expiry, Information gain, Prompt size, Readiness (+4 more)

### Community 98 - "Contributing to Datum"
Cohesion: 0.18
Nodes (11): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+3 more)

### Community 99 - "logCmsCost"
Cohesion: 0.15
Nodes (10): logCmsCost(), anthropicCreate, openaiCreate, Decisions to confirm before starting, Global Constraints, Order and dependencies, Out of scope, Registering a model setting (shared by Tasks 3 and 4) (+2 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 101 - "lib/informationGain/index.ts"
Cohesion: 0.16
Nodes (5): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES, { graphql }

### Community 102 - "briefAngle.test.ts"
Cohesion: 0.19
Nodes (7): emptyIcpContent(), facets, gaps, ICP, voice, allowed, option

### Community 103 - "positioning.ts"
Cohesion: 0.17
Nodes (16): asArray(), asRecord(), asString(), evidenceRefOf(), Loose, OpenRulingStatus, parsePositioningContent(), PositioningClaim (+8 more)

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
Cohesion: 0.25
Nodes (7): Cache and revalidation, Fixed limits worth knowing, Job queues, Modes and money, Operations, Scheduled publishing, Webhooks

### Community 108 - "sitePages.int.spec.ts"
Cohesion: 0.15
Nodes (5): authMock, FetchedPage, { fetchPage: realFetchPage }, fetchPageMock, FetchPageModule

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "governanceAudit.ts"
Cohesion: 0.15
Nodes (9): GovernanceAudit, Positioning, auditGlobalChange(), AuditRequestContext, GovernanceSubject, IGNORED_GLOBAL_FIELDS, pick(), hook (+1 more)

### Community 111 - "BrandVoiceView.tsx"
Cohesion: 0.21
Nodes (14): BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), EvidenceBankEditor(), EvidenceBankView(), emptyEvidenceBankDraft() (+6 more)

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
Cohesion: 0.13
Nodes (18): runSelectedArticlesAction(), stageKpis(), plural(), queueRunForArticles(), read(), Consolidation proposals, Global Constraints, Phase 2: UI and workflow polish Implementation Plan (+10 more)

### Community 118 - "corpusSnapshots.int.spec.ts"
Cohesion: 0.33
Nodes (4): CorpusSnapshots, internalCorpusSubfields, pagesSubfields, topLevelFields

### Community 119 - "ExtraOpsNavLinks.tsx"
Cohesion: 0.33
Nodes (4): ExtraOpsNavLinks(), NavLink, Section, SECTIONS

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 121 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 122 - "auditTypes.ts"
Cohesion: 0.17
Nodes (11): ArticleAudit, CostLog, auditDetailsAction(), State, AUDIT_EVENT_LABELS, AuditDetailResult, AuditSource, scoreInvalidatedFields() (+3 more)

### Community 123 - "next.config.ts"
Cohesion: 0.33
Nodes (3): dirname, __filename, nextConfig

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
- **832 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+827 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1124 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@payloadcms/db-postgres` connect `@payloadcms/db-postgres` to `20260827_214532_brief_checkpoint.ts`, `20260826_225347_information_gain_schema.ts`, `20260827_155913_topic_discovery.ts`, `20260827_183330_board_selected_runs.ts`, `20260827_184000_article_archived.ts`, `20260831_190025_webhook_settings_and_delivery_task.ts`, `20260831_191144_scheduled_publishing.ts`, `20260902_210000_codex_model_options.ts`, `20260903_020919_workspace_profile_global.ts`, `ref_payload`, `20260903_022301_icps_collection_and_article_icp.ts`, `20261007_134746_setup_suggestions.ts`, `migrations/index.ts`, `20261021_145609_article_content_updated_at.ts`, `20260911_145800_drop_codex_model_options.ts`, `20260911_152559_pipeline_runs_drop_onboarding_source.ts`, `20261006_205858_articles_lookup_indexes.ts`, `20261007_121854_template_company_mentions.ts`, `20261007_133223_brief_angles.ts`, `cms/package.json`, `ReportsPanel.tsx`, `20261007_133736_topic_relevance.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _832 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07149758454106281 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `setupChecklist.int.spec.ts`, `tenantLib.test.ts`, `lib/brandVoice.ts`, `ref_payload`, `webhookDeliver.int.spec.ts`, `tenantActions.int.spec.ts`, `tenant/fixtures.ts`, `actions.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `NewContentFlow.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `llmSettings.ts`, `boardActions.ts`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `[slug]/page.tsx`, `tenant.ts`, `InformationGainPolicy.ts`, `Icps.ts`, `brandVoiceActions.ts`, `logCmsCost`, `lib/informationGain/index.ts`, `sitePages.int.spec.ts`, `governanceAudit.ts`, `informationGainRuns.int.spec.ts`, `corpusSnapshots.int.spec.ts`, `ExtraOpsNavLinks.tsx`, `auditTypes.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `tenant/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12258064516129032 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `setupChecklist.int.spec.ts`, `tenantLib.test.ts`, `lib/brandVoice.ts`, `Field`, `icp.ts`, `next`, `ContentList.tsx`, `errorMessage`, `tenantActions.ts`, `topicDiscoveryActions.ts`, `sourceReviewActions.ts`, `SetupWorkspaceEditor.tsx`, `actions.ts`, `cms/package.json`, `BrandVoiceEditor.tsx`, `briefActions.ts`, `NewContentFlow.tsx`, `EvidenceBankEditor.tsx`, `ArticleReview.tsx`, `boardActions.ts`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `[slug]/page.tsx`, `NeedsRevisionPanel.tsx`, `BrandVoiceView.tsx`, `ExtraOpsNavLinks.tsx`, `auditTypes.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `payload-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03389830508474576 - nodes in this community are weakly interconnected._