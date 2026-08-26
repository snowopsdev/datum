# Information gain (VMIG)

## Why

An article can be highly novel relative to Google's organic results and still duplicate content already published elsewhere on the site — or read as fresh purely because its wording is unusual, not because it says anything new. Datum measures information gain instead as the incremental semantic value contributed by verified claims, relative to a versioned reference corpus: for a given query and a given snapshot of the competitive baseline, does this article assert something the baseline doesn't, is that assertion actually supported by a source a fact-checker could find, and does it matter to the reader's intent? A single blended score is useful for prioritization, but it cannot be what blocks or approves an article — that decision has to be traceable to individual claims, evaluated against explicit, deterministic rules, not to an opaque number a model produced. This is why the pipeline decomposes drafts into atomic claims and governs at that level: `BLOCK`/`HUMAN_REVIEW`/`REVISE`/`PASS` decisions are rule-based and attach to specific claims, not to the document as a whole.

This document covers the PR2 half of the feature — building the baseline corpus a claim is judged against. PR3 covers scoring drafts against it, the policy gates, and the review UI.

## Corpus snapshots

A corpus snapshot is the baseline a keyword's articles are judged against: the top-ranking SERP pages' text plus our own related published articles, reduced to atomic claims and clustered into consensus facets. It's captured once per `(keyword, country)` pair and reused by every article that shares the keyword, because crawling and claim-extracting a competitive set is the expensive part of this pipeline.

**What's fetched.** `getOrBuildSnapshot` (`pipeline/src/corpus/snapshot.ts`) takes the top `SERP_PAGE_CAP` (10) organic results from the keyword's SERP research and up to `INTERNAL_CORPUS_CAP` (5) of our own published articles, chosen by keyword-token overlap with the target keyword (`selectInternalCorpus` in `cms/src/lib/informationGain/text.ts`, most-overlapping first, most-recently-updated breaking ties).

**Fetch limits.** `pipeline/src/corpus/fetchPage.ts` is the pipeline's only outbound crawl and is deliberately timid: a 15-second timeout (`FETCH_TIMEOUT_MS`) bounds the request (not the body read — a slow-dribbling server is bounded by the byte cap instead), a 200KB cap (`FETCH_MAX_BYTES`) on the response body, and a 24,000-character cap (`PAGE_TEXT_CAP_CHARS`) on the extracted text. It never throws: every outcome comes back as a `FetchedPage` with a `status` of `ok`, `failed`, or `skipped`, and a `reason` when it isn't `ok`. Readable text is extracted with Mozilla's Readability library over a `linkedom` DOM, falling back to the whole `<body>` when Readability can't identify an article (common on thin or list-shaped pages). This text — capped, not the raw HTML — is what gets stored on the snapshot and sent to the claim-extraction prompt. V1 does not read `robots.txt` and does no sanitisation beyond what Readability strips; the text is only ever fed to an LLM, never rendered.

**Reuse.** A snapshot is keyed by `keywordKey` (the keyword trimmed, lower-cased, and whitespace-collapsed) and `country`. An existing snapshot is reused when it's less than `SNAPSHOT_REUSE_DAYS` (14) days old and its `status` isn't `empty` — an `empty` snapshot recorded a failed crawl, not a usable baseline, so it's never reused regardless of age. Reuse is the normal path; building is the exception, and it's what lets `pipeline:run` stay idempotent for the research stage: rerunning it against an article whose keyword already has a fresh snapshot costs one Payload query, not a new crawl.

**`snapshotHash`.** A SHA-256 fingerprint over the sorted `url|textHash` pairs of every successfully-fetched page (`snapshotHash` in `snapshot.ts`). Sorting means re-crawling the same pages in a different SERP order produces the same hash, so a rebuild can be recognised as "nothing actually changed" even though it re-paid for the crawl.

**`status` semantics.** `snapshotStatus(okPages, failedPages)`: `complete` when every fetched page yielded text, `partial` when at least one page failed or was skipped but at least one succeeded, `empty` when none did. A `skipped` page (a PDF, a non-HTML content type) counts the same as a `failed` one for this purpose — either way there's no text to extract claims from.

## Baseline claims and facets

Every successfully-fetched SERP page and every internal article in the corpus is sent to a `claimExtraction` LLM call that decomposes it into atomic `BaselineClaim`s: `{ id, text, type, excerpt, entities, values, source, facetId }` (`cms/src/lib/informationGain/types.ts`). `excerpt` is the verbatim sentence in the source page the claim is drawn from — `parsePageClaims` (`cms/src/lib/informationGain/parsers.ts`) drops claims whose excerpt can't be matched back into the fetched text, the same "the model must quote its evidence" bar the QA verdicts already use. `type` is one of the eight `CLAIM_TYPES` (factual, first_party_measurement, inference, recommendation, opinion, definition, comparison, prediction); `source.kind` distinguishes a `serp` claim from an `internal` one and carries the originating URL or article id.

