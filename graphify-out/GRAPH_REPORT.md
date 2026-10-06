# Graph Report - datum  (2026-10-06)

## Corpus Check
- 399 files · ~1,003,097 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 3, .example 2)

## Summary
- 2874 nodes · 7403 edges · 149 communities (119 shown, 30 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 251 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `18bdbc88`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- articleStatus.ts
- igText.test.ts
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
- ref_payload
- igFixtures.test.ts
- @payloadcms/next
- webhookDeliver.int.spec.ts
- stages.ts
- tenantLib.test.ts
- src/informationGain/index.ts
- briefActions.ts
- src/index.ts
- setupChecklist.int.spec.ts
- DESIGN.md
- Facet
- report.ts
- seedContentOps.ts
- resolveWorkspaceProfile
- errorMessage
- auditTypes.ts
- icp.ts
- RunBarProvider.tsx
- capture.mjs
- setupActions.ts
- boardActions.int.spec.ts
- ahrefs.ts
- richtext.ts
- loadWorkspaceSetup
- actions.ts
- snapshot.ts
- Changelog
- cms/package.json
- articleReviewGate.ts
- BrandVoiceEditor.tsx
- evidenceBank.ts
- parsers.ts
- react
- tenantActions.ts
- workspaceReadiness.ts
- igCandidates.test.ts
- qaStagePrompts.test.ts
- fetchPage.ts
- EvidenceBankEditor.tsx
- positioning.ts
- package.json
- sourceReviewActions.ts
- llm.ts
- ref_node_crypto
- src/informationGain/candidates.ts
- compilerOptions
- sourceReviewTypes.ts
- topicDiscoveryActions.ts
- [slug]/page.tsx
- Icps.ts
- importMap.js
- tenant/fixtures.ts
- ref_node_assert
- dependencies
- boardActions.ts
- ArticleReview.tsx
- README.md
- next
- devDependencies
- ReportsPanel.tsx
- reviewPanels.int.spec.ts
- scripts
- seed.ts
- EvidenceBank.ts
- Brand voice and style guide
- Security Policy
- compilerOptions
- Datum
- fetchPage.test.ts
- generatePrompt.ts
- generate.ts
- mockPages.ts
- Findings
- contentRun.ts
- ArticleReviewView.tsx
- Contributor Covenant Code of Conduct
- addressGuard.ts
- payloadClient.ts
- brandVoiceActions.ts
- briefActions.int.spec.ts
- dependencies
- Evidence bank
- Contributing to Datum
- open-source-checklist.md
- Agent instructions
- EvidenceSources.ts
- informationGainRuns.int.spec.ts
- articleActions.int.spec.ts
- scripts
- ig-e2e.sh
- devDependencies
- Operations
- topicDiscoveryActions.int.spec.ts
- repository
- Global Constraints
- vitest
- @payloadcms/db-postgres
- AhrefsClient
- corpusSnapshots.int.spec.ts
- PULL_REQUEST_TEMPLATE.md
- .prettierrc.json
- migrations/index.ts
- 20260826_015027_existing_schema_baseline.ts
- eslint.config.mjs
- repository
- ExtraOpsNavLinks.tsx
- Quick start
- RealAhrefsClient
- release-please-config.json
- review-prompt.md
- cms/AGENTS.md
- loadInformationGainPolicy
- engines
- InformationGainPolicy.ts
- Releasing
- bugs

## God Nodes (most connected - your core abstractions)
1. `react` - 82 edges
2. `vitest` - 61 edges
3. `next` - 55 edges
4. `requireUser()` - 53 edges
5. `resolveWorkspaceProfile()` - 45 edges
6. `errorMessage()` - 34 edges
7. `loadWorkspaceSetup()` - 32 edges
8. `Field()` - 31 edges
9. `Article` - 27 edges
10. `@payloadcms/db-postgres` - 22 edges

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
Cohesion: 0.06
Nodes (52): asRecord(), asRecordArray(), asStringSet(), DECISIONS, describeViolation(), EvidenceCitationRow, evidenceCitationsOf(), EvidenceFindingRow (+44 more)

### Community 1 - "igText.test.ts"
Cohesion: 0.17
Nodes (6): keywordTokens(), nearDuplicateJaccard(), selectInternalCorpus(), STOPWORDS, tokenOverlap(), intraDocumentNovelty()

### Community 2 - "tenant.ts"
Cohesion: 0.16
Nodes (8): EvidenceBank, clear(), EMPTY_GLOBAL, readGlobal(), refsOf(), startFresh(), loadTenantContext(), loadWorkspaceProfile()

### Community 3 - "sitePages.int.spec.ts"
Cohesion: 0.11
Nodes (17): candidatePagePaths(), FetchedPageLike, hostKey(), isSameSite(), MAX_DISCOVERED_PAGES, MAX_SITE_PAGES, pathKey(), SITE_PAGE_PATH_PATTERN (+9 more)

### Community 4 - "payload-types.ts"
Cohesion: 0.04
Nodes (55): ArticleAudit, ArticleAuditSelect, ArticlesSelect, Auth, BrandVoiceFile, BrandVoiceFilesSelect, BrandVoicesSelect, CollectionsWidget (+47 more)

### Community 5 - "scorecard.ts"
Cohesion: 0.07
Nodes (33): internalDuplicationRate(), JudgeSignals, PolicyFieldDef, EvidenceSourceRule, hostnameOf(), resolveSourceQuality(), SOURCE_QUALITY_SCORE, UNKNOWN_DOMAIN_CAP (+25 more)

### Community 6 - "igPolicy.test.ts"
Cohesion: 0.07
Nodes (28): canonicalise(), decidePolicy(), dedupe(), DEFAULTS_BY_KEY, FALSE_WORDS, fromAdmin(), fromEnv(), maxDecision() (+20 more)

### Community 7 - "igScoring.test.ts"
Cohesion: 0.10
Nodes (19): InformationGainPolicy, clamp01(), estimateTokens(), evidenceFloorFor(), FACET_GAIN_THRESHOLD, IMPORTANCE_RANGE, ratio(), relevanceFromQueries() (+11 more)

### Community 8 - "exactness.ts"
Cohesion: 0.09
Nodes (27): AMOUNT, attests(), COMPARATIVE_LABEL, comparativeCompatible(), CURRENCY_BY_SYMBOL, DIGIT_AMOUNT, directionCompatible(), MONTH_SRC (+19 more)

### Community 9 - "lib/brandVoice.ts"
Cohesion: 0.08
Nodes (40): BrandVoices, BrandVoiceStatus, CascadeContext, cascadeSingleActive(), draftOnlyDelete(), gateActivation(), BrandVoiceGuide(), downloadMarkdown() (+32 more)

### Community 10 - "qa/index.ts"
Cohesion: 0.10
Nodes (21): sumArticleCost(), CLAIM_STATUSES, decideEvidence(), decideQualitative(), EvidenceCheckVerdict, EvidenceClaimFinding, EvidenceClaimStatus, EvidenceDecision (+13 more)

### Community 11 - "pipeline/package.json"
Cohesion: 0.10
Nodes (20): bugs, url, description, engines, node, homepage, @anthropic-ai/sdk, dotenv (+12 more)

### Community 12 - "Field"
Cohesion: 0.12
Nodes (34): AdjectivesSection(), AudienceSection(), EssenceSection(), NotTraitsSection(), PersonaSection(), SamplesSection(), SECTION_COMPONENTS, SectionProps (+26 more)

### Community 13 - "ref_payload"
Cohesion: 0.06
Nodes (25): dirname, __filename, nextConfig, ArticleAudit, Articles, BrandVoiceFiles, CostLog, Media (+17 more)

### Community 14 - "igFixtures.test.ts"
Cohesion: 0.08
Nodes (30): comparativeOf(), compareValues(), directionOf(), ExtractedValue, extractValues(), TextValues, fixture(), Claims nobody checked (+22 more)

### Community 15 - "@payloadcms/next"
Cohesion: 0.08
Nodes (14): importMap, Args, Args, GET, OPTIONS, POST, DELETE, GET (+6 more)

### Community 16 - "webhookDeliver.int.spec.ts"
Cohesion: 0.11
Nodes (26): POST(), WebhookSettings, DELIVERY_RETRIES, DELIVERY_TIMEOUT_MS, EVENT_HEADER, SIGNATURE_HEADER, signWebhookBody(), TIMESTAMP_HEADER (+18 more)

### Community 17 - "stages.ts"
Cohesion: 0.10
Nodes (15): PipelineStageName, Article, InternalCorpusDoc, informationGainStage, StageModels, qaStage, ArticleStatus, describeFailures() (+7 more)

### Community 18 - "tenantLib.test.ts"
Cohesion: 0.10
Nodes (4): IcpOption, PipelineRunSummary, relationshipIds(), MOCK_TARGET_DOMAIN

### Community 19 - "src/informationGain/index.ts"
Cohesion: 0.05
Nodes (53): DEFAULT_MAX_DRAFT_CLAIMS, VerifierSignals, DEFAULT_POLICY, CLAIM_TYPES, DraftClaim, Cost, BaselineContextOptions, batchFacetId() (+45 more)

### Community 20 - "briefActions.ts"
Cohesion: 0.12
Nodes (28): runSelectedArticlesAction(), actorOf(), approveBriefAction(), BriefActionResult, BriefEdits, cleanEdits(), icpIdOf(), resolveAudience() (+20 more)

### Community 21 - "src/index.ts"
Cohesion: 0.29
Nodes (11): createAhrefsClient(), CliArgs, main(), parseArgs(), resolveTemplateId(), usage(), loadEvidenceSources(), createLlmClient() (+3 more)

### Community 22 - "setupChecklist.int.spec.ts"
Cohesion: 0.31
Nodes (10): checklistRows(), evidenceState(), plural(), positioningState(), Row, SetupChecklistData, workspaceState(), WorkspaceSetupData (+2 more)

### Community 23 - "DESIGN.md"
Cohesion: 0.06
Nodes (35): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+27 more)

