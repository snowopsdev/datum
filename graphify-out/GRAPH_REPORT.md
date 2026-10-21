# Graph Report - t3-29522fda  (2026-10-21)

## Corpus Check
- 432 files · ~1,032,014 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 2)

## Summary
- 3086 nodes · 8256 edges · 154 communities (119 shown, 35 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 316 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `58a3ffad`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- igScoring.test.ts
- requireUser
- setupActions.ts
- payload-types.ts
- scorecard.ts
- resolveWorkspaceProfile
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
- src/informationGain/index.ts
- informationGain/types.ts
- collect.ts
- DESIGN.md
- brandVoiceActions.ts
- briefActions.int.spec.ts
- cmsLlm.ts
- tenant/fixtures.ts
- tenantActions.ts
- llm.ts
- topicDiscoveryActions.ts
- seedContentOps.ts
- sourceReviewActions.ts
- generatePrompt.ts
- igCoverage.test.ts
- ahrefs.ts
- qa/index.ts
- igText.test.ts
- react
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
- lib/informationGain/candidates.ts
- ArticleReview.tsx
- seed.ts
- evidenceBankSummary
- assist.ts
- ref_node_assert
- dependencies
- GlobalRunBar.tsx
- boardActions.ts
- README.md
- findPublishedArticle.ts
- devDependencies
- ReportsPanel.tsx
- reviewPanels.int.spec.ts
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
- Information gain (VMIG)
- Findings
- lib/llmProvider.ts
- Contributor Covenant Code of Conduct
- addressGuard.ts
- Tenant context
- brandVoiceExtract.ts
- articleActions.int.spec.ts
- dependencies
- Evidence bank
- Contributing to Datum
- Tenant steering improvements: implementation plan
- Agent instructions
- EvidenceSourceCandidates.ts
- workspaceProfile.int.spec.ts
- positioning.ts
- scripts
- ig-e2e.sh
- open-source-checklist.md
- Operations
- lexicalHtml.ts
- repository
- AI assist
- BrandVoiceView.tsx
- EvidenceSources.ts
- @payloadcms/db-postgres
- informationGainRuns.int.spec.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- icps.int.spec.ts
- graphqlSchema.int.spec.ts
- extractEvidenceCitations
- repository
- eslint.config.mjs
- auditTypes.ts
- lib/pricing.ts
- 20260826_015027_existing_schema_baseline.ts
- devDependencies
- migrations/index.ts
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- [...slug]/route.ts
- vitest
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
- `Webhooks` --references--> `verifyWebhookSignature()`  [INFERRED]
  docs/operations.md → cms/src/jobs/webhookDeliver.ts
- `Task 1: Remove `codex/*` end to end (L-1, L-2, F-013)` --references--> `providerForModel()`  [INFERRED]
  docs/superpowers/plans/2026-09-11-phase2-ui-workflow-polish.md → cms/src/lib/llmProvider.ts
- `Model, mock mode, and cost` --references--> `resolveSetupAssistModel()`  [INFERRED]
  docs/tenant-context.md → cms/src/lib/llmSettings.ts

## Import Cycles
- None detected.

## Communities (154 total, 35 thin omitted)

### Community 0 - "articleStatus.ts"
Cohesion: 0.05
Nodes (49): ArticleReviewView(), asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf() (+41 more)

### Community 1 - "igScoring.test.ts"
Cohesion: 0.12
Nodes (18): clamp01(), clampImportance(), estimateTokens(), evidenceFloorFor(), IMPORTANCE_RANGE, ratio(), relevanceFromQueries(), scoreClaim() (+10 more)

### Community 2 - "requireUser"
Cohesion: 0.21
Nodes (24): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+16 more)

### Community 3 - "setupActions.ts"
Cohesion: 0.07
Nodes (42): HomePage(), AssistMode, AssistResult, pageWarning(), refreshSitePagesAction(), RefreshSitePagesResult, WorkspaceProfileInput, SetupWorkspaceEditor() (+34 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.03
Nodes (60): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+52 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.06
Nodes (34): internalDuplicationRate(), JudgeSignals, VerifierSignals, hostnameOf(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP, ClaimRecord (+26 more)

### Community 6 - "resolveWorkspaceProfile"
Cohesion: 0.17
Nodes (15): emptyTenantContext(), resolveWorkspaceProfile(), namedOnly(), tenantFor(), withBank(), ctxWith(), article(), AUDIENCE (+7 more)

### Community 7 - "tenantLib.test.ts"
Cohesion: 0.11
Nodes (14): hasSectionContent(), PositioningEditor(), SECTION_KEYS, PositioningView(), loadAssistContext(), savePositioningAction(), upsertPositioning(), findActiveIcps() (+6 more)

### Community 8 - "exactness.ts"
Cohesion: 0.07
Nodes (37): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), comparativeOf(), compareValues(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT (+29 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.09
Nodes (37): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), BrandVoiceGuide(), downloadMarkdown() (+29 more)

### Community 10 - "verdicts.ts"
Cohesion: 0.12
Nodes (21): CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision, EvidenceFindingStatus (+13 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.10
Nodes (38): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SECTION_COMPONENTS, SectionProps (+30 more)

### Community 13 - "ref_payload"
Cohesion: 0.06
Nodes (27): dirname, __filename, nextConfig, ArticleAudit, Articles, BrandVoiceFiles, CorpusSnapshots, CostLog (+19 more)

### Community 14 - "icp.ts"
Cohesion: 0.13
Nodes (28): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf(), confidenceTag() (+20 more)

### Community 15 - "next"
Cohesion: 0.06
Nodes (42): importMap, Args, Args, GET, OPTIONS, POST, Args, IcpListView() (+34 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (26): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+18 more)

### Community 17 - "ContentList.tsx"
Cohesion: 0.10
Nodes (27): OWNER_LABEL, RunStatusDTO, ageLabel(), ContentList(), Filter, FILTER_LABEL, FILTERS, Props (+19 more)

### Community 18 - "lib.ts"
Cohesion: 0.19
Nodes (5): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT, QueryClusterEntry

### Community 19 - "src/informationGain/index.ts"
Cohesion: 0.05
Nodes (48): InformationGainPolicy, BaselineClaim, DraftClaim, Facet, Baseline claims and facets, Cost, mapWithConcurrency(), BaselineContextOptions (+40 more)

### Community 20 - "informationGain/types.ts"
Cohesion: 0.06
Nodes (37): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+29 more)

### Community 21 - "collect.ts"
Cohesion: 0.10
Nodes (41): SetupSuggestionDTO, SuggestionActionResult, collectSetupSuggestions(), normalized(), object(), outputText(), suggestionSatisfied(), text() (+33 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "brandVoiceActions.ts"
Cohesion: 0.22
Nodes (20): activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), saveBrandVoiceDraftAction(), toData(), UPLOAD_MIMETYPES, UploadExtractResult, SetupSuggestions() (+12 more)

### Community 25 - "briefActions.int.spec.ts"
Cohesion: 0.11
Nodes (13): authMock, createRunMock, edits, findByIDMock, findMock, ICPS, setupMock, updateMock (+5 more)

### Community 26 - "cmsLlm.ts"
Cohesion: 0.16
Nodes (13): CmsCostStage, CmsLlmRequest, CmsLlmResult, cmsMockMode(), completeJsonCms(), logCmsCost(), parseBool(), parseJsonReply() (+5 more)

### Community 27 - "tenant/fixtures.ts"
Cohesion: 0.14
Nodes (16): ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE, ICP_FIXTURE, ICP_FIXTURE_SECONDARY, POSITIONING_FIXTURE, WORKSPACE_PROFILE_FIXTURE, LlmSetting (+8 more)

### Community 28 - "tenantActions.ts"
Cohesion: 0.10
Nodes (32): CascadeContext, gateIcpActivation(), AssetStep, IcpEditor(), IcpReview(), mergeAssist(), IcpEditorView(), ICP_STEPS (+24 more)

### Community 29 - "llm.ts"
Cohesion: 0.08
Nodes (28): PIPELINE_STAGES, PipelineStage, draftClaimsFixture, evidenceCheckFixture, evidenceVerificationFixture, facetClusteringFixture, factCheckFixture, fixtures (+20 more)

### Community 30 - "topicDiscoveryActions.ts"
Cohesion: 0.20
Nodes (19): compact(), difficultyLabel(), Props, TopicDiscovery(), cachedCandidates(), createTopicsAction(), discoverTopicsAction(), isFresh() (+11 more)

### Community 31 - "seedContentOps.ts"
Cohesion: 0.14
Nodes (19): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+11 more)

### Community 32 - "sourceReviewActions.ts"
Cohesion: 0.21
Nodes (14): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), Badges() (+6 more)

### Community 33 - "generatePrompt.ts"
Cohesion: 0.08
Nodes (43): BrandVoiceContent, brandVoiceSamplesToPrompt(), BRAND_VOICE_FIXTURE, InformationGap, CompanyMentions, companyMentionsOf(), evidenceRules(), IcpContent (+35 more)

### Community 34 - "igCoverage.test.ts"
Cohesion: 0.21
Nodes (7): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf()

### Community 35 - "ahrefs.ts"
Cohesion: 0.07
Nodes (36): executeContentRun(), safeError(), Commit messages and PR titles, AhrefsClientOptions, AhrefsProfile, createAhrefsClient(), GapKeyword, MatchingTermRow (+28 more)

### Community 36 - "qa/index.ts"
Cohesion: 0.09
Nodes (32): bannedWordsOf(), Template, sumArticleCost(), qaStage, bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade() (+24 more)

### Community 37 - "igText.test.ts"
Cohesion: 0.16
Nodes (7): excerptFoundIn(), keywordTokens(), nearDuplicateJaccard(), normaliseWhitespace(), STOPWORDS, tokenOverlap(), Mock mode

### Community 38 - "react"
Cohesion: 0.21
Nodes (22): sendBackAction(), evidenceFindingsOf(), formatAuditTimestamp(), ArchiveAction(), OpenInAdmin(), EvidenceCard(), PANEL_FOR_STATUS, ApprovedPanel() (+14 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.12
Nodes (34): parsePageClaims(), selectInternalCorpus(), CorpusSnapshot, Corpus snapshots, adopt(), articleText(), cachedClaims(), countUnverifiedExcerpts() (+26 more)

### Community 40 - "Changelog"
Cohesion: 0.06
Nodes (32): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+24 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (23): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+15 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.13
Nodes (32): SCORE_INVALIDATED_EVENT, scoreInvalidatedFields(), scoreInvalidatedSummary(), scoreInvalidationNotice(), ArticleAuditContext, auditArticleChange(), AuditRequestContext, emitArticleStatusEvent() (+24 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.10
Nodes (31): AuditTimelineEntry, AuditTimeline(), Props, deleteDraftAction(), BrandVoiceEditor(), BrandVoiceReview(), clampQuestion(), contentOf() (+23 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.18
Nodes (21): asArray(), asDay(), asRecord(), asString(), depthOf(), emptyEvidenceBankContent(), evidenceBankToPrompt(), EvidenceRefCheck (+13 more)

### Community 45 - "parsers.ts"
Cohesion: 0.09
Nodes (39): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+31 more)

### Community 46 - "briefActions.ts"
Cohesion: 0.40
Nodes (10): actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience(), revalidate() (+2 more)

### Community 47 - "stages.ts"
Cohesion: 0.08
Nodes (20): PipelineStageName, Article, AhrefsClient, EvidenceCitation, GeneratedArticle, generateStage, researchStage, resolveTemplate() (+12 more)

### Community 48 - "NewContentFlow.tsx"
Cohesion: 0.13
Nodes (14): ExtraOpsNavLinks(), NavLink, Section, SECTIONS, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+6 more)

### Community 49 - "llmSettlement.test.ts"
Cohesion: 0.11
Nodes (19): LlmSettingsDoc, Registering a model setting (shared by Tasks 3 and 4), SerpResearch, buildConfig(), config, here, parseBool(), PipelineConfig (+11 more)

### Community 50 - "workspaceReadiness.ts"
Cohesion: 0.15
Nodes (11): tenantFingerprint(), WorkspaceProfileSource, configured(), evaluateRuntimeReadiness(), evaluateWorkspaceReadiness(), fingerprint(), GovernanceAsset, PipelineMode (+3 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (15): ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS, FetchedPage, fetchPage() (+7 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.09
Nodes (29): asRecord(), AssetStepper(), AssistConfig, Props, AssistPanel(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL (+21 more)

### Community 53 - "payloadClient.ts"
Cohesion: 0.28
Nodes (6): articleId, [articleIdArg, ...templateNameParts], templateName, CLEARED, [command, ...rest], initPayload()

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewTypes.ts"
Cohesion: 0.13
Nodes (16): loadSourceReviewArticles(), ArticleLookup, asRecordArray(), CandidateCitation, CandidateDTO, CandidateStatus, CoveringRule, formatSeenAt() (+8 more)

### Community 56 - "llmSettings.ts"
Cohesion: 0.15
Nodes (22): LlmSettings, DEFAULT_MODEL, LLM_MODEL_OPTIONS, LlmModel, money(), PROVIDER_LABEL, EXTRACTION_ENV_VAR, LLM_SETTING_FIELDS (+14 more)

### Community 57 - "topicRelevance.ts"
Cohesion: 0.22
Nodes (21): emptyPositioningContent(), audienceVocabulary(), buildTopicRelevancePrompt(), cachedTopicRelevance(), distinctiveStems(), excludedVerdict(), exclusionWords(), FITS (+13 more)

### Community 58 - "igCandidates.test.ts"
Cohesion: 0.11
Nodes (9): CandidateSighting, mergeSightings(), isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), collect() (+1 more)

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 61 - "lib/informationGain/candidates.ts"
Cohesion: 0.19
Nodes (16): CANDIDATE_RANK, CandidateClass, CandidateKind, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, modalBy(), SERP_SECONDARY_MIN_DR (+8 more)

### Community 62 - "ArticleReview.tsx"
Cohesion: 0.17
Nodes (19): ArticleReview(), Props, BoardArticle, BriefEditor(), BriefIcpOption, Props, Section, PipelineStepper() (+11 more)

### Community 63 - "seed.ts"
Cohesion: 0.18
Nodes (16): evidenceBankFixtureDoc(), positioningFixtureDoc(), evidenceSources, heading(), Node, paragraph(), RichText, seed() (+8 more)

### Community 64 - "evidenceBankSummary"
Cohesion: 0.26
Nodes (12): claimProblems(), checkEvidenceRefs(), cleared(), evidenceBankSummary, expired(), expiredClaims(), incompleteClaims(), isClaimComplete() (+4 more)

### Community 65 - "assist.ts"
Cohesion: 0.10
Nodes (34): assistAction(), assistError(), AssistInput, applyEvidenceRules(), asRecord(), ASSET_MEANING, ASSIST_ASSETS, ASSIST_CONFIDENCE_LEVELS (+26 more)

### Community 66 - "ref_node_assert"
Cohesion: 0.10
Nodes (12): CONFIDENCE_LEVELS, emptyIcpContent(), briefWith(), facets, gaps, ICP, voice, allowed (+4 more)

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "GlobalRunBar.tsx"
Cohesion: 0.09
Nodes (30): stageOf(), latestRunAction(), CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO, RunFailureDTO, runProgress() (+22 more)

### Community 69 - "boardActions.ts"
Cohesion: 0.11
Nodes (30): isRunnableStatus(), isStalled(), BoardActionResult, plural(), removeTopicsAction(), runSelectedArticlesAction(), startContentRunAction(), StartContentRunInput (+22 more)

### Community 70 - "README.md"
Cohesion: 0.17
Nodes (7): cms, Useful scripts (from `cms/` or `npm run … --workspace cms`), Setup suggestions, Hand-edit policy, How it works, One-time repository settings, Releasing

### Community 71 - "findPublishedArticle.ts"
Cohesion: 0.24
Nodes (7): metadata, metadataBase, buildArticleMetadata(), publicFields, PublishedArticle, getMetadataBase(), getSiteUrl()

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.05
Nodes (49): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+41 more)

### Community 74 - "reviewPanels.int.spec.ts"
Cohesion: 0.18
Nodes (16): InformationGainRunView, AuditSummary, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence(), ClaimFlags() (+8 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "TemplateConfigEditor.tsx"
Cohesion: 0.20
Nodes (15): Templates, createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView() (+7 more)

### Community 77 - "EvidenceBank.ts"
Cohesion: 0.20
Nodes (17): ArrayField, ARRAYS, assignEvidenceRefs(), counterOf(), EvidenceBank, highestRefIn(), idOf(), Prefix (+9 more)

### Community 79 - "Brand voice and style guide"
Cohesion: 0.29
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
Cohesion: 0.16
Nodes (16): AssistContext, EvidenceBankContent, isEvidenceBankEmpty(), icpIdOf(), selectIcp(), TenantContext, PositioningContent, ResolvedWorkspaceProfile (+8 more)

### Community 86 - "InformationGainPolicy.ts"
Cohesion: 0.27
Nodes (6): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField(), POLICY_FIELDS

### Community 87 - "mockPages.ts"
Cohesion: 0.12
Nodes (14): MOCK_TARGET_DOMAIN, competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST (+6 more)

### Community 88 - "Information gain (VMIG)"
Cohesion: 0.20
Nodes (9): Claims nobody checked, Information gain (VMIG), Running the whole thing, Scoring a draft, Source quality, and why classifying domains is real work, The regeneration loop, What is deferred, What is written (+1 more)

### Community 89 - "Findings"
Cohesion: 0.10
Nodes (21): qaFailures(), CheckRow(), QaFailures(), QaTriage(), sourceLabel(), stageKpis(), Consolidation proposals, Findings (+13 more)

### Community 90 - "lib/llmProvider.ts"
Cohesion: 0.32
Nodes (11): ExtractionResult, apiKeyForModel(), ApiKeyProvider, envVarNameForModel(), LlmProvider, PROVIDER_ENV_VAR_NAME, providerForModel(), ProviderRequirement (+3 more)

### Community 91 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 92 - "addressGuard.ts"
Cohesion: 0.36
Nodes (10): RFC-1918, INTERNAL_SUFFIXES, isBlockedAddress(), isBlockedHostname(), isBlockedIPv4(), normaliseHostname(), parseIPv4(), parseIPv6() (+2 more)

### Community 93 - "Tenant context"
Cohesion: 0.17
Nodes (12): Gating, How prompts use them, Learning from review, Positioning, Precedence, Tenant context, The assets, The brief in review (+4 more)

### Community 94 - "brandVoiceExtract.ts"
Cohesion: 0.11
Nodes (25): extractBrandVoiceFromUploadAction(), BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode(), extractionModel(), logExtractionCost(), mockExtraction() (+17 more)

### Community 95 - "articleActions.int.spec.ts"
Cohesion: 0.07
Nodes (22): authMock, countMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findByIDMock, findMock, updateMock, article(), authMock (+14 more)

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "Evidence bank"
Cohesion: 0.33
Nodes (6): Evidence bank, Expiry, Information gain, Prompt size, Readiness, Refs

### Community 98 - "Contributing to Datum"
Cohesion: 0.22
Nodes (9): Architecture notes, Code of conduct, Commands, Contributing to Datum, Development setup, Pull requests, Schema / types, Shared code graph (+1 more)

### Community 99 - "Tenant steering improvements: implementation plan"
Cohesion: 0.33
Nodes (5): Decisions to confirm before starting, Order and dependencies, Out of scope, Tenant steering improvements: implementation plan, Verification for the whole plan

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 102 - "workspaceProfile.int.spec.ts"
Cohesion: 0.25
Nodes (3): WorkspaceProfile, COMPETITOR_DOMAINS_ENV_VAR, TARGET_DOMAIN_ENV_VAR

### Community 103 - "positioning.ts"
Cohesion: 0.17
Nodes (17): asArray(), asRecord(), asString(), evidenceRefOf(), Loose, OpenRulingStatus, parsePositioningContent(), PositioningClaim (+9 more)

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

### Community 108 - "lexicalHtml.ts"
Cohesion: 0.22
Nodes (11): generateMetadata(), Props, PublishedArticlePage(), revalidate, findPublishedArticle, escapeHtml(), lastH2HeadingText(), lexicalBodyToHtml() (+3 more)

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "AI assist"
Cohesion: 0.29
Nodes (7): capAssistConfidence(), AI assist, Model, mock mode, and cost, Sections, What it never does, What it reads, icp()

### Community 111 - "BrandVoiceView.tsx"
Cohesion: 0.31
Nodes (8): BrandVoiceAuditEntry, BrandVoiceMode, BrandVoiceView(), MODES, param(), toAuditEntry(), toDTO(), BrandVoice

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
Cohesion: 0.10
Nodes (16): GovernanceAudit, Icps, GovernanceSubject, hook, create(), createdArticleIds, createdIds, icpData() (+8 more)

### Community 119 - "extractEvidenceCitations"
Cohesion: 0.50
Nodes (4): stripEvidenceRefs(), Task 2: One coherent demo workspace, extractEvidenceCitations(), sentencesOf()

### Community 120 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 121 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next, typescript-eslint

### Community 122 - "auditTypes.ts"
Cohesion: 0.17
Nodes (16): auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, auditEventLabel(), AuditSource, AuditRow (+8 more)

### Community 123 - "lib/pricing.ts"
Cohesion: 0.33
Nodes (5): LLM_CATALOG, costUsd(), LEGACY_PRICES, PRICES, warnedModels

### Community 127 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, tsx, @types/node, typescript

### Community 138 - "[...slug]/route.ts"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 146 - "vitest"
Cohesion: 0.07
Nodes (12): PublishDueTask, GovernanceAudit, privateCollections, privateGlobals, execute, handler, runTask(), authStub (+4 more)

## Knowledge Gaps
- **831 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+826 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1118 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `setupActions.ts`, `lib/brandVoice.ts`, `ref_payload`, `next`, `webhookDeliver.int.spec.ts`, `ContentList.tsx`, `briefActions.int.spec.ts`, `cmsLlm.ts`, `tenant/fixtures.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `NewContentFlow.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `llmSettings.ts`, `GlobalRunBar.tsx`, `boardActions.ts`, `findPublishedArticle.ts`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `tenant.ts`, `InformationGainPolicy.ts`, `brandVoiceExtract.ts`, `articleActions.int.spec.ts`, `EvidenceSourceCandidates.ts`, `workspaceProfile.int.spec.ts`, `EvidenceSources.ts`, `informationGainRuns.int.spec.ts`, `icps.int.spec.ts`, `graphqlSchema.int.spec.ts`, `auditTypes.ts`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _831 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Why does `@payloadcms/db-postgres` connect `@payloadcms/db-postgres` to `migrations/index.ts`, `20260826_225347_information_gain_schema.ts`, `20260827_155913_topic_discovery.ts`, `20260827_183330_board_selected_runs.ts`, `20260827_184000_article_archived.ts`, `20260831_190025_webhook_settings_and_delivery_task.ts`, `20260831_191144_scheduled_publishing.ts`, `20260902_210000_codex_model_options.ts`, `20260903_020919_workspace_profile_global.ts`, `20260903_022301_icps_collection_and_article_icp.ts`, `ref_payload`, `20260903_024506_positioning_global_and_llm_stage_schema.ts`, `20260903_030748_evidence_bank_global_and_qa.ts`, `20260905_232800_graphql_policy_options.ts`, `20260911_145800_drop_codex_model_options.ts`, `20260911_152559_pipeline_runs_drop_onboarding_source.ts`, `20261006_205858_articles_lookup_indexes.ts`, `20261007_121854_template_company_mentions.ts`, `20261007_133223_brief_angles.ts`, `cms/package.json`, `boardActions.ts`, `ReportsPanel.tsx`, `20260826_015027_existing_schema_baseline.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `igScoring.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11612903225806452 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `articleStatus.ts`, `requireUser`, `setupActions.ts`, `tenantLib.test.ts`, `ref_payload`, `webhookDeliver.int.spec.ts`, `ContentList.tsx`, `brandVoiceActions.ts`, `tenantActions.ts`, `topicDiscoveryActions.ts`, `sourceReviewActions.ts`, `react`, `cms/package.json`, `BrandVoiceEditor.tsx`, `briefActions.ts`, `NewContentFlow.tsx`, `EvidenceBankEditor.tsx`, `sourceReviewTypes.ts`, `ArticleReview.tsx`, `GlobalRunBar.tsx`, `boardActions.ts`, `findPublishedArticle.ts`, `ReportsPanel.tsx`, `TemplateConfigEditor.tsx`, `lexicalHtml.ts`, `BrandVoiceView.tsx`, `auditTypes.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `setupActions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06836055656382335 - nodes in this community are weakly interconnected._