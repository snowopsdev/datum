# Information gain (VMIG)

## Why

An article can be highly novel relative to Google's organic results and still duplicate content already published elsewhere on the site — or read as fresh purely because its wording is unusual, not because it says anything new. Datum measures information gain instead as the incremental semantic value contributed by verified claims, relative to a versioned reference corpus: for a given query and a given snapshot of the competitive baseline, does this article assert something the baseline doesn't, is that assertion actually supported by a source a fact-checker could find, and does it matter to the reader's intent? A single blended score is useful for prioritization, but it cannot be what blocks or approves an article — that decision has to be traceable to individual claims, evaluated against explicit, deterministic rules, not to an opaque number a model produced. This is why the pipeline decomposes drafts into atomic claims and governs at that level: `BLOCK`/`HUMAN_REVIEW`/`REVISE`/`PASS` decisions are rule-based and attach to specific claims, not to the document as a whole.

This document covers the whole feature: building the baseline corpus a claim is judged against, scoring a draft against it, the policy gates that turn a scorecard into a decision, and what a reviewer can do about the result. `pipeline/scripts/ig-e2e.sh` walks all of it end to end in mock mode.

## Corpus snapshots

A corpus snapshot is the baseline a keyword's articles are judged against: the top-ranking SERP pages' text plus our own related published articles, reduced to atomic claims and clustered into consensus facets. It's captured once per `(keyword, country)` pair and reused by every article that shares the keyword and country, because crawling and claim-extracting a competitive set is the expensive part of this pipeline.

**What's fetched.** `getOrBuildSnapshot` (`pipeline/src/corpus/snapshot.ts`) takes the top `SERP_PAGE_CAP` (10) organic results from the keyword's SERP research and up to `INTERNAL_CORPUS_CAP` (5) of our own published articles, chosen by keyword-token overlap with the target keyword (`selectInternalCorpus` in `cms/src/lib/informationGain/text.ts`, most-overlapping first, most-recently-updated breaking ties). The published articles it scores are read in one `find` capped at 200 rows, sorted `-updatedAt`: past 200 published articles the internal corpus is chosen from the 200 most recently updated ones, not from everything, so internal-duplication detection degrades gracefully rather than arbitrarily. Raising that ceiling (or replacing the scan with a keyword-filtered query) is still open.

**Fetch limits.** `pipeline/src/corpus/fetchPage.ts` is the pipeline's only outbound crawl and is deliberately timid: a 15-second deadline (`FETCH_TIMEOUT_MS`) covers the request and the body read together — the same `AbortController` signal passed to `fetch()` also aborts an in-flight read of the response body, so a slow-dribbling server is cut off at 15 seconds too, not just a slow-to-respond one. A 200KB cap (`FETCH_MAX_BYTES`) on the response body and a 24,000-character cap (`PAGE_TEXT_CAP_CHARS`) on the extracted text are separate, independent bounds — mainly relevant to a *fast* server that sends an oversized response well inside the timeout window. It never throws: every outcome comes back as a `FetchedPage` with a `status` of `ok`, `failed`, or `skipped`, and a `reason` when it isn't `ok`. Every path that reports without reading the body — an HTTP error, a non-HTML content type, a redirect, the hop past the redirect cap — cancels it first (`cancelBody`), because a `fetch` response whose body is neither consumed nor cancelled holds its connection open, so a server streaming an error page forever would leave a socket parked per page and accumulate them across snapshots. Readable text is extracted with Mozilla's Readability library over a `linkedom` DOM, falling back to the whole `<body>` when Readability can't identify an article (common on thin or list-shaped pages). This text — capped, not the raw HTML — is what gets stored on the snapshot and sent to the claim-extraction prompt.

**What the crawler refuses.** SERP URLs are low-trust input and the fetched body is stored in Postgres and sent to an LLM, so redirects are followed by hand (`redirect: 'manual'`, at most `MAX_REDIRECTS` = 5 hops) and **every hop is checked before it is requested** rather than after — letting the runtime follow redirects would issue the internal request before anything could object. Each hop must clear two gates. First the scheme: anything that isn't `http:`/`https:` (or doesn't parse as a URL at all) is `skipped` with reason `unsupported protocol`, or `redirected to unsupported protocol` when it was a later hop. Then the host: `pipeline/src/corpus/addressGuard.ts` rejects `localhost`, any single-label hostname, and the `.localhost`/`.local`/`.internal`/`.intranet`/`.home.arpa` suffixes by name, and resolves everything else with `dns.lookup(host, { all: true })`, refusing the hop if **any** returned address is loopback (`127.0.0.0/8`, `::1`), private (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), link-local (`169.254/16` — the cloud metadata endpoint — and `fe80::/10`), unspecified (`0/8`, `::`), carrier-grade NAT (`100.64/10`), or multicast/reserved, including the IPv4-mapped IPv6 forms of all of those (`::ffff:127.0.0.1`). A refused hop is `skipped` with reason `private address` (`redirected to private address` after a hop); a chain longer than the cap is `skipped` with `too many redirects`; a host that won't resolve at all is a dead host, so it's `failed` with `dns lookup failed: <message>`. `isBlockedAddress` is pure and fails closed — an address it cannot parse is blocked — so the ranges are unit-tested exhaustively without network or DNS, and `fetchPage` takes an injectable `lookupImpl` alongside `fetchImpl` for the same reason. Clearing a hop is not the end of it: `fetch` resolves the hostname again when it opens the socket, so a host that answers publicly for the guard and privately a moment later (DNS rebinding) would otherwise pass the check and still be connected to a private address. The cleared addresses are therefore **pinned to the connection** — each hop gets its own undici `Agent` whose `connect.lookup` is `pinnedLookup(host, addresses)`, which serves only those addresses, re-applies `isBlockedAddress` to them, and errors on any other hostname or an empty set rather than falling back to real DNS. Pinning replaces address resolution only, so TLS still uses the real hostname for SNI and certificate checking. It applies to the real `fetch` alone: an injected `fetchImpl` is a stub with no socket to pin, which is what keeps the crawler's tests hermetic and free of undici. Mock mode short-circuits before any of this: no DNS, no network. V1 still does not read `robots.txt`, has no per-host throttle, and does no sanitisation beyond what Readability strips; the text is only ever fed to an LLM, never rendered.