### Community 24 - "Facet"
Cohesion: 0.16
Nodes (11): applyTemplateHints(), consensusCoverage(), facetWeights(), normaliseHint(), safeWeight(), usableTotalOf(), weightOf(), Facet (+3 more)

### Community 25 - "report.ts"
Cohesion: 0.15
Nodes (18): stageKpis(), articleIdOf(), IG_DECISIONS, informationGainRunId(), meanOf(), PassCounter, printReport(), rate() (+10 more)

### Community 26 - "seedContentOps.ts"
Cohesion: 0.14
Nodes (19): ids, user, deliveries, Delivery, seededIds, seededIds, login(), LoginOptions (+11 more)

### Community 27 - "resolveWorkspaceProfile"
Cohesion: 0.19
Nodes (21): HomePage(), pageWarning(), refreshSitePagesAction(), SetupWorkspaceEditor(), StepId, STEPS, WorkspaceEditorData, SetupWorkspaceView() (+13 more)

### Community 28 - "errorMessage"
Cohesion: 0.12
Nodes (32): gateIcpActivation(), asRecord(), AssetStep, AssetStepper(), AssistConfig, hasSectionContent(), Props, IcpEditor() (+24 more)

### Community 29 - "auditTypes.ts"
Cohesion: 0.20
Nodes (15): auditDetailsAction(), AuditEvidence(), State, AUDIT_EVENT_LABELS, AuditDetailResult, auditEventLabel(), AuditSource, AuditRow (+7 more)

