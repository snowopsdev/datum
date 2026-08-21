# Operator UI — design plan (throwaway prototypes)

**Status:** Phase 0–1 shape dialing · Board deeper + Reports stub · not production  
**Prototype:** `scratch/ui-prototypes/operator-board-vs-inbox/index.html`  
**Open:** `npx --yes serve scratch/ui-prototypes/operator-board-vs-inbox`

## Constraints (locked)

| Choice | Decision |
| --- | --- |
| Surfaces in scope | A–D (workflow, reports, public site, templates) |
| Users | Solo / small team |
| Host | Payload-adjacent admin |
| Device | Desktop primary |
| Day-one jobs | Assign template + triage `needs_revision` |
| Approve → publish → public | Yes |
| Fidelity | Clickable HTML, monochrome |
| Primary metaphor | **Board** |
| Columns | **All 7 statuses** |
| Detail UX | **Full review page** (board = return), not drawer |
| Payload embed | **Undecided** — prototype both (replace Articles list vs extra route) |
| Next artifacts | Deeper Board + Phase 2 Reports stub |

## Phased plan

### Phase 0 — Metaphor ✅

**Board.** Inbox archive retained in switcher only.

### Phase 1 — Operator workflow (in progress)

Board with:

1. Assign template on `topic_selected`
2. Full-page triage for `needs_revision` → reset to `drafted`
3. Approve / approve+publish from `qa_passed`
4. Drag cards across status columns (prototype; real status writes TBD)
5. Keyboard: arrows move focus, Enter opens review, Esc returns to board
6. Embed fork switcher until we pick Payload wiring

### Phase 2 — Reports (stub in prototype)

Dashboard shaped like `pipeline:report`: period, status mix, QA pass rates, spend by stage/model, failure digest, cost per published / waste.

### Phase 3 — Templates (surface D)

Editorial authoring — nav stub only for now.

### Phase 4 — Public site (surface C)

Reader pages for `published` — nav stub only for now.

## Open decisions

- Embed path: replace default Articles collection list **vs** extra admin route
- Whether drag-to-status is allowed in production or statuses stay pipeline-owned except explicit actions