**Politeness.** There is no per-host throttle and no 429 backoff in V1. The crawl runs three fetches at a time (`CONCURRENCY` in `snapshot.ts`) across one SERP's top ten results, which are almost always ten different hosts, so in practice a host sees one request per snapshot — but two results on the same domain would be fetched back to back, and a rate-limited host is recorded as a `failed` page (`http 429`) rather than retried.

**Reuse.** A snapshot is keyed by `keywordKey` (the keyword trimmed, lower-cased, and whitespace-collapsed) and `country`. An existing snapshot is reused when it's less than `SNAPSHOT_REUSE_DAYS` (14) days old and its `status` isn't `empty` — an `empty` snapshot recorded a failed or claimless crawl, not a usable baseline, so it's never reused regardless of age. The lookup reads the `REUSE_LOOKBACK` (3) newest rows and takes the first reusable one (`pickReusable`), so a fresh `empty` row from a total crawl failure doesn't shadow a good snapshot captured a few days earlier.

The reuse key is `(keywordKey, country)` and deliberately **not** the template, so two articles on the same keyword with different templates share one crawl. Because a facet's `mustHave` flag is derived from the *building* article's `requiredSections`, the research stage re-derives it per article — `applyTemplateHints` (`cms/src/lib/informationGain/coverage.ts`) re-matches each facet's `matchesHint` or `label` against the consuming article's own template headings before the facets are copied onto it. The snapshot row keeps the build-time flags as its audit record; the article gets the ones that apply to it. `weight` is re-derived in the same pass, because a `mustHave` facet's weight is floored at 1 (see below) — carrying the stored weight over would leave a facet with `weight: 1` next to a re-derived `mustHave: false`, a floor the consuming template never justified, and `consensusCoverage` reads `facet.weight` directly rather than recomputing it. `applyTemplateHints` and `facetWeights` share one implementation of the weighting rule so the formula cannot fork; `totalDocs` is the snapshot's `baselineDocCount`. `docCount` is left alone: it's a property of the corpus, not of the template. Reuse is the normal path; building is the exception, and it's what lets `pipeline:run` stay idempotent for the research stage: rerunning it against an article whose keyword already has a fresh snapshot costs one Payload query, not a new crawl.

**What the article stores.** The research stage writes `research.snapshot` (a relationship), plus its own copies of `research.queryCluster`, `research.facets`, and `research.gaps`. The duplication is on purpose: a snapshot can be superseded by a fresher capture, and a published article's scores must stay explainable against the baseline it was actually written and judged against. The relationship is declared `maxDepth: 0`, so it stays an id at any query depth — the pipeline's per-stage `find` runs at `depth: 1` with `pagination: false`, and populating it would drag every crawled page's text (up to 10 × 24,000 chars per article) through memory for stages that never read it. Load the snapshot explicitly when the baseline itself is needed.

**`snapshotHash`.** A SHA-256 fingerprint over the sorted `url|textHash` pairs of every successfully-fetched page (`snapshotHash` in `snapshot.ts`). Sorting means re-crawling the same pages in a different SERP order produces the same hash, so a rebuild can be recognised as "nothing actually changed" even though it re-paid for the crawl.

**`status` semantics.** `snapshotStatus(okPages, failedPages, claimCount)`: `complete` when every fetched page yielded text *and* extraction produced at least one baseline claim, `partial` when at least one page failed or was skipped but at least one succeeded and there are claims, `empty` otherwise. A `skipped` page (a PDF, a non-HTML content type) counts the same as a `failed` one for this purpose — either way there's no text to extract claims from. A build that reads its pages fine but ends up with **no claims** is `empty` too: a baseline of nothing is not a baseline, and letting it look usable would serve an empty corpus for the whole 14-day reuse window, so every draft on that keyword would score as wholly novel against nothing. The two kinds of `empty` stay distinguishable on the stored row — a claimless build has `baselineDocCount > 0` and counts only genuinely failed pages in `failedPageCount`, where a failed crawl has `baselineDocCount: 0` and every page in `failedPageCount` — and the thrown diagnostic (`emptySnapshotMessage`) names which path it took. An `empty` build is written and then **thrown**, not returned: the row stays as the audit record of the attempt, but the article that paid for the crawl keeps `topic_selected` instead of advancing to `researched` with no baseline, so `runPipeline` logs it as a failed article, exits non-zero, and retries it next run.

## Baseline claims and facets

Every successfully-fetched SERP page and every internal article in the corpus is sent to a `claimExtraction` LLM call that decomposes it into atomic `BaselineClaim`s: `{ id, text, type, excerpt, entities, values, source, facetId }` (`cms/src/lib/informationGain/types.ts`). `excerpt` is meant to be the verbatim sentence in the source page the claim is drawn from, but it is recorded, **not verified**: `parsePageClaims` (`cms/src/lib/informationGain/parsers.ts`) only drops entries with no excerpt at all, and nothing rejects a claim whose excerpt the page never actually says. What the pipeline does instead is count them — after parsing each document's claims it checks every excerpt with `excerptFoundIn` against the text it was extracted from, logs a line when any fail, and stores the total on the snapshot as `pages[].unverifiedExcerptCount` (SERP pages; the internal-corpus path logs the same count but does not store it, and a claim reused from the extraction cache is not re-checked because the article text is not fetched again). The claims are deliberately kept either way: dropping them shrinks the baseline, and a smaller baseline makes every draft scored against it look *more* novel, so over-dropping would cause false passes. That is still where it stands: an unverifiable excerpt is counted, not weighted down and not dropped. `type` is one of the eight `CLAIM_TYPES` (factual, first_party_measurement, inference, recommendation, opinion, definition, comparison, prediction); `source.kind` distinguishes a `serp` claim from an `internal` one and carries the originating URL or article id.