### Community 30 - "icp.ts"
Cohesion: 0.12
Nodes (30): Confidence, CONFIDENCE_LABEL, CONFIDENCE_LEGEND, CONFIDENCE_LEVELS, CONFIDENCE_OPTIONS, CONFIDENCE_USAGE, CONFIDENCE_USAGE_HINT, confidenceOf() (+22 more)

### Community 31 - "RunBarProvider.tsx"
Cohesion: 0.39
Nodes (5): RunBarProvider(), RuntimeBanner(), runtimeStatusAction(), mocks, show()

### Community 32 - "capture.mjs"
Cohesion: 0.15
Nodes (6): execute, all, extra, results, routes, viewports

### Community 33 - "setupActions.ts"
Cohesion: 0.08
Nodes (49): assistAction(), assistError(), AssistInput, AssistMode, AssistResult, loadAssistContext(), RefreshSitePagesResult, logCmsCost() (+41 more)

### Community 34 - "boardActions.int.spec.ts"
Cohesion: 0.15
Nodes (10): authMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findMock, readyReadiness(), readySetup(), authMock, createMock, findByIDMock (+2 more)

### Community 35 - "ahrefs.ts"
Cohesion: 0.13
Nodes (13): AhrefsClientOptions, AhrefsProfile, GapKeyword, MatchingTermRow, OrganicKeywordRow, SerpPage, SerpPositionRow, SerpResearch (+5 more)

