# Operator UI — design plan (throwaway prototypes)

**Status:** Phase 0–1 shape **locked** · ready for Feature build · throwaway prototypes  
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
| Payload embed | **Extra Ops route** — Articles stays the table; separate **Article board** nav |
| Status changes | **Actions only** — no free drag/manual status moves; assign / reset / approve (etc.) only |
| Fidelity | Clickable HTML, monochrome |

## Phased plan

### Phase 0 — Metaphor ✅

**Board.** Inbox archive retained in switcher only.

### Phase 1 — Operator workflow (in progress)

Board with:

1. Assign template on `topic_selected`
2. Full-page triage for `needs_revision` → reset to `drafted`
3. Approve / approve+publish from `qa_passed`
4. Status moves only via explicit actions (not drag / not raw status select)
5. Keyboard: arrows move focus, Enter opens review, Esc returns to board
6. Board ships as an **extra Ops route**; stock Articles CRUD remains

### Phase 2 — Reports (stub in prototype)

Dashboard shaped like `pipeline:report`: period, status mix, QA pass rates, spend by stage/model, failure digest, cost per published / waste.

### Phase 3 — Templates (surface D)

Editorial authoring — nav stub only for now.

### Phase 4 — Public site (surface C)

Reader pages for `published` — nav stub only for now.

## Embed (locked)

**Extra Ops route.** Articles collection keeps the default table. A separate admin nav item (e.g. **Article board** under Ops) opens the board. Prototype still lets you preview the rejected “Replace Articles” option for comparison.

## Locked: actions only

Cards do **not** change status by dragging. Pipeline owns `researched` / `drafted` / QA transitions; humans only:

- Assign template (`topic_selected`)
- Reset to `drafted` (triage)
- Approve / publish (`qa_passed` → …)
- Send back (editor judgment)

## Phase 0–1 shape summary ✅

| Decision | Choice |
| --- | --- |
| Metaphor | Board |
| Columns | All 7 statuses |
| Detail | Full review page |
| Status writes | Actions only |
| Payload home | Extra Ops route |

**Next:** Feature build of Article board + review in Payload, or continue prototyping Templates / Public stubs.