Once every page's claims are pooled, one `claimExtraction` call clusters them into `Facet`s — the subtopics the baseline corpus treats as part of the answer — and the `InformationGap`s those facets leave open. A facet's `weight` is `docCount / totalDocs` (`facetWeights` in `cms/src/lib/informationGain/coverage.ts`): the share of baseline documents that cover it, so a subtopic every competitor answers outweighs one only a single page mentions. The template's `requiredSections` headings are passed into the clustering prompt as must-have hints; a facet flagged `mustHave` has its weight floored at 1 regardless of `docCount`, because the template marked it required and a thin baseline mustn't be able to discount it away. A gap (`InformationGap`) is either an unaddressed facet or a free-standing angle the corpus leaves open, each with an `evidenceHint` describing what kind of source would settle it.

Claims and clustering results are pooled up to `FACET_CLAIM_CAP` (400) claims per snapshot — beyond that the clustering prompt costs more than it learns.

## Gap-fed generation

The research stage discovers what the baseline already covers and leaves open *before* generation, not only after scoring a draft. `gapsBlock` (`pipeline/src/generatePrompt.ts`) turns an article's `research.facets` and `research.gaps` into up to four prompt sections, inserted into `buildPrompt` right before the `# Output` instructions:

1. **`# Consensus facets (must cover)`** — every facet the baseline agrees on, each annotated either `(required by template)` or `(covered by N baseline sources)` — "sources", not "ranking pages", because `docCount` counts every baseline document, our own published articles included.
2. **`# Information gaps (opportunities)`** — facets or angles the baseline leaves unanswered, each with the kind of evidence that would settle it.
3. **`# Evidence rules`** — the `EVIDENCE_RULES` constant, verbatim, whenever either of the above sections is present.
4. **`# Revision notes (previous attempt)`** — a re-run's `article.revisionNotes`, when present, ending with "Fix these before anything else."

The evidence rules exist because "add more unique insights" without a boundary reads as an invitation to fabricate — Datum has no first-party data, so an instruction to be original has to be paired with a rule against synthetic novelty:

> Do not invent unique insights. Add a novel factual claim only when you can name the public source (organisation and document) a fact-checker could find; otherwise state it as an explicitly labelled inference (for example, 'In our reading of the guidance…'). Never present first-party measurements, tests, surveys, or datasets — Datum has none. Prefer covering every consensus facet over adding novelty. Every number, date, and percentage must be one you can attribute.

An article generated before this feature has no `facets`/`gaps` and so gets none of these sections — generation behaves exactly as it did before corpus snapshots existed. A *new* article can no longer reach generation that way: a build that yields zero claims throws in the research stage, so the article never leaves `topic_selected`.

## Scoring a draft

The `informationGain` stage (`pipeline/src/informationGain/`) runs after QA, on `qa_passed`, and is the only stage that can move an article to `verified`, `needs_review`, or `blocked`. It runs after QA rather than instead of it because judge and web-search calls are the expensive part of the pipeline, and a draft that failed its structural or style checks is not worth spending them on.

Three LLM passes and one pure gate:

1. **Draft claim extraction** — one `claimExtraction` call (`fixtureKey: 'draft'`) decomposes the draft into atomic claims, each assigned to one of the article's own facets or to none.
2. **Judging** — one `informationGainJudge` call per facet batch (`judgeBatches`, up to 12 claims), each carrying only that facet's slice of the baseline corpus (`selectBaselineContext`). The judge estimates how likely the baseline already states each claim, how much it answers the query cluster, and how useful it is. `novelty` is the duplicate probability inverted; `relevance` and `utility` collapse the per-query and per-rubric scores through the shared weightings in `scoring.ts`.
3. **Verification** — `pickForVerification` selects the materially novel claims whose *kind* outside evidence could settle, and one `evidenceVerification` call per batch of five hunts citations with web search on. Each cited URL is scored by `resolveSourceQuality` against the `evidence-sources` table, and the claim's own numbers are compared with the quoted excerpts by `compareValues` — deterministically, never by asking the model. A verifier that reports full support over evidence stating a different figure still fails the exactness check.
4. **The gate** — `scoreDocument` + `consensusCoverage` + `internalDuplicationRate` build a `Scorecard`, and `decidePolicy` (the only place a verdict is reached) turns it into `PASS` / `REVISE` / `HUMAN_REVIEW` / `BLOCK`, mapped to `verified` / `needs_revision` / `needs_review` / `blocked`.

### Claims nobody checked

A claim not selected for verification gets **neutral** evidence values — support, source quality, and exactness all 1, contradiction 0 — under the mode `baseline_corroborated` (a verifiable claim the baseline already makes) or `not_applicable` (an opinion or recommendation no citation settles). These are absences of evidence, not findings: evidence integrity multiplies into the document's verification ratio, and scoring unchecked claims at 0 would fail a BLOCK gate that exists to catch unsupported *novel* claims. Only a claim whose mode is `verified` can be blocked, so the neutrals cannot launder anything past the gates. A draft scored with no usable snapshot gets `skipped_no_baseline` on every claim and goes straight to `HUMAN_REVIEW` under `BASELINE_UNAVAILABLE`.

### Policy and evidence sources are run-scoped

`loadInformationGainPolicy` and `loadEvidenceSources` resolve once per run, like models: every article in one run must be judged by the same thresholds, and a mid-run admin edit must not produce a split batch. The resolved policy is hashed into a `policyVersion` stamped onto every stored result.