### Community 36 - "richtext.ts"
Cohesion: 0.13
Nodes (23): bannedPhraseViolations(), countSyllables(), escapeRegex(), fleschKincaidGrade(), HeadingProblem, headingViolations(), runStructuralChecks(), StructuralCheckOptions (+15 more)

### Community 37 - "loadWorkspaceSetup"
Cohesion: 0.23
Nodes (13): startContentRunAction(), ContentRunForm(), submit(), Props, FIX_HREF, NewContentFlow(), Props, SetupBlocker (+5 more)

### Community 38 - "actions.ts"
Cohesion: 0.22
Nodes (23): approveArticleAction(), archiveArticleAction(), assignTemplateAction(), auditContext(), CLEARED_SCHEDULE, currentInformationGainRun(), NULL_QA_RESULTS, overrideReviewAction() (+15 more)

### Community 39 - "snapshot.ts"
Cohesion: 0.12
Nodes (34): BaselineClaim, QueryClusterEntry, userAgentFor(), CorpusSnapshot, Corpus snapshots, adopt(), articleText(), cachedClaims() (+26 more)

### Community 40 - "Changelog"
Cohesion: 0.07
Nodes (28): 0.1.0 (2026-08-25), [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26), [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27), [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31), [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03), [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03), [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04), [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04) (+20 more)

### Community 41 - "cms/package.json"
Cohesion: 0.08
Nodes (24): description, homepage, @anthropic-ai/sdk, dotenv, openai, payload, tsx, @types/node (+16 more)

### Community 42 - "articleReviewGate.ts"
Cohesion: 0.14
Nodes (30): SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(), ArticleAuditContext, auditArticleChange(), AuditRequestContext, emitArticleStatusEvent(), CLEARED_INFORMATION_GAIN, freshJustification() (+22 more)

### Community 43 - "BrandVoiceEditor.tsx"
Cohesion: 0.08
Nodes (43): AuditTimelineEntry, AuditTimeline(), Props, activateBrandVoiceAction(), archiveBrandVoiceAction(), createBrandVoiceDraftAction(), deleteDraftAction(), saveBrandVoiceDraftAction() (+35 more)

### Community 44 - "evidenceBank.ts"
Cohesion: 0.08
Nodes (32): asArray(), asDay(), asRecord(), asString(), checkEvidenceRefs(), cleared(), depthOf(), emptyEvidenceBankContent() (+24 more)

### Community 45 - "parsers.ts"
Cohesion: 0.11
Nodes (30): arrayField(), asClaimType(), asProbability(), asRecord(), asStringArray(), asText(), asTrimmed(), ClaimCore (+22 more)

### Community 46 - "react"
Cohesion: 0.19
Nodes (25): sendBackAction(), evidenceFindingsOf(), formatAuditTimestamp(), isRunnableStatus(), ArchiveAction(), OpenInAdmin(), EvidenceCard(), PANEL_FOR_STATUS (+17 more)

### Community 47 - "tenantActions.ts"
Cohesion: 0.18
Nodes (19): PositioningEditor(), SECTION_KEYS, POSITIONING_SECTION_COMPONENTS, POSITIONING_STEPS, PositioningStepId, PositioningView(), activateDefaultBrandVoiceAction(), activateDefaultTenantAction() (+11 more)

### Community 48 - "workspaceReadiness.ts"
Cohesion: 0.10
Nodes (25): AssistContext, EvidenceBankContent, IcpContent, TenantContext, tenantFingerprint(), PositioningContent, ResolvedWorkspaceProfile, WorkspaceProfileSource (+17 more)

