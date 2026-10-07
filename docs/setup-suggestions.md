# Setup suggestions

Datum learns deterministic setup suggestions from retained editorial history.
Phase A makes no model calls. The setup checklist shows open suggestions, their
article counts, and up to three linked excerpts; it also shows readiness
recommendations. The admin landing returns to setup when suggestions need a
decision. “Scan now” runs the same collector as the daily scheduled job.

| Signal | Threshold | What accepting does |
|---|---|---|
| Removed phrase | Removed from at least three published articles, kept in none where it appeared | Adds one banned word or phrase to the active brand voice |
| Recurring not trait | The same trait violated in three distinct articles | Opens the voice's boundary step with excerpts; the operator writes the sharper boundary |
| Unbacked first-party claim | Similar excerpts in two distinct articles | Adds an incomplete verified claim, or a rejected claim with the operator's reason |
| Rejected ref attempted | The same ref attempted in three distinct articles and no replacement saved | Opens rejected claims with excerpts; the operator writes a replacement |

Removed phrases are one to three words, never cross sentence boundaries, and
exclude stopwords, keyword tokens, numbers, and platform or brand bans. The
comparison uses the newest generated audit output against the published title,
body and metadata. QA signals use every retained QA pass, but count each article
once. Unbacked excerpts merge at token-set Jaccard similarity of at least 0.6;
different numbers never merge. Public claims do not create evidence suggestions.

Accepting evidence as verified sets `verificationDepth: self_reported` and leaves
the source and re-check date empty. It is **incomplete** and reaches no writing
prompt until a person supplies the missing proof. Rejected rows get an immutable
R ref through the normal evidence hook. Accepting a boundary or replacement
suggestion does not write text: it remains open until an editor saves a change
that satisfies it.

Every accepted or dismissed decision records the authenticated admin, date,
reason when supplied, and a governance-audit entry. Existing users are admin
identities; Datum does not have a separate editor-role system. REST callers can
read suggestions when signed in but cannot create, update or delete them.
Dismissed and accepted suggestions never reopen. Open suggestions become obsolete
when the setup already satisfies them.

Suggestions upsert by stable signatures, retain the full distinct-article count,
and show at most ten occurrences. The private `setup-suggestion-scan` global
keeps the latest audit timestamp and id. Unchanged history skips signal scanning,
while still checking obsolescence. New history triggers a complete historical
aggregation: this preserves signals below the threshold between scans without
copying the audit history into another store. Audit records remain append-only.

Reviewer-note clustering (phase B), performance feedback, and automatic boundary
writing are outside phase A.