### What is written

One immutable `information-gain-runs` row per scoring — the full scorecard, every claim record, its evidence, the resolved policy and the models that judged it — plus a small denormalised summary on `Article.informationGain` pointing at it. A `needs_review` or `blocked` outcome also **clears `reviewJustification`**: the override gate demands a justification written for the article's current problem, and a stale one would let an earlier reviewer's reasoning approve a scorecard they never saw. (That gate is live — a `needs_review` article cannot be moved back by a plain status edit.)

`pipeline:report` gains an information-gain block: decision counts, mean consensus coverage and verification ratio, and a review queue listing each `needs_review`/`blocked` article's top reasons, read from its linked run rather than recomputed.

## The claim model and its signals

Everything the gate reads about one claim is a `ClaimRecord` (`cms/src/lib/informationGain/types.ts`): the claim's text and excerpt, the section it came from, the facet it belongs to, the evidence found for it, and a flat set of signals. **Every 0–1 signal in that record is an uncalibrated LLM estimate.** Each stored run carries `calibrated: false` and every claim record carries `calibrated: false`, and they will keep doing so until a calibration pass exists. The thresholds below are starting points chosen to be defensible, not measurements of anything.

`type` is one of the eight `CLAIM_TYPES` (factual, first_party_measurement, inference, recommendation, opinion, definition, comparison, prediction). The three in `VERIFIABLE_CLAIM_TYPES` — **factual, first_party_measurement, inference** — are the ones outside evidence can settle, and they are the only ones a BLOCK gate applies to. An opinion or a recommendation is never blocked for lack of a citation, because no citation would settle it.

The signals, and where each comes from:

| Signal | Range | Where it comes from |
| --- | --- | --- |
| `importance` | 0.5–2.0 | The judge, clamped to `IMPORTANCE_RANGE`. A multiplier, not a probability: 1 is neutral. |
| `novelty` | 0–1 | `1 − duplicateProbability` from the judge. A claim the baseline already makes adds nothing, however well it is written. |
| `relevance` | 0–1 | `Σ wq · rq` over the article's query cluster (`relevanceFromQueries`). A query the judge did not score contributes 0. |
| `utility` | 0–1 | The judge's rubric through `UTILITY_WEIGHTS`: specificity 0.30, actionability 0.25, explanatory power 0.25, audience fit 0.20. |
| `intraDocumentNovelty` | 0–1 | Pure, from the draft alone (`intraDocumentNovelty` in `batching.ts`): 1 for something the draft has not said yet, `RESTATEMENT_NOVELTY` (0.2) when the extraction pass flagged it as restating an earlier claim, and 0 when it is lexically a near-duplicate (Jaccard ≥ `NEAR_DUPLICATE_THRESHOLD`, 0.8) of an earlier one. The harsher penalty wins, and only claims *earlier* in document order count — the first statement keeps its value, the repeat is discounted. |
| `evidenceSupport` | 0–1 | The verifier's own judgement of how well its citations back the claim. |
| `sourceQuality` | 0–1 | Not the model's: `resolveSourceQuality` scores the *best* citation's domain (see below). |
| `exactness` | 0–1 | Not the model's either: `compareValues` compares the claim's numbers with the quoted excerpts (see below). |
| `contradictionProbability` | 0–1 | The verifier's estimate that the evidence contradicts the claim. |
| `containsNumericOrTemporalClaim` | boolean | The judge's flag; it selects the stricter evidence floor. |
| `verificationMode` | enum | `verified`, `baseline_corroborated`, `not_applicable`, or `skipped_no_baseline`. Only `verified` claims can be blocked. |

Two derived numbers do the actual work (`scoring.ts`):

```
potentialGain     = novelty × relevance × utility × intraDocumentNovelty
evidenceIntegrity = evidenceSupport × sourceQuality × exactness
verifiedGain      = blocked ? 0 : potentialGain × evidenceIntegrity
```

`potentialGain` is what the claim would be worth if it were true; `evidenceIntegrity` is how much of that we are entitled to keep. The document roll-up (`scoreDocument`) sums both weighted by `importance` into `potentialGainUnits` and `verifiedGainUnits`, and `verificationRatio` is the second over the first — the share of the draft's claimed value that evidence actually stands behind. `verifiedGainDensity` restates it per 1,000 draft tokens (`estimateTokens`: words × 1.3, floored at 1 — a comparison aid, not a tokenizer).

Three coverage numbers exist and they are **not** interchangeable:

- **`consensusCoverage`** (`coverage.ts`) — the weighted share of the article's consensus facets that any draft claim was assigned to *at all*. This is the one `COVERAGE_BELOW_MIN` gates on.
- **`facetGainCoverage`** (`scoreDocument`) — the weighted share of facets where some *single* claim delivered at least `FACET_GAIN_THRESHOLD` (0.1) verified gain. Nothing gates on it; it is a quality read. A draft can address every facet (coverage 1.00) while adding almost nothing to most of them, and a mock run does exactly that: coverage 100% beside facet gain coverage 40%.
- **`internalDuplicationRate`** — the share of draft claims whose `internalDuplicateProbability` is ≥ 0.8, i.e. already published on our own site. Gated by `maxInternalDuplicationRate`.

## Exactness: comparing numbers without asking a model

The numeric gate never asks the model whether two figures agree. `extractValues` (`exactness.ts`) pulls numbers, percentages, currency, years, dates, units, negation, direction and comparatives out of both the claim and each evidence excerpt with one left-to-right regex scan, and `compareValues` compares them literally. `exactness` is `matched / comparable`; a claim with nothing comparable scores 1, and it is the policy gate's job — not this function's — to decide whether an unfalsifiable claim may pass.

The rules that surprise people, all deliberate:

- **No unit conversion and no rounding.** `380 ms` and `0.38 s` are a mismatch. A model that silently rescales units can turn a wrong number into a passing one, so rescaling is not allowed to happen anywhere in the comparison.
- **No absolute value.** `-10%` and `10%` are different values, so evidence reading "growth was 10%" cannot support "growth was −10%".
- **Everything is judged per excerpt, never over the pooled excerpts.** Pooling let support be assembled out of two unrelated sentences — "80% recommend it" came out fully supported by "80% do *not* recommend it" (supplying the number) plus "Experts recommend it" (supplying the affirmative polarity). Now a value is matched only when a *single* excerpt carries the same kind, value and unit **and** is compatible with every qualifier the claim states.
- **Only excerpts that carry one of the claim's values ("anchors") may vouch for its polarity.** An excerpt that never mentions the figure can no longer certify the direction or the negation.
- **Negation is symmetric**: the check runs whenever the claim *or* any anchor is negated.
- **`more than` / `less than` are thresholds**: a bare `10%` does not support "more than 10%". `equal` is what a bare figure already asserts, so an excerpt with no comparative of its own supports it.
- A claim with values and no anchoring excerpt scores 0 — which is why an empty evidence list scores 0 for any claim carrying a number.
- Sign handling: `-`, `−` and `+` count as signs only at the start of a token, so `5-10 seconds` is two positive bounds and `top-10 list` is 10, not −10. `+10` parses as 10.
- Dates compare at month resolution: `2026-01-05` and `Jan 2026` are both 202601.

One contradicting excerpt therefore costs a claim twice, the value point and the qualifier point. That is intentional: the gate only asks whether exactness is `< 1`, and the score itself is an uncalibrated signal, not a calibrated probability.

## Source quality, and why classifying domains is real work

`resolveSourceQuality` (`sourceQuality.ts`) scores one cited URL two ways, and only two. Either the domain matches an **active row in the `evidence-sources` collection** — an explicit human decision — or it falls back to the judge's rubric guess, which is **capped at `UNKNOWN_DOMAIN_CAP` (0.75)**. Longest domain match wins, so a specific subdomain rule beats its parent. A URL that will not parse scores 0: an unusable citation is not evidence. `first_party_dataset` can never come from the rubric at all; only the table can certify a source as our own.

The class scores (`SOURCE_QUALITY_SCORE`, uncalibrated policy dials):

| Class | Score |
| --- | --- |
| `first_party_dataset` | 1.00 |
| `primary` | 0.95 |
| `official_docs` | 0.90 |
| `secondary` | 0.75 |
| `unverified` | 0.40 |
| `blocked` | 0.00 |

Now put that next to the integrity floors, because the consequence is the single most surprising behaviour in this feature:

> **A materially novel claim sourced only to unclassified domains is blocked.** Evidence integrity is `support × sourceQuality × exactness`. An unclassified domain caps `sourceQuality` at **0.75**, however confident the model is about it. A novel numeric or temporal claim needs **0.95** (`minNumericTemporalIntegrity`); any other novel factual or inference claim needs **0.90** (`minNovelFactualIntegrity`). 0.75 clears neither, at any support and any exactness.

This is not a bug and not a threshold that wants loosening. An unvetted source cannot underwrite a claim nobody else is making — that is the whole point of the gate. What it means in practice is that **populating `evidence-sources` is operator work, not optional setup**:

- A novel **numeric** claim can only be cleared by a domain classified `primary` (0.95) or `first_party_dataset` (1.00), at full support and exact value agreement. There is no slack: 0.95 × anything less than 1 is below the floor.
- A novel **non-numeric factual or inference** claim can additionally be cleared by `official_docs` (0.90), again only at full support and exactness.
- `secondary` (0.75) and `unverified` (0.40) rows exist to record a judgement, and to be *worse* than the cap where the model was being generous. They cannot clear a novel-claim floor.

So: before a real run, classify the domains your drafts actually cite. Add them under **Governance → Evidence sources** (`/admin/collections/evidence-sources`) with the class you are prepared to defend, and a `note` saying why. A row can be deactivated (`active: false`) rather than deleted, which returns the domain to the capped rubric path. `npm run seed` seeds three `primary` rows unconditionally (`sca.coffee`, `baristahustle.com`, `homegrounds.co`) purely so the mock walkthrough can reach `PASS` — they are the domains the mock verifier fixture cites, and they are not a starter list for a real tenant.

If you leave the table empty, the pipeline still runs and still produces a full scorecard. It will simply block every draft whose value rests on a novel number, and the run row will say exactly which claim and which floor.

## The policy gates

`decidePolicy` (`policy.ts`) is the only place a verdict is reached, and it is pure: same scorecard, same policy, same decision. Every rule that fires is reported as a `PolicyReason` with a code, a message, an optional `claimId`, and a severity. **The decision is the most severe severity present**, under the precedence `BLOCK > HUMAN_REVIEW > REVISE > PASS`. Reasons are deduplicated by `(policy, claimId)`, keeping the first.

The eleven thresholds (`POLICY_FIELDS` — the single source of truth from which the admin global, the env overrides, `DEFAULT_POLICY` and the admin copy are all derived):