### Community 49 - "igCandidates.test.ts"
Cohesion: 0.10
Nodes (16): CANDIDATE_RANK, CandidateClass, CandidateKind, collectCandidateSightings(), isSighting(), MAX_CANDIDATE_SIGHTINGS, mergeSightings(), modalBy() (+8 more)

### Community 50 - "qaStagePrompts.test.ts"
Cohesion: 0.07
Nodes (33): emptyTenantContext(), emptyPositioningContent(), repoRoot, LlmRequest, markdownToLexical(), loadStyleGuide(), parseBannedPhrases(), StyleGuide (+25 more)

### Community 51 - "fetchPage.ts"
Cohesion: 0.11
Nodes (17): normaliseWhitespace(), Mock mode, ALLOWED_PROTOCOLS, cancelBody(), Cleared, CrawlRequestInit, extractReadableText(), FETCH_TIMEOUT_MS (+9 more)

### Community 52 - "EvidenceBankEditor.tsx"
Cohesion: 0.10
Nodes (26): AssistPanel(), claimProblems(), DEPTH_LABEL, EvidenceBankEditor(), SURFACE_LABEL, Tab, TAB_BLURB, TABS (+18 more)

### Community 53 - "positioning.ts"
Cohesion: 0.20
Nodes (14): asArray(), asRecord(), asString(), evidenceRefOf(), Loose, OpenRulingStatus, parsePositioningContent(), PositioningClaim (+6 more)

### Community 54 - "package.json"
Cohesion: 0.08
Nodes (23): bugs, url, description, engines, node, homepage, license, name (+15 more)

### Community 55 - "sourceReviewActions.ts"
Cohesion: 0.16
Nodes (17): ActionResult, actorOf(), approveCandidateAction(), dismissCandidateAction(), isQualityClass(), reopenCandidateAction(), setStatus(), Badges() (+9 more)

### Community 56 - "llm.ts"
Cohesion: 0.05
Nodes (64): LlmSettings, CmsCostStage, CmsLlmRequest, CmsLlmResult, parseBool(), parseJsonReply(), DEFAULT_MODEL, LLM_CATALOG (+56 more)

### Community 57 - "ref_node_crypto"
Cohesion: 0.10
Nodes (8): PublishDueTask, GovernanceAudit, privateCollections, privateGlobals, handler, runTask(), authStub, createdIcpIds

### Community 58 - "src/informationGain/candidates.ts"
Cohesion: 0.24
Nodes (7): CandidateSighting, isDuplicateKey(), latestRating(), numberOr(), recordCandidateSightings(), upsertDomain(), Call

### Community 59 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 60 - "sourceReviewTypes.ts"
Cohesion: 0.14
Nodes (15): loadSourceReviewArticles(), ArticleLookup, asRecordArray(), CandidateCitation, CandidateStatus, CoveringRule, formatSeenAt(), MAX_SERP_BADGES (+7 more)

### Community 61 - "topicDiscoveryActions.ts"
Cohesion: 0.24
Nodes (14): compact(), difficultyLabel(), Props, TopicDiscovery(), discoverTopicsAction(), isFresh(), recentSearchesAction(), seedKeyOf() (+6 more)

### Community 62 - "[slug]/page.tsx"
Cohesion: 0.16
Nodes (12): generateMetadata(), Props, PublishedArticlePage(), revalidate, metadata, metadataBase, buildArticleMetadata(), findPublishedArticle (+4 more)

### Community 63 - "Icps.ts"
Cohesion: 0.09
Nodes (10): GovernanceAudit, CascadeContext, Icps, GovernanceSubject, hook, create(), createdArticleIds, createdIds (+2 more)

### Community 64 - "importMap.js"
Cohesion: 0.22
Nodes (12): IcpListView(), inPersistBand(), NavOpener(), OnboardingDashboardView(), SecretField(), SetupChecklist(), loadSetupChecklistData(), SetupView() (+4 more)

### Community 65 - "tenant/fixtures.ts"
Cohesion: 0.10
Nodes (20): ASSIST_PAGE_TEXT_CAP, ASSIST_SECTIONS, AssistInput, ASSIST_MOCK_WARNING, FIXTURE_CONTENT, EVIDENCE_BANK_FIXTURE, ICP_FIXTURE, ICP_FIXTURE_SECONDARY (+12 more)