Once every page's claims are pooled, one `claimExtraction` call clusters them into `Facet`s — the subtopics the baseline corpus treats as part of the answer — and the `InformationGap`s those facets leave open. A facet's `weight` is `docCount / totalDocs` (`facetWeights` in `cms/src/lib/informationGain/coverage.ts`): the share of baseline documents that cover it, so a subtopic every competitor answers outweighs one only a single page mentions. The template's `requiredSections` headings are passed into the clustering prompt as must-have hints; a facet flagged `mustHave` has its weight floored at 1 regardless of `docCount`, because the template marked it required and a thin baseline mustn't be able to discount it away. A gap (`InformationGap`) is either an unaddressed facet or a free-standing angle the corpus leaves open, each with an `evidenceHint` describing what kind of source would settle it.

Claims and clustering results are pooled up to `FACET_CLAIM_CAP` (400) claims per snapshot — beyond that the clustering prompt costs more than it learns.

## Gap-fed generation

The research stage discovers what the baseline already covers and leaves open *before* generation, not only after scoring a draft. `gapsBlock` (`pipeline/src/generatePrompt.ts`) turns an article's `research.facets` and `research.gaps` into up to four prompt sections, inserted into `buildPrompt` right before the `# Output` instructions:

1. **`# Consensus facets (must cover)`** — every facet the baseline agrees on, each annotated either `(required by template)` or `(covered by N ranking pages)`.
2. **`# Information gaps (opportunities)`** — facets or angles the baseline leaves unanswered, each with the kind of evidence that would settle it.
3. **`# Evidence rules`** — the `EVIDENCE_RULES` constant, verbatim, whenever either of the above sections is present.
4. **`# Revision notes (previous attempt)`** — a re-run's `article.revisionNotes`, when present, ending with "Fix these before anything else."

The evidence rules exist because "add more unique insights" without a boundary reads as an invitation to fabricate — Datum has no first-party data, so an instruction to be original has to be paired with a rule against synthetic novelty:

> Do not invent unique insights. Add a novel factual claim only when you can name the public source (organisation and document) a fact-checker could find; otherwise state it as an explicitly labelled inference (for example, 'In our reading of the guidance…'). Never present first-party measurements, tests, surveys, or datasets — Datum has none. Prefer covering every consensus facet over adding novelty. Every number, date, and percentage must be one you can attribute.

An article generated before this feature, or one whose snapshot yielded zero claims, has no `facets`/`gaps` and so gets none of these sections — generation behaves exactly as it did before corpus snapshots existed.

## Cost

Every `claimExtraction` call is logged through `completeJSONLogged` like any other LLM call (see `CLAUDE.md`'s Cost tracking section). Building a new snapshot costs roughly one `claimExtraction` call per fetched page (up to 10 SERP pages, plus up to 5 internal articles not already covered by another snapshot's cache) plus one more for facet clustering — around 10-16 calls total for a full snapshot, most of them short (a single page's claims). Reusing an existing snapshot costs $0: no crawl, no LLM call, just a Payload query.

The Models global (`llm-settings`) has a `claimExtractionModel` dropdown alongside the other stage models. `claude-sonnet-5` is the recommended default for this stage — claim extraction and facet clustering are structured, moderate-length JSON tasks, not long-form writing, so Sonnet's lower per-token price (see `cms/src/lib/llmCatalog.ts`) is the better trade than defaulting to Opus.

## Mock mode

With `MOCK_MODE=true`, `fetchPage` returns canned per-host text instead of making a network request (`pipeline/src/corpus/mockPages.ts`), keyed by the fetched URL's hostname. All of the mock SERP hosts, plus a generic fallback, describe the same topic — setting up a home espresso station — matching the `generate` stage's fixture article (`pipeline/src/fixtures.ts`), so a full mock pipeline run reads as topically coherent end to end. Each canned page contains the sentences the `claimExtraction` fixtures quote as `excerpt`, so `excerptFoundIn` matching succeeds against every mock host.

`completeJSONLogged`'s `claimExtraction` calls are mocked via two fixture keys: `fixtures.claimExtraction.page` returns a fixed set of claims (used for every SERP-page and internal-article extraction), and `fixtures.claimExtraction.facets` returns a fixed set of facets and gaps (used for the one clustering call per snapshot). Because every mock page returns the identical claim set, mock-mode facet `docCount`s don't vary by page the way a real, differently-worded competitive set would — mock runs exercise the data flow, not the weighting behavior of a genuinely mixed corpus.

Note that the mock fixtures are espresso-themed while the mock Ahrefs keywords (e.g. "best crm for small business") are not — this is cosmetically inconsistent but functionally irrelevant, since nothing about claim extraction or clustering depends on the keyword matching the fixture's topic.

Diagrams are updated in PR3.

## What's next

PR3 completes this feature: scoring a draft's own claims against the snapshot (novelty, relevance, utility, evidence integrity), the policy gates that turn those scores into `verified` / `needs_review` / `blocked` decisions (see the `information-gain-policy` global and `evidence-sources` collection, both already in place from PR1), and the admin review UI for claims a gate sends to human review.