| Threshold | Default | Breach → | What it means |
| --- | --- | --- | --- |
| `minConsensusCoverage` | 0.75 | REVISE | Weighted share of consensus facets the draft must address. |
| `minVerificationRatio` | 0.90 | BLOCK | Verified gain units ÷ potential gain units. Low means the draft's novelty rests on unsupported claims. |
| `minNovelFactualIntegrity` | 0.90 | BLOCK | Integrity floor for a materially novel factual or inference claim. |
| `minNumericTemporalIntegrity` | 0.95 | BLOCK | Integrity floor for a materially novel claim containing numbers, dates or units. |
| `requireExactValueMatch` | true | BLOCK | A materially novel claim's values must match the evidence exactly (`exactness == 1`). |
| `requireEvidenceLineage` | true | BLOCK | A materially novel verifiable claim must cite at least one excerpt. |
| `blockFirstPartyMeasurements` | true | BLOCK | Drafts are model-generated, so a claimed first-party test, survey or dataset is fabricated. |
| `maxContradictionProbability` | 0.25 | HUMAN_REVIEW | A claim contradicting reliable evidence at or above this needs a human — it may be legitimately new. |
| `materialNoveltyThreshold` | 0.55 | HUMAN_REVIEW | Novelty at or above this makes a claim "materially novel". A materially novel *inference* needs review. |
| `maxInternalDuplicationRate` | 0.35 | HUMAN_REVIEW | Share of draft claims already published on this site; at or above this, a consolidation review. |
| `minVerifiedNovelClaims` | 1 | REVISE | Minimum materially novel claims with verified evidence. |

And the eleven codes they produce (`POLICY_CODES`):

| Code | Severity | Scope | Fires when |
| --- | --- | --- | --- |
| `BASELINE_UNAVAILABLE` | HUMAN_REVIEW | document | No usable corpus snapshot. Short-circuits: no other rule is evaluated. |
| `COVERAGE_BELOW_MIN` | REVISE | document | `consensusCoverage < minConsensusCoverage`. |
| `VERIFICATION_RATIO_BELOW_MIN` | BLOCK | document | `verificationRatio < minVerificationRatio`, and only when `potentialGainUnits > 0`. |
| `NO_VERIFIED_NOVEL_CLAIM` | REVISE | document | Fewer verified novel claims than `minVerifiedNovelClaims`. |
| `INTERNAL_DUPLICATION_REQUIRES_REVIEW` | HUMAN_REVIEW | document | `internalDuplicationRate ≥ maxInternalDuplicationRate`. |
| `NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT` | BLOCK | claim | A verified, materially novel, non-numeric verifiable claim below its integrity floor. |
| `NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT` | BLOCK | claim | Same, for a claim carrying numbers/dates/units — below the numeric floor, or `exactness < 1` under `requireExactValueMatch`. |
| `EVIDENCE_LINEAGE_MISSING` | BLOCK | claim | A verified, materially novel verifiable claim with an empty evidence list. |
| `FIRST_PARTY_MEASUREMENT_PRESENT` | BLOCK | claim | The claim's type is `first_party_measurement`. |
| `CONTRADICTION_REQUIRES_REVIEW` | HUMAN_REVIEW | claim | `contradictionProbability ≥ maxContradictionProbability`. |
| `NOVEL_INFERENCE_REQUIRES_REVIEW` | HUMAN_REVIEW | claim | A materially novel claim of type `inference`. |

Two guards keep the BLOCK gates from firing on absences of evidence rather than findings. A claim is only blockable when its `verificationMode` is `verified` — the neutral modes (`baseline_corroborated`, `not_applicable`, `skipped_no_baseline`) score support, quality and exactness at 1 and cannot be blocked. And `VERIFICATION_RATIO_BELOW_MIN` is skipped when `potentialGainUnits` is 0, because a draft that claims no gain at all has not failed to substantiate anything.

Where the thresholds come from, in order: **the admin global wins, then the env override, then the platform default** (`resolvePolicy`). A value that is missing, of the wrong type, or out of range for its kind falls through to the next source rather than throwing, so a bad admin entry can never wedge the pipeline. The resolved provenance is logged per field at the start of every run (`admin` / `env` / `default`). The intended surface is the admin: **Governance → Information-gain policy** (`/admin/globals/information-gain-policy`). The `INFORMATION_GAIN_*` env vars exist for CI and for pinning a value where there is no admin to click; each global field is deliberately left with no Payload `defaultValue`, because one would be persisted on the first save and become indistinguishable from a real admin choice, silently killing the env override.

### `policyVersion`

The resolved policy is serialised canonically (`{ schema: 1, ...policy }`, keys sorted) and hashed into `ig-v1:<first 16 hex of sha256>` — for example `ig-v1:2a9ee80976c03c4b`, the version the default policy produces today. It is stamped onto every `information-gain-runs` row and onto the article's summary, so any stored scorecard can be traced back to the exact thresholds behind it. Move a threshold and the version changes; two runs with the same version were judged identically. Both the policy and the evidence-source rules are resolved **once per run**, like models are, so a mid-run admin edit cannot produce a batch where half the articles were held to different numbers.

## Statuses and reviewer actions

The scoring stage's decision maps onto the article status one way only:

| Decision | Status |
| --- | --- |
| `PASS` | `verified` |
| `REVISE` | `needs_revision` |
| `HUMAN_REVIEW` | `needs_review` |
| `BLOCK` | `blocked` |

**`verified` is reachable exactly two ways**, and both are enforced at the data layer by `beforeChange` hooks on `Articles` (`cms/src/lib/articleReviewGate.ts`), so REST and admin edits obey them as much as the ops UI does:

1. **A scoring run returned `PASS`.** `gateVerifiedStatus` refuses `status: 'verified'` unless the write carries (or the stored document already carries) `informationGain.decision === 'PASS'`. It reads the incoming value first because the stage writes the decision and the status in one update. A hand-written decision is not a way around it: the `informationGain` group is `access.update: () => false`, so no request without `overrideAccess` can persist one.
2. **A reviewer overrode `needs_review`/`blocked` with a fresh justification.** `gateReviewOverride` intercepts every transition *out of* those two statuses. Backward targets — `needs_revision`, `drafted`, `researched`, `topic_selected`, and the review statuses themselves — pass through untouched. Everything else (`qa_passed`, `verified`, `approved`, `published`) requires a `reviewJustification` that is **different from the one already stored**. The list is deliberately an allow-list of *backward* targets rather than of forward ones, so a new status defaults to gated rather than to an unnoticed detour out of review. On success the hook overwrites `reviewedBy` with the acting user and records a `review_overridden` / `block_overridden` audit event.