### Community 66 - "ref_node_assert"
Cohesion: 0.12
Nodes (7): buildQueryCluster(), KEYWORD_WEIGHT, RELATED_QUESTION_WEIGHT, SECONDARY_KEYWORD_WEIGHT, mapWithConcurrency(), template, client

### Community 67 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anthropic-ai/sdk, cross-env, dotenv, graphql, mammoth, next, openai (+9 more)

### Community 68 - "boardActions.ts"
Cohesion: 0.07
Nodes (43): BoardActionResult, latestRunAction(), plural(), removeTopicsAction(), CALL_LABELS, callLabel(), RunActivityDTO, RunArticleDTO (+35 more)

### Community 69 - "ArticleReview.tsx"
Cohesion: 0.19
Nodes (16): ArticleReview(), Props, BoardArticle, BriefEditor(), BriefIcpOption, Props, Section, ArticleBody() (+8 more)

### Community 71 - "next"
Cohesion: 0.18
Nodes (19): createTemplateAction(), saveTemplateConfigAction(), TemplateConfigInput, Props, Tab, TemplateConfigEditor(), TemplateConfigView(), TemplateConfigDTO (+11 more)

### Community 72 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, @testing-library/react, tsx (+8 more)

### Community 73 - "ReportsPanel.tsx"
Cohesion: 0.11
Nodes (28): CHECK_LABEL, BarList(), isPipelineStageName(), money(), Props, ReportsPanel(), stageLabel(), statusLabel() (+20 more)

### Community 74 - "reviewPanels.int.spec.ts"
Cohesion: 0.18
Nodes (16): InformationGainRunView, ScorecardClaim, AuditSummary, IgMetric(), IgMetrics(), IgReasons(), Scorecard(), ClaimEvidence() (+8 more)

### Community 75 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, dev, devsafe, generate:importmap, generate:types, jobs:run, lint (+7 more)

### Community 76 - "seed.ts"
Cohesion: 0.18
Nodes (16): evidenceBankFixtureDoc(), positioningFixtureDoc(), evidenceSources, heading(), Node, paragraph(), RichText, seed() (+8 more)

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
Cohesion: 0.15
Nodes (13): Article status flow, Datum, Documentation, Environment variables, License, Pipeline and data integration, Prerequisites, Root scripts (+5 more)

### Community 83 - "fetchPage.test.ts"
Cohesion: 0.12
Nodes (12): FETCH_MAX_BYTES, LookupFn, MAX_REDIRECTS, PAGE_TEXT_CAP_CHARS, ResolvedAddress, USER_AGENT, bodyOf(), encoder (+4 more)

### Community 85 - "generatePrompt.ts"
Cohesion: 0.07
Nodes (23): brandVoiceSamplesToPrompt(), evidenceRules(), Gap-fed generation, BriefDraft, BriefSection, BriefSectionSource, buildBrief(), clean() (+15 more)

### Community 86 - "generate.ts"
Cohesion: 0.18
Nodes (9): stripEvidenceRefs(), icpIdOf(), selectIcp(), Precedence, EvidenceCitation, extractEvidenceCitations(), GeneratedArticle, generateStage (+1 more)

### Community 87 - "mockPages.ts"
Cohesion: 0.13
Nodes (13): competitorOne, competitorTwo, genericPage, industryMag, MockPage, mockPageText(), PAGES_BY_HOST, pathOf() (+5 more)

### Community 88 - "Findings"
Cohesion: 0.12
Nodes (15): Consolidation proposals, Findings, Globals rendered raw, How to read this, Journey map, Legacy removal list, Navigation and information architecture, New content (+7 more)

### Community 89 - "contentRun.ts"
Cohesion: 0.23
Nodes (11): ContentRunTask, executeContentRun(), safeError(), PipelineRun, opportunityScore(), FetchContext, fetchTopics(), FetchTopicsOptions (+3 more)

