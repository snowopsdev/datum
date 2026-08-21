# Operator UI — design plan (throwaway prototypes)

**Status:** Phases 0–3 locked / Phase 4 layout fork open · throwaway  
**Prototype:** `scratch/ui-prototypes/operator-board-vs-inbox/index.html`  
**Open:** `npx --yes serve scratch/ui-prototypes/operator-board-vs-inbox`

## Constraints (locked)

| Choice | Decision |
| --- | --- |
| Surfaces | A–D (workflow, reports, public, templates) |
| Users | Solo / small team |
| Device | Desktop primary |
| Day-one jobs | Assign + triage |
| Approve → publish → public | Yes |
| Fidelity | Clickable HTML, monochrome |
| Metaphor | **Board** |
| Columns | All 7 statuses |
| Detail | Full review page |
| Status writes | **Actions only** |
| Payload home | **Extra Ops route** |
| Templates editor | **Tabbed** (Outline · Rules · SEO · Examples) |
| Templates audience | **Config work** (rare) |
| Public chrome | **Minimal** (logo + article), monochrome |
| Reports focus | **Failure digest → review/board** |

## Phased plan

### Phase 0–1 ✅ Operator board

Board + full review + Extra Ops route + actions-only.

### Phase 2 ✅ Reports (ops loop)

Metrics + spend retained; **failure digest first** with Open review / Show on board.

### Phase 3 ✅ Templates (config)

Left list of templates; tabbed editor. Required H2s + seoSpec called out as QA-enforced.

### Phase 4 🔄 Public reader

Minimal chrome. **Fork open:** A long-scroll vs B sticky TOC — switcher on Public nav (`1`/`2`).

## Phase 0–3 summary

| Decision | Choice |
| --- | --- |
| Metaphor | Board |
| Columns | All 7 |
| Detail | Full review page |
| Status writes | Actions only |
| Payload home | Extra Ops route |
| Templates | Tabbed config editor |
| Reports | Failure digest → triage loop |
| Public chrome | Minimal mono |

**Open:** Public layout A vs B.