Freshness is the point. The admin UI submits the whole document, so a justification typed for an earlier review would otherwise ride along and satisfy the gate with nobody typing anything. For the same reason the scoring stage **clears `reviewJustification`** whenever it lands an article in `needs_review` or `blocked`: the next override must be written against the scorecard the reviewer is actually looking at.

The reviewer's actions live on the article detail view (`/admin/ops/articles/<id>`, `cms/src/components/ops/actions.ts`):

| Action | Effect |
| --- | --- |
| **Override** (`overrideReviewAction`) | `needs_review`/`blocked` → `verified` on the reviewer's judgement. Requires a non-empty, fresh justification; the gate's own `APIError` is allowed to propagate verbatim so the reviewer sees *why* it was refused. Audits with the id of the run being overridden. |
| **Regenerate** (`regenerateArticleAction`) | Sends the article back to `researched` to be rewritten against the reasons it failed on. Offered on `needs_revision` only — see below. |
| **Send back** (`sendBackAction`) | → `needs_revision` on editorial grounds, even from `qa_passed`. Nulls `informationGain`. |
| **Reset to drafted** (`resetToDraftedAction`) | → `drafted` so QA re-runs. Nulls `qaResults` and `informationGain`. |
| **Approve** / **Publish** | The ordinary editorial path, offered from `verified` onward. `qa_passed` deliberately does *not* offer Approve — that was a two-edit detour around scoring. |

Every action that sends an article back nulls the `informationGain` group, so the board never shows a scored verdict beside a draft nobody has re-scored. Clearing that group needs `overrideAccess: true` (the group refuses ordinary updates in either direction), which those three actions use — and only to reach one fixed all-null payload. The `beforeChange` gates are hooks, not access checks, so they still run and still guard `status` under `overrideAccess: true`.

## The regeneration loop

`needs_revision` used to be a dead end. It is not any more, but the loop is a deliberate, reviewer-initiated one rather than something `pipeline:run` does on its own — no stage has `needs_revision`, `needs_review` or `blocked` as its `entryStatus`, so a failing article sits still until a human decides what to do with it.

**Regenerate** takes an article back to `researched`. Note where it is offered: `ArticleReview.tsx` puts the Regenerate control on **`needs_revision` only**. From `needs_review` or `blocked` the reviewer's two choices are **Override** (straight to `verified`) or **Send back** (to `needs_revision`) — regenerating a blocked draft is therefore a two-step move, send back and then regenerate. The server action itself has no such restriction (`researched` is an ungated target from any status); the constraint is the UI's, and it is a reasonable one: it makes "I have decided this draft is not salvageable" an explicit step rather than a button next to Override. What Regenerate then does:

1. It reads the latest `information-gain-runs` row and turns its `reasons` into `revisionNotes`, one line per reason: `- [CODE] message`. With no run to read (a QA failure that never reached scoring) it falls back to the QA failure lines. A reviewer note, when given, is appended as `Reviewer note: …`. Run rows are immutable and are never deleted, so the two-step route above still finds the blocking run's reasons after **Send back** has nulled the article's `informationGain` summary.
2. `revisionCount` is incremented, and `qaResults` and `informationGain` are nulled.
3. Status becomes `researched`, which is the `generate` stage's `entryStatus`.

The next `pipeline:run` regenerates the draft with those notes rendered verbatim into the prompt as `# Revision notes (previous attempt)`, ending with "Fix these before anything else" (see Gap-fed generation above), then re-runs QA and scoring. The research stage is skipped, so the article keeps the corpus snapshot it was judged against and the new draft is scored against the same baseline — which is the only way the second scorecard is comparable to the first.

The other way out is a plain status edit back to `drafted` (or the **Reset to drafted** action), which re-enters QA without regenerating.

## Cost

