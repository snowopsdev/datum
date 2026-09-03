# Tenant context

The workspace's own facts: who it publishes for, who it writes against, and who
each piece is aimed at. Everything here is admin data, not deployment
configuration, and it reaches every prompt the pipeline sends.

## The assets

| Asset | Where it lives | What it decides |
|---|---|---|
| Workspace profile | `workspace-profile` global | The site the content-gap report compares against, the competitor list, the company name in prompts, and how the crawler identifies itself |
| Audiences (ICPs) | `icps` collection | Who a piece is written for: the brief's audience line, the `# Audience` block in the writing and review prompts |
| Brand voice | `brand-voices` collection | How every generated field sounds |
| Positioning | `positioning` global | What the company is to that audience: the `# Positioning` block in the writing and review prompts |
| Evidence bank | `evidence-bank` global | The only first-party facts a draft may state, and the QA check that enforces it |

The shared, dependency-free helpers live in `cms/src/lib/tenant/`; both
workspaces import them, and `pipeline/src/tenant.ts` re-exports the barrel.

## Precedence

The workspace profile resolves per field: the admin global first, then the
environment variable, then — in mock mode only — a demo default, so a fresh
clone runs with no setup at all.

```
workspace-profile global  →  TARGET_DOMAIN / COMPETITOR_DOMAINS  →  mock default  →  null
```

Positioning has no fallback of any kind. It is one global, because a workspace
holds exactly one position at a time.

Audiences have no environment fallback. An article points at one through
`article.icp`; `selectIcp` resolves that relationship against the active
audiences, falling back to the primary, then to the first, then to null. An
audience that has since been archived is not honoured, because writing for an
archived reader is worse than writing for the primary one.

`loadTenantContext(payload, { mode })` assembles all of it once at the start of
a run and hands it to every stage on `StageContext.tenant`. Loading it once is
deliberate: an audience activated halfway through a batch must not change what
the second article was written against.

## Gating

A content run needs three things, and refuses to start without any of them:

- an active brand voice
- a target domain, from the global or the environment
- at least one active audience

`evaluateWorkspaceReadiness` owns that rule. `governance.ready` is the answer
and `governance.problems` is the list of what is missing, in the words an
operator acts on — every caller interpolates that list rather than writing its
own copy, so the setup screen, the content-run action, and the brief all say
the same thing. `cms/src/jobs/contentRun.ts` re-checks the same three before it
spends anything, for a job that was queued before an audience was archived.

An existing workspace is blocked by this until it has all three. "Start with
the demo workspace" on `/admin` fills them in from the fixtures in
`cms/src/lib/tenant/fixtures.ts` in one click, and `npm run seed --
--with-brand-voice` writes the same records.

That button is **create-only**, and pressing it twice is safe. It fills a
workspace-profile field only where it is still blank, writes the position only
when nothing has been saved, writes the evidence bank only when it is empty, and
creates an audience or a brand voice only when nothing carries the fixture's
name — it never updates, re-activates, or moves `primary` on a record that is
already there. The audiences and the voice it does create claim `active` (and
`primary`) only when nothing is active, because the single-active and
single-primary cascades would otherwise retire the operator's own.

## The site crawl

"Fetch site pages" reads the workspace's own home page plus up to seven
marketing paths linked from it (`cms/src/lib/tenant/sitePages.ts`), and stores
them on the profile for the setup assistant to draft from.

Redirects are checked against the target domain by `isSameSite`, which counts
the domain itself, either scheme, and the `www.` variant either way as one site,
and a sub-domain as a different one. If the **home page** lands somewhere else —
a parked domain, a stale DNS record, a domain sold since somebody typed it in —
the action fails and stores nothing, because these pages become the material an
audience, a position, and an evidence bank are drafted from, and half a
stranger's site is worse than no site. A **sub-page** that redirects off-site is
dropped with a warning; one marketing path pointing at a partner is ordinary.

Editing an audience moves `configFingerprint`, so it stales a verification run
the way editing the brand voice does.

## How prompts use them

The generate system prompt is assembled in this order, and any block with
nothing in it is omitted rather than sent as a bare heading:

```
style guide  →  # Workspace  →  # Brand voice (tenant)  →  # Audience  →  # Positioning
```

The generate **user** prompt carries the second half, after the brief:

```
… → facets/gaps → # Evidence rules → # Evidence bank → revision notes → # Output
```

The qualitative reviewer receives the style guide, the brand voice, and the
same `# Audience` and `# Positioning` blocks the writer was given — without
them the reviewer judges register against a reader it has to invent and cannot
tell a drifting draft from a correct one. The fact checker gets neither: it
judges claims against the world, not against a reader or a position.

Every statement in an audience carries a confidence, and the confidence decides
the grammar the writer may use for it. The scale is one shared enum in
`cms/src/lib/tenant/confidence.ts`, and the block always carries the legend:

| Level | The writer may |
|---|---|
| Verified, Strong directional | state it plainly |
| Qualitative pattern, Cultural signal | state it as a tendency, not a fact |
| Inference, Hypothesis | attribute it to us, never as fact |

## Positioning

The `positioning` global holds the Master Positioning framework: the category,
the one goal, the customer promise, the mental slot to own, the statement, the
macro frame and landscape, three core claims, the pillars, the enemy, the
archetype and essence, the descriptor ladder, the reach-for and avoid
vocabularies, and the questions the company has not settled.

It is **recommended, never required**. Readiness reports it under
`tenant.positioning.status` as one of:

| Status | Meaning | What the prompt gets |
|---|---|---|
| `missing` | nothing saved | no block at all |
| `partial` | saved, still incomplete | the sections that are filled |
| `ready` | category, goal, promise, position, statement, exactly three core claims, one pillar | the whole block |

`partial` and `ready` are injected identically — the renderer omits empty
sections either way — so an operator gets value from the first field they save.
The difference is only what the setup screen says. Outstanding work appears in
`tenant.recommendations` (`Add positioning`, or `Finish positioning: …`), which
is kept apart from `governance.problems` so nothing can turn a recommendation
into a blocker by rendering the two lists together. Saving or editing the
global moves `configFingerprint`, so it stales a verification run the way an
edited audience does.

Two rules the block enforces on the writer's behalf:

- **The avoid vocabulary is advisory.** The qualitative reviewer is asked to
  note it under `notes` and never to fail an article on it. Words that must
  never appear belong in the brand voice's banned list, which structural QA
  checks deterministically.
- **Only open rulings are sent.** A question the workspace has ruled on is
  settled, and the block's instruction — take no position on these — would be
  wrong for it. The ruling belongs in whichever field it settled.

The global's `notes` field is an input for the setup assistant and is not part
of `PositioningContent` at all, so an operator's scratch text cannot reach a
draft.

Blocks are deterministic — no ids, no timestamps beyond the operator's own
dates — so two runs of an unchanged workspace produce identical cost-log
request snapshots. `pipeline/test/tenantPrompts.test.ts` pins them as golden
strings.

## Evidence bank

The `evidence-bank` global holds three lists: **verified claims** (each with its
source, method, limits, cleared surfaces, and a re-check date), plain **facts**
that need no hedging, and **rejected claims** that may never be stated. It is
the only place a first-party fact may come from — anything about the company,
its product, customers, pricing, results, or measurements.

Three rules make it work, and they are stated in the field descriptions as well
as here:

- **Proof travels with the claim.** A row with no source and no limits is an
  assertion, and the writer cannot tell the difference — so an unfinished row is
  not sent to the writer at all.
- **A softened version of an unsupported claim is still unsupported.** Hedging
  removes the evidence, not the claim.
- **Rejected claims stay visible.** A row nobody can see is a claim that comes
  back in the next draft.

### What makes a claim usable

A verified claim is **usable** when it is complete, cleared for the surface, and
unexpired. Complete means all of: claim text, a named primary source, the date
the source was produced, a `verificationDepth` stronger than `self_reported`,
and a `recheckAt`. `verifiedClaimProblems()` returns what is still missing, in
the words the operator needs; `isClaimComplete()` is the same test as a boolean.

`self_reported` is a recordable depth, not a sufficient one. It is what the
setup assistant stamps on every row it proposes, and those rows must not walk
into a draft on their own.

An unfinished row never reaches the generate prompt, is `unusable` in the QA
check with the reason `incomplete evidence`, is counted as `incomplete` in the
summary, and is tagged **Unverified — not sent to the writer** in the editor.

### Refs

