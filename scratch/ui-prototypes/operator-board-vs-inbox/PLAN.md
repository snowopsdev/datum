# Operator UI — design plan (throwaway prototypes)

**Status:** dialing shape · not production  
**Prototype:** `scratch/ui-prototypes/operator-board-vs-inbox/index.html`  
**Open:** `npx --yes serve scratch/ui-prototypes/operator-board-vs-inbox` → open the URL

## Constraints (locked)

| Choice | Decision |
| --- | --- |
| Surfaces in scope | A–D (workflow, reports, public site, templates) |
| Users | Solo / small team |
| Host | Payload-adjacent admin |
| Device | Desktop primary |
| Day-one jobs | Assign template + triage `needs_revision` |
| Approve → publish → public | Yes, in product scope |
| Fidelity now | Clickable HTML, monochrome |
| First fork | **Board vs Inbox** |

## Phased plan

### Phase 0 — Metaphor (this prototype)

Settle primary Articles IA: **Board** vs **Inbox** for assign + triage + approve.

- Same sample data and actions in both variants.
- Switcher / keys `1` · `2`.
- Nav stubs for Templates / Reports / Public prove IA without designing those yet.

**Decision criteria:** which layout makes “what do I do next?” obvious in under 3 seconds; which makes QA triage readable without leaving the flow.

### Phase 1 — Operator workflow (surface A)

Ship the winning metaphor inside Payload (custom admin view or adjacent route):

1. Assign template on `topic_selected` (replaces script-only path).
2. Triage `needs_revision` with structural / fact / qualitative surfaced; one-click reset → `drafted`.
3. Approve / approve+publish from `qa_passed`.

### Phase 2 — Reports (surface B)

Dashboard parity with `pipeline:report` (pass rates, spend, failure digest). Secondary nav from Phase 0 stub.

### Phase 3 — Templates (surface D)

Editorial authoring for outline, dos/don’ts, required H2s, SEO spec — still Payload-hosted.

### Phase 4 — Public site (surface C)

Reader pages for `published` (body, FAQ, SEO/OG). Depends on approve/publish from Phase 1.

## Prototype notes

- Throwaway. No production framework; state is in-memory.
- Assign mock-advances to `researched` for demo clarity (real system: assign template only; CLI advances stages).
- Monochrome on purpose — density and flow first; brand later.