Every LLM call in this feature goes through `completeJSONLogged`, so each one writes a `cost-log` row keyed by `pipelineRunId` and `article` (see `CLAUDE.md`'s Cost tracking section) and shows up in `pipeline:report`'s spend-by-stage automatically.

**Building a snapshot** costs roughly one `claimExtraction` call per fetched page (up to 10 SERP pages, plus up to 5 internal articles not already covered by another snapshot's cache) plus one more for facet clustering — around 10–16 calls, most of them short. **Reusing** an existing snapshot costs $0: no crawl, no LLM call, just a Payload query.

**Scoring one draft** costs three kinds of call:

| Pass | Calls | Notes |
| --- | --- | --- |
| `claimExtraction` (`fixtureKey: 'draft'`) | 1 | Decomposes the whole draft. |
| `informationGainJudge` | one per facet batch | `judgeBatches`: claims grouped by facet, then chunked at `DEFAULT_JUDGE_BATCH_SIZE` (12). Each call carries only that facet's slice of the baseline (`DEFAULT_SERP_CONTEXT_CAP` 50 + `DEFAULT_INTERNAL_CONTEXT_CAP` 20; `DEFAULT_OTHER_CONTEXT_CAP` 40 for the unassigned `other` bucket). |
| `evidenceVerification` | one per batch of `DEFAULT_VERIFIER_BATCH_SIZE` (5) | Only for claims `pickForVerification` selected: materially novel *and* of a verifiable kind. Web search is on, so these are the most expensive calls per token. |

A representative mock run (`pipeline/scripts/ig-e2e.sh`, one How-To draft, snapshot reused, all six models left at the `claude-opus-5` default) produced **13 claims → 1 extraction + 5 judge calls + 1 verifier call**, and a run row `costUsd` of **$0.368** at catalogue prices. The same article's first run, which also *built* the snapshot, recorded **$0.612** on its run row.

That difference is worth understanding rather than averaging away. The run row's `costUsd` sums this article's cost-log rows for this `pipelineRunId` whose stage is one of `claimExtraction`, `informationGainJudge`, `evidenceVerification` — and the research stage's snapshot-build extractions are `claimExtraction` rows under the same run id. So when a snapshot is built in the same `pipeline:run` that scores the draft, the build's extraction cost lands on the scoring run's row too. Read `costUsd` as "what this pipeline run spent on claim-level work for this article", not as "what the scoring stage alone cost". The article's `totalCostUsd` is re-summed across its whole cost log afterwards and has no such caveat.

Verifier calls are **not** deduplicated across a run: two articles on the same keyword share one corpus snapshot but each pays for its own verification of whatever novel claims it makes. That is correct when the claims differ and wasteful when they do not; the snapshot-reuse machinery is the obvious model to copy if verification ever becomes the dominant line item.

The Models global (`llm-settings`) has a dropdown for each of the three passes, alongside the other stages. `claude-sonnet-5` is the recommended default for `claimExtraction`: extraction and clustering are structured, moderate-length JSON tasks, not long-form writing, so Sonnet's lower per-token price (see `cms/src/lib/llmCatalog.ts`) is the better trade.

## Mock mode

With `MOCK_MODE=true`, `fetchPage` returns canned per-host text instead of making a network request (`pipeline/src/corpus/mockPages.ts`), keyed by the fetched URL's hostname. All of the mock SERP hosts, plus a generic fallback, describe the same topic — setting up a home espresso station — matching the `generate` stage's fixture article (`pipeline/src/fixtures.ts`), so a full mock pipeline run reads as topically coherent end to end. Each canned page contains the sentences the `claimExtraction` fixtures quote as `excerpt`, so `excerptFoundIn` matching succeeds against every mock host.

**`fixtureKey` routing.** Most stages have one fixture; `claimExtraction` has three call shapes, so `mockFixture(stage, fixtureKey)` selects a sub-fixture from that stage's entry:

| `fixtureKey` | Used by | Returns |
| --- | --- | --- |
| `page` | one call per SERP page and per internal article, in the research stage | a fixed set of baseline claims |
| `facets` | the single clustering call per snapshot | a fixed set of facets and gaps |
| `draft` | the information-gain stage's draft decomposition | a fixed set of draft claims |

A `fixtureKey` naming a sub-fixture that does not exist throws `no mock fixture for <stage>/<key>` rather than silently returning the whole entry — a `claimExtraction` request that lost its key would otherwise get an object of three fixtures where a claim list was expected. The key also survives the per-call live/mock decision inside `llm.ts`, so a stage that falls back to mock mid-run still routes correctly. `informationGainJudge` and `evidenceVerification` have one fixture each and take no key.

Because every mock page returns the identical claim set, mock-mode facet `docCount`s don't vary by page the way a real, differently-worded competitive set would — mock runs exercise the data flow, not the weighting behaviour of a genuinely mixed corpus. Note too that the mock fixtures are espresso-themed while the mock Ahrefs keywords (e.g. "best crm for small business") are not: cosmetically inconsistent, functionally irrelevant, since nothing about claim extraction or clustering depends on the keyword matching the fixture's topic.

A mock run reaching `PASS` depends on the seeded `evidence-sources` rules, for exactly the reason the source-quality section gives: the three domains the verifier fixture cites are seeded unconditionally at `primary` by `cms/src/seed.ts`. With an empty table every materially novel number in the demo draft is blocked — the intended posture, not a bug.

## Running the whole thing

`pipeline/scripts/ig-e2e.sh` is the documented walkthrough and the fastest way to see the feature work: it seeds, fetches topics, assigns a template, runs all four stages, asserts on the article's status, its `information-gain-runs` row and its cost rows, re-runs the pipeline to prove a settled article does not move, and prints the report. It exits non-zero on any failed assertion, makes no network calls, and spends nothing. It refuses to start under `MOCK_MODE=false`.

It is repeatable against a database that has already been walked through. `pipeline:fetch` skips a keyword that already has an article and the mock Ahrefs client offers only four content-gap keywords, so the script owns one dedicated keyword that it resets to `topic_selected` on each run, and treats `fetch` creating zero articles as the expected outcome on a used database. Run rows are immutable and are never deleted, so a second walkthrough leaves the first one's run row in place and asserts on the newest.

## What is deferred

Named here so nothing below reads as an oversight:

- **Calibration.** Every 0–1 signal is an uncalibrated model estimate and every stored run says so (`calibrated: false`). The thresholds in `POLICY_FIELDS` are defensible starting points, not measurements. Until a labelled set exists, "novelty 0.6" means "this model said 0.6", not "60% of such claims are novel".
- **SERP percentiles.** There is no comparison of a draft's scores against the distribution of the pages actually ranking for its keyword. Coverage and gain are absolute numbers against one snapshot, so "good" is a threshold someone chose rather than a position in a field.
- **Embeddings.** Duplicate detection is the judge's estimate plus a lexical Jaccard near-duplicate check (`NEAR_DUPLICATE_THRESHOLD` 0.8) inside one draft. Nothing is embedded, so a claim reworded past the lexical threshold relies entirely on the judge noticing.
- **First-party lineage.** `first_party_dataset` is a class the `evidence-sources` table can assign and `blockFirstPartyMeasurements` blocks every claimed first-party measurement outright, because a model-generated draft cannot have run a test. There is no mechanism for a tenant that *does* have first-party data to register a dataset and let a claim cite it. Until there is, the honest answer is the block.
- **Excerpt verification for baseline claims.** A baseline claim's `excerpt` is counted, not enforced: unverifiable excerpts are recorded on the snapshot as `pages[].unverifiedExcerptCount` and kept, because dropping them shrinks the baseline and a smaller baseline makes every draft look *more* novel.
- **Cross-article verifier caching**, per the Cost section above.
- **`robots.txt`, per-host throttling and 429 backoff** in the crawler, per the Fetch limits section above.