Every row carries a stable, human-readable ref — `E1` for a verified claim, `F2`
for a fact, `R3` for a rejected one — assigned by a `beforeValidate` hook from a
hidden `refCounter`. Refs are monotonic and **never reused**, including after a
row is deleted: a published article's `evidenceCitations` may still point at
`E4`, and re-pointing that citation at a different claim would rewrite history
silently. One counter serves all three prefixes.

Refs are also **immutable**. A row the saved document already knows by its
array-row id keeps the ref it was given, whatever a write calls it, so an
import, a script, or a hand-made API call cannot rename `E3` to `E5`. A row the
document has never seen may declare its own ref — that is how the demo fixture
and any whole-array script write puts a bank in place — but only when it is
well-formed, carries its list's letter, and nothing else has claimed it;
otherwise it is minted. Moving a saved row into another list is refused with a
400, because `[F4]` in a published article cannot be allowed to start naming a
claim.

A citation is matched case-insensitively: `[e3]` and `[E3]` are one entry, and
the ref is normalised to upper case before it is stored or checked.

The writer is told to put the ref in square brackets at the end of any sentence
stating a first-party fact. `generateStage` finds those markers in every
generated string field — title, slug, meta and OG fields, FAQ questions and
answers, and the body — records `{ref, excerpt}` on `article.evidenceCitations`
where the excerpt is the sentence that carried the marker, and then strips every
marker before anything is stored. No reader ever sees one.

### Expiry

Nothing moves between the lists on its own. A verified claim whose `recheckAt`
is before the run's `asOf` is **expired at render time**: it drops out of the
usable list and appears under "Never state these" with the date that killed it.
The operator either bumps the date or files the row as rejected. Readiness
reports `Re-check N expired claims` as a recommendation.

`clearedSurfaces` restricts a claim to named surfaces (`web`, `blog`, `ads`,
`sales`, `social`, `pr`). An empty list means cleared everywhere — the opposite
reading would make an unfilled field silently ban the claim. Articles are
generated for `web`.

### The QA evidence check

A new QA call, `evidenceCheck`, runs after the fact check on every article, bank
or no bank. It is deliberately separate from `factCheck`: that call searches the
open web and judges public claims, this one compares sentences against a list
and needs no search, which makes it a cheaper model and lets half the verdict be
deterministic.

- **Deterministic half** (`checkEvidenceRefs`, no model): every ref the draft
  declared must exist and still be usable as of `asOf` **on the article's
  surface** (`web`). A ref naming a real row that is not cleared for the surface
  is `unusable` with the reason `not cleared for web`, and one naming an
  unfinished row is `unusable` with `incomplete evidence` — reporting either as
  a hallucination would send a reviewer looking for something that is not there.
- **Model half**: judges every first-party sentence against the uncapped bank.

| Outcome | Meaning | Effect |
|---|---|---|
| `backed` | restates an entry within its limits | recorded |
| `unbacked` | no entry supports it | **flagged**, article still passes |
| `overreach` | goes past an entry's stated limits or changes a number | **fails** |
| `rejected` | states or paraphrases a "never state" row | **fails** |
| `unusable` | cited a ref that does not exist, has expired, is unfinished, or is not cleared for this surface | **fails** |

`unbacked` only flags because plenty of true sentences are not in the bank yet,
and failing them would make the bank a precondition for writing rather than a
guarantee about what is written.

The evidence check reads the same meta block the qualitative review does — title
tag, meta description, OG title, OG description — before the body. A title tag
is the shortest place in the article and the likeliest place for an unbacked
superlative to survive a careful body.

The verdict is stored on `qaResults.evidenceCheck` (`passed`, `notes`, `claims`)
with the model on `qaModels.evidenceCheck`, and `allPassed` includes it, so a
failing check sends the article to `needs_revision`. The failing excerpts are
appended to the stored notes as `Remove or replace: …` lines; `qaFailures` picks
those up, so the reviewer's regenerate action feeds them to the next draft
verbatim through `# Revision notes`. The article review page shows them under an
**Evidence** card next to the fact check, along with the entries the draft cited.

### Prompt size

The generate prompt carries at most `MAX_PROMPT_CLAIMS` (40) usable claims,
newest `recheckAt` first, plus every fact and every never-use row. The cap is a
prompt-size limit only: the evidence check sends the whole bank, so a claim past
the cap is still enforced — the writer simply was not offered it. A usable claim
always carries a re-check date, so the undated branch of the sort only keeps the
ordering total.

