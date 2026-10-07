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

Removed wording comes from a word-level alignment of each generated text against
its published version: a word is removed only where the alignment skips it, so
"rich crema" cut from one sentence counts even when "rich" and "crema" both
survive elsewhere, and a kept neighbour never joins a removed phrase. Phrases are
one to three words inside one removed run, never cross a sentence boundary, and
exclude stopwords, keyword words and numbers. A banned phrase splits a run rather
than hiding every phrase that shares one of its words. The fragments are then
collapsed back into the wording that was removed: overlapping fragments removed
from the same articles chain into one phrase, but only when the chained phrase
sits inside one removed run in every one of those articles, so "red blue" and
"blue green" cut from different sentences never become "red blue green". A
fragment inside a longer suggestion that covers all of its articles is dropped.
Deleting "looks like warm honey" from three articles is one suggestion, not one
each for "looks", "like", "warm" and "honey"; a fragment removed from more
articles than its longer phrase is a separate habit and stays its own
suggestion. Texts too long to align fall back to comparing phrase sets. The
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
when the setup already satisfies them, or when a full scan no longer produces
their signal — the articles were regenerated or unpublished, or another piece
kept the wording — so a stale count never lingers on the checklist.

Suggestions upsert by stable signatures, retain the full distinct-article count,
and show at most ten occurrences. The private `setup-suggestion-scan` global
keeps the latest audit timestamp and id. Unchanged history skips signal scanning,
while still checking obsolescence. New history triggers a complete historical
aggregation over the `generate_completed` and `qa_completed` rows only: this
preserves signals below the threshold between scans without copying the audit
history into another store. Audit records remain append-only.

Reviewer-note clustering (phase B), performance feedback, and automatic boundary
writing are outside phase A.