### Community 90 - "ArticleReviewView.tsx"
Cohesion: 0.23
Nodes (9): ArticleReviewView(), isScheduleExpired(), toBoardArticle(), ACTIVE_RUN_STATUSES, activeRunArticleIds(), activeRunIncludesArticle(), loadActiveAudienceOptions(), Phase 2: UI and workflow polish Implementation Plan (+1 more)

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
Cohesion: 0.08
Nodes (34): extractBrandVoiceFromUploadAction(), UPLOAD_MIMETYPES, UploadExtractResult, BrandVoiceContent, BrandVoiceExtractionError, extractBrandVoiceFromText(), EXTRACTION_SYSTEM_PROMPT, extractionMockMode() (+26 more)

### Community 95 - "briefActions.int.spec.ts"
Cohesion: 0.22
Nodes (6): authMock, createRunMock, edits, findByIDMock, ICPS, updateMock

### Community 96 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @anthropic-ai/sdk, dotenv, linkedom, @mozilla/readability, openai, payload, undici

### Community 97 - "Evidence bank"
Cohesion: 0.29
Nodes (7): Evidence bank, Expiry, Information gain, Prompt size, Readiness, Refs, The QA evidence check

### Community 98 - "Contributing to Datum"
Cohesion: 0.20
Nodes (10): Architecture notes, Code of conduct, Commands, Commit messages and PR titles, Contributing to Datum, Development setup, Pull requests, Schema / types (+2 more)