### Information gain

A draft claim whose text overlaps one of the article's `evidenceCitations`
excerpts is marked verified by the bank (`evidence-bank:<ref>`, source class
`first_party_dataset`) and never sent to the web verifier. A private company's
own measurement cannot be found on the open web, and without this its absence
counted against the draft.

### Readiness

`tenant.evidenceBank` reports `{ status, verified, usable, expired, incomplete,
facts, rejected }`. `status` is `ready` when there is at least one **usable**
claim or one fact, `missing` otherwise — a bank of unfinished rows is not ready,
because the writer is offered none of them. It **never gates a run** — an empty
bank simply means the writer may state nothing about the workspace. `Add an
evidence bank`, `Re-check N expired claims`, and `Complete N unverified claims`
appear in `tenant.recommendations`. Saving the
global moves `configFingerprint`, so it stales a verification run.

## AI assist

Every setup step has "Draft with AI" and "Refine". Both call one server action,
`assistAction` in `cms/src/components/ops/setupActions.ts`, which drafts or
revises **one section of one asset** — never a whole record, so the operator can
read a reply before accepting it.

### What it reads

The notes typed on that step, plus everything the workspace already holds:
the workspace profile, the active brand voice, the other active audiences, the
position, and the evidence bank. All of it is rendered with the same functions
the pipeline uses (`workspaceProfileToPrompt`, `brandVoiceToPrompt`,
`icpToPrompt`, `positioningToPrompt`, `evidenceBankToPrompt`), so the assistant
and the writer read one description of the workspace. On top of that it gets the
pages fetched by "Fetch site pages", each capped at `ASSIST_PAGE_TEXT_CAP`
(3 000 characters) for the call.

The audience being edited is **excluded** from that context. It is the thing
being written, and feeding a record its own current text is how a refine turns
into a paraphrase.

### What it never does

- **It never saves.** The editor merges the returned value into form state and
  the operator decides what survives, so the governance audit still records a
  person's save rather than a model's suggestion.
- **It never asserts.** Every confidence is capped at `inference`
  (`capAssistConfidence`): a model reading a company's own copy has neither
  interviews nor data, and only a person may raise a statement to `verified` or
  `strong directional`. The system prompt is not even shown the two higher
  levels.
- **It never cites.** Evidence rows come back with no `ref` (the global's hook
  assigns those on save), `verificationDepth: 'self_reported'`, an empty
  `recheckAt` — which makes every proposed row **incomplete**, so it is visibly
  unverified in the editor and reaches no draft until a person finishes it — and
  a `sourceUrl` only when that exact URL appears in the notes or
  on one of the fetched pages. A core claim's `evidenceRef` is dropped for the
  same reason: the assistant cannot see the bank's ids, so any ref it proposes is
  a citation nobody checked.
- **It never invents.** Where the material is silent the field comes back empty,
  and a reply is always run through the asset's own `parseXContent`, so an
  assisted value cannot be shaped differently from a typed one.

### Sections

`ASSIST_SECTIONS` in `cms/src/lib/tenant/assist.ts` is the whole surface, and the
system prompt's schema paragraph, the keys picked out of the reply, and the mock
fixtures are all derived from it.

| Asset | Sections |
|---|---|
| `workspace` | `profile` |
| `icp` | `who`, `pains`, `motivation`, `solution`, `competition`, `whyUs`, `channels`, `boundaries`, `all` |
| `positioning` | `core`, `frame`, `coreClaims`, `pillars`, `identity`, `language`, `openRulings`, `all` |
| `evidence` | `facts`, `verifiedClaims` |

### Model, mock mode, and cost

The model resolves through `resolveSetupAssistModel`: the Models global's
"Setup assistant" field, then `SETUP_ASSIST_MODEL`, then the brand-voice
extraction model, then the platform default. In mock mode the demo workspace's
own section comes back instead, put through the same parser, with the warning
`Mock mode: returned the demo section instead of calling the model`.

Every call writes one `cost-log` row, stage `setupAssist`, run id
`setup-assist:<uuid>`, with `request: { asset, section, mode, notesChars,
pagesChars }`. A mock call writes one too, at zero, so a workspace can see how
often the button is pressed before it is ever billed for it. A call whose reply
could not be parsed still writes its billed row before returning the error.
