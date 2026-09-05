# Expansion matrix

The campaign used the skill's maximum of three campaign-wide expansion passes. Each finite list was selected before execution and covered all three required scenario classes. Browser and pipeline work ran in parallel and are grouped here by campaign pass.

| Pass | Scenario | Class | Result |
| --- | --- | --- | --- |
| 1 | Mobile template flow with manual-keyword whitespace guard | Boundary and recovery | Passed; no new root |
| 1 | Unknown public article slug | Boundary and recovery | Passed with expected 404; no new root |
| 1 | Content-tab browser Back/Forward history | Cross-feature and historical risk | Passed; no new root |
| 1 | Warning plus failed article persistence | Boundary and recovery | Passed; no new root |
| 1 | Mixed-success batch accounting | Cross-feature pairwise | Passed; no new root |
| 1 | Failure, retry, and third-run history preservation | Concurrency and historical risk | Passed; no new root |
| 2 | 320 px setup editors | Boundary and recovery | Passed; no new root |
| 2 | 300-character search followed by clear recovery | Boundary and recovery | Passed; no new root |
| 2 | Written article and generation audit after reload | Cross-feature and historical risk | Passed; no new root |
| 2 | Mock monthly report | Cross-feature pairwise | Passed; no new root |
| 2 | Invalid report-period boundary | Boundary and recovery | Passed; no new root |
| 2 | Mock-to-live configuration switch preserving report content | Concurrency and historical risk | Passed; no new root |
| 3 | Queued admin run followed by a selected run | Cross-feature and concurrency | Passed; no new root |
| 3 | Duplicate run ID without a duplicate run or orphan job | Boundary, idempotency, and historical risk | Passed; no new root |
| 3 | Injected enqueue failure, rollback, and same-ID retry | Boundary and recovery | Passed; no new root |

All 15 scenarios passed without a new root cause. The discovery target remained unmet and the report retains gaps for live providers, additional browser platforms, assistive technology, sustained generation load, and browser concurrency. Because the third allowed pass was used while gaps remained, the campaign records an expansion-budget stop and does not claim exhaustion.

Source evidence: `browser-lanes.md` and `pipeline-lanes.md` in this directory.
