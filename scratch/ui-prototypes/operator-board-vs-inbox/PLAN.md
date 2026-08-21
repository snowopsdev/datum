# Operator UI — design plan (throwaway prototypes)

**Status:** Phases 0–4 shape locked · **Payload Feature build complete for plan surfaces** · `DESIGN.md`  
**Prototype (throwaway):** `scratch/ui-prototypes/operator-board-vs-inbox/index.html`  
**Design system:** `/DESIGN.md`

## Shipped in CMS (Feature)

| Route | Purpose |
| --- | --- |
| `/admin/ops/articles` | Article board (Extra Ops) |
| `/admin/ops/articles/:id` | Full review (assign / triage / approve / publish) |
| `/admin/ops/reports` | Failure digest + cost-log spend by stage/model |
| `/admin/ops/templates` | Tabbed template config (Outline · Rules · SEO · Examples) |
| `/articles/[slug]` | Public long-scroll reader for `published` |
| Nav | Ops → Article board, Reports, Templates |

Stock Articles / Templates collection editors remain. Status writes are actions-only.

## Constraints (locked)

| Choice | Decision |
| --- | --- |
| Surfaces | A–D |
| Users | Solo / small team |
| Device | Desktop primary |
| Metaphor | **Board** |
| Columns | All 7 statuses |
| Detail | Full review page |
| Status writes | **Actions only** |
| Payload home | **Extra Ops route** |
| Templates | **Tabbed** config editor |
| Reports | Failure digest → review/board |
| Public chrome | Minimal (logo + article) |
| Public layout | **Long scroll** (TOC archive) |
| Visual language | **Notion `DESIGN.md`** (warm paper canvas, Inter, primary blue CTAs) |

## Visual system (from DESIGN.md)

- Canvas: warm paper `#f6f5f4`; cards white with hairline `#e6e6e6`
- Type: Inter, tight tracking on headings
- Structural accent only: Notion blue `#0075de` for primary CTAs / active / links
- Sticker accents only for status dots (orange triage, green pass) — not CTAs
- Primary buttons: pill; utility buttons: 8px radius
- Elevation: hairline + soft layered shadow

## Phase summary ✅

| Phase | Outcome |
| --- | --- |
| 0 | Board metaphor |
| 1 | Review page + Extra Ops + actions-only |
| 2 | Reports failure digest loop |
| 3 | Tabbed template config |
| 4 | Minimal public long-scroll reader |

**Next:** Feature build in Payload using this shape + `DESIGN.md`.