### Community 99 - "open-source-checklist.md"
Cohesion: 0.20
Nodes (9): 1. Settings → General → Danger Zone → Change visibility → Public, 2. Settings → General → Features → enable Issues (and Discussions if desired), 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting, 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`, 5. Confirm SECURITY.md and advisories link work for the public repo, 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public, Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo., Complete these in the GitHub UI after merging open-source readiness changes: (+1 more)

### Community 100 - "Agent instructions"
Cohesion: 0.22
Nodes (8): Agent instructions, Commands, Commit attribution, File-scoped commands, graphify, Key conventions, Package manager, Project map

### Community 101 - "EvidenceSources.ts"
Cohesion: 0.26
Nodes (4): EvidenceSourceCandidates, EvidenceSources, CANDIDATE_CLASSES, SOURCE_QUALITY_CLASSES

### Community 102 - "informationGainRuns.int.spec.ts"
Cohesion: 0.25
Nodes (5): InformationGainRuns, claimIdsSubfields, claimSummarySubfields, scoresSubfields, topLevelFields

### Community 103 - "articleActions.int.spec.ts"
Cohesion: 0.22
Nodes (7): authMock, countMock, { createPipelineRunMock, loadWorkspaceSetupMock }, findByIDMock, findMock, updateMock, article()

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

### Community 108 - "topicDiscoveryActions.int.spec.ts"
Cohesion: 0.22
Nodes (7): setupMock, readiness(), authMock, CREATED, createMock, createRunMock, findMock

### Community 109 - "repository"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 110 - "Global Constraints"
Cohesion: 0.22
Nodes (9): read(), Global Constraints, Task 12: Save-and-activate for audiences, one cost aggregation (F-007, C-6), Task 13: Docs, env examples and public site (2D: F-038, F-039, F-040, C-7 docs half, L-11 docs), Task 1: Remove `codex/*` end to end (L-1, L-2, F-013), Task 5: Surface the score-invalidation rule (F-024), Task 7: Onboarding gates and New content readiness (F-003, F-006, F-008, F-009, F-017, F-019, F-041), Task 8: One nav, one surface per asset, masked secret (C-1, C-2, F-001, F-002, F-014, F-015, F-016, F-034, F-035) (+1 more)

### Community 111 - "vitest"
Cohesion: 0.32
Nodes (5): templates, runFormProps, templates, @testing-library/react, vitest

### Community 114 - "corpusSnapshots.int.spec.ts"
Cohesion: 0.33
Nodes (4): CorpusSnapshots, internalCorpusSubfields, pagesSubfields, topLevelFields

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

### Community 121 - "ExtraOpsNavLinks.tsx"
Cohesion: 0.33
Nodes (4): ExtraOpsNavLinks(), NavLink, Section, SECTIONS

### Community 122 - "Quick start"
Cohesion: 0.50
Nodes (4): First run and making content, Pipeline mock mode, Quick start, Seeded local admin

### Community 138 - "loadInformationGainPolicy"
Cohesion: 0.67
Nodes (4): Policy and evidence sources are run-scoped, `policyVersion`, loadInformationGainPolicy(), policyVersion()

### Community 141 - "InformationGainPolicy.ts"
Cohesion: 0.29
Nodes (5): ABBREVIATIONS, humaniseKey(), InformationGainPolicy, OUTCOME_COPY, policyField()

### Community 146 - "Releasing"
Cohesion: 0.50
Nodes (4): Hand-edit policy, How it works, One-time repository settings, Releasing

## Knowledge Gaps
- **796 isolated node(s):** `singleQuote`, `trailingComma`, `printWidth`, `semi`, `eslintConfig` (+791 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1068 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `articleStatus.ts`, `tenant.ts`, `sitePages.int.spec.ts`, `lib/brandVoice.ts`, `ref_payload`, `InformationGainPolicy.ts`, `webhookDeliver.int.spec.ts`, `tenantLib.test.ts`, `briefActions.ts`, `setupChecklist.int.spec.ts`, `auditTypes.ts`, `RunBarProvider.tsx`, `capture.mjs`, `boardActions.int.spec.ts`, `cms/package.json`, `articleReviewGate.ts`, `BrandVoiceEditor.tsx`, `EvidenceBankEditor.tsx`, `llm.ts`, `ref_node_crypto`, `sourceReviewTypes.ts`, `[slug]/page.tsx`, `Icps.ts`, `tenant/fixtures.ts`, `boardActions.ts`, `ReportsPanel.tsx`, `reviewPanels.int.spec.ts`, `contentRun.ts`, `ArticleReviewView.tsx`, `brandVoiceActions.ts`, `briefActions.int.spec.ts`, `EvidenceSources.ts`, `informationGainRuns.int.spec.ts`, `articleActions.int.spec.ts`, `topicDiscoveryActions.int.spec.ts`, `corpusSnapshots.int.spec.ts`, `20260826_015027_existing_schema_baseline.ts`, `ExtraOpsNavLinks.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `singleQuote`, `trailingComma`, `printWidth` to the rest of the system?**
  _796 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `articleStatus.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05721153846153846 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `articleStatus.ts`, `ref_payload`, `@payloadcms/next`, `webhookDeliver.int.spec.ts`, `briefActions.ts`, `setupChecklist.int.spec.ts`, `resolveWorkspaceProfile`, `errorMessage`, `auditTypes.ts`, `setupActions.ts`, `loadWorkspaceSetup`, `actions.ts`, `cms/package.json`, `BrandVoiceEditor.tsx`, `react`, `tenantActions.ts`, `EvidenceBankEditor.tsx`, `sourceReviewActions.ts`, `sourceReviewTypes.ts`, `topicDiscoveryActions.ts`, `[slug]/page.tsx`, `importMap.js`, `boardActions.ts`, `ArticleReview.tsx`, `ReportsPanel.tsx`, `ArticleReviewView.tsx`, `brandVoiceActions.ts`, `ExtraOpsNavLinks.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `sitePages.int.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10846560846560846 - nodes in this community are weakly interconnected._
- **Why does `@payloadcms/db-postgres` connect `@payloadcms/db-postgres` to `20260831_191144_scheduled_publishing.ts`, `20260902_210000_codex_model_options.ts`, `20260903_020919_workspace_profile_global.ts`, `20260903_022301_icps_collection_and_article_icp.ts`, `20260903_024506_positioning_global_and_llm_stage_schema.ts`, `20260903_030748_evidence_bank_global_and_qa.ts`, `20260905_232800_graphql_policy_options.ts`, `20260911_145800_drop_codex_model_options.ts`, `ref_payload`, `20260911_152559_pipeline_runs_drop_onboarding_source.ts`, `20261006_205858_articles_lookup_indexes.ts`, `briefActions.ts`, `cms/package.json`, `ReportsPanel.tsx`, `migrations/index.ts`, `20260826_015027_existing_schema_baseline.ts`, `20260827_155913_topic_discovery.ts`, `20260827_183330_board_selected_runs.ts`, `20260827_214532_brief_checkpoint.ts`, `20260831_190025_webhook_settings_and_delivery_task.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `payload-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._