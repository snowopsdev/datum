#!/usr/bin/env bash
#
# The information-gain walkthrough, end to end, in mock mode.
#
# Seeds the templates and the evidence-source rules, creates a topic, assigns a
# template, runs all four stages, and asserts on what the scoring stage left
# behind: the article's status, its information-gain summary, the immutable run
# row, and the cost-log rows for the three information-gain LLM passes. Then it
# runs the pipeline a second time and asserts that nothing moved — the stages
# are convergent, so a re-run over a settled article must be a no-op.
#
# It is repeatable against a database that has already been walked through.
# `pipeline:fetch` skips a keyword that already has an article and the mock
# Ahrefs client only offers four content-gap keywords, so a second walkthrough
# would otherwise have nothing to create. The script therefore owns one
# dedicated keyword (E2E_KEYWORD) that it resets to `topic_selected` on every
# run, and treats `fetch` creating zero articles as the expected outcome on a
# used database rather than a failure.
#
# Requires: a Postgres reachable at DATABASE_URL, and MOCK_MODE unset or true.
# Makes no network calls and spends nothing.
#
# Usage: pipeline/scripts/ig-e2e.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

E2E_KEYWORD='information gain e2e walkthrough'
E2E_TEMPLATE='How-To'
FETCH_COUNT=4

failures=0
step=0

log()  { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }

# Every assertion goes through here so one failure does not stop the walkthrough:
# a run that fails three checks should say so once, not three times over three
# invocations. The exit code at the bottom is what makes the script usable in CI.
assert_eq() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf '   \033[32mPASS\033[0m %s = %s\n' "$label" "$actual"
  else
    printf '   \033[31mFAIL\033[0m %s = %s (expected %s)\n' "$label" "$actual" "$expected"
    failures=$((failures + 1))
  fi
}

assert_ne() {
  local label="$1" actual="$2" forbidden="$3"
  if [ "$actual" != "$forbidden" ]; then
    printf '   \033[32mPASS\033[0m %s = %s\n' "$label" "$actual"
  else
    printf '   \033[31mFAIL\033[0m %s = %s (must not be %s)\n' "$label" "$actual" "$forbidden"
    failures=$((failures + 1))
  fi
}

assert_ge() {
  local label="$1" actual="$2" minimum="$3"
  if [ "$actual" -ge "$minimum" ] 2>/dev/null; then
    printf '   \033[32mPASS\033[0m %s = %s (>= %s)\n' "$label" "$actual" "$minimum"
  else
    printf '   \033[31mFAIL\033[0m %s = %s (expected >= %s)\n' "$label" "$actual" "$minimum"
    failures=$((failures + 1))
  fi
}

# One `key=value` line out of a probe dump, or the empty string when absent.
value_of() { printf '%s\n' "$1" | sed -n "s/^$2=//p" | head -1; }

probe() { npx --workspace pipeline tsx scripts/ig-e2e-probe.ts "$@"; }

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Guard: mock mode"
# Paid APIs are the one thing this script must never reach: it makes ~20 LLM
# calls, and MOCK_MODE=false would bill every one of them. Unset is fine — the
# pipeline's own default mocks whenever there is no ANTHROPIC_API_KEY.
MOCK_MODE_VALUE="${MOCK_MODE:-$(sed -n 's/^MOCK_MODE=//p' .env 2>/dev/null | head -1)}"
if [ "${MOCK_MODE_VALUE:-true}" = "false" ]; then
  printf '   \033[31mABORT\033[0m MOCK_MODE=false — this walkthrough would call paid APIs.\n'
  exit 1
fi
info "MOCK_MODE=${MOCK_MODE_VALUE:-unset (mocks by default)}"

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Seed templates, admin user, and evidence sources"
# The evidence-source rules matter as much as the templates here: integrity is
# support x sourceQuality x exactness and an unclassified domain is capped at
# 0.75, so without the seeded `primary` rows every novel number in the demo
# draft is blocked and the walkthrough ends at `blocked` rather than `verified`.
npm run seed

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Fetch content-gap topics"
# Expected to create 0 on a database that already holds the four mock keywords.
npm run pipeline:fetch -- --template "$E2E_TEMPLATE" --count "$FETCH_COUNT"

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Reset the walkthrough's own topic"
RESET_OUT="$(probe reset "$E2E_KEYWORD")"
printf '%s\n' "$RESET_OUT" | sed 's/^/   /'
ARTICLE_ID="$(value_of "$RESET_OUT" articleId)"
if [ -z "$ARTICLE_ID" ]; then
  printf '   \033[31mABORT\033[0m probe did not return an articleId\n'
  exit 1
fi

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Assign a template (the manual editorial step)"
npx --workspace pipeline tsx scripts/assign-template.ts "$ARTICLE_ID" "$E2E_TEMPLATE"

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Run the pipeline: research -> generate -> qa -> informationGain"
npm run pipeline:run

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Assert the scoring stage's output"
STATE_OUT="$(probe state "$ARTICLE_ID")"
printf '%s\n' "$STATE_OUT" | sed 's/^/   /'

assert_eq 'status'                     "$(value_of "$STATE_OUT" status)" 'verified'
assert_eq 'informationGain.decision'   "$(value_of "$STATE_OUT" decision)" 'PASS'
# At least one, not exactly one: run rows are immutable and never deleted, so a
# second walkthrough over the same database finds its predecessors still there.
assert_ge 'information-gain-runs rows' "$(value_of "$STATE_OUT" runRows)" 1
assert_eq 'run decision'               "$(value_of "$STATE_OUT" latestRunDecision)" 'PASS'
assert_eq 'run baselineAvailable'      "$(value_of "$STATE_OUT" latestRunBaselineAvailable)" 'true'
# Every stored signal is an uncalibrated model estimate; nothing may claim otherwise.
assert_eq 'run calibrated'             "$(value_of "$STATE_OUT" latestRunCalibrated)" 'false'
# The summary on the article must point at the run row it was denormalised from.
assert_eq 'summary run link'           "$(value_of "$STATE_OUT" summaryRunId)" "$(value_of "$STATE_OUT" latestRunId)"
assert_ne 'policyVersion'              "$(value_of "$STATE_OUT" policyVersion)" 'none'
assert_ne 'corpus snapshot'            "$(value_of "$STATE_OUT" snapshotId)" 'none'
assert_ge 'claims stored on the run'   "$(value_of "$STATE_OUT" latestRunClaims)" 1
# All three information-gain LLM passes must have logged their spend.
assert_ge 'cost rows: claimExtraction'      "$(value_of "$STATE_OUT" costRows.claimExtraction)" 1
assert_ge 'cost rows: informationGainJudge' "$(value_of "$STATE_OUT" costRows.informationGainJudge)" 1
assert_ge 'cost rows: evidenceVerification' "$(value_of "$STATE_OUT" costRows.evidenceVerification)" 1

RUN_ID_AFTER_FIRST="$(value_of "$STATE_OUT" latestRunId)"
RUN_ROWS_AFTER_FIRST="$(value_of "$STATE_OUT" runRows)"

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Run again — a settled article must not move"
# No stage has `verified` as its entryStatus, so the second run finds nothing to
# do for this article: same status, same run row, no new scoring cost.
npm run pipeline:run

SECOND_OUT="$(probe state "$ARTICLE_ID")"
assert_eq 'status after re-run'   "$(value_of "$SECOND_OUT" status)" 'verified'
assert_eq 'run rows after re-run' "$(value_of "$SECOND_OUT" runRows)" "$RUN_ROWS_AFTER_FIRST"
assert_eq 'run id after re-run'   "$(value_of "$SECOND_OUT" latestRunId)" "$RUN_ID_AFTER_FIRST"
assert_eq 'total cost after re-run' \
  "$(value_of "$SECOND_OUT" totalCostUsd)" "$(value_of "$STATE_OUT" totalCostUsd)"

# ---------------------------------------------------------------------------
step=$((step + 1)); log "$step. Report"
REPORT_OUT="$(npm run pipeline:report -- --period week)"
printf '%s\n' "$REPORT_OUT"
if printf '%s\n' "$REPORT_OUT" | grep -q '== Information gain'; then
  printf '   \033[32mPASS\033[0m report contains the information-gain block\n'
else
  printf '   \033[31mFAIL\033[0m report is missing the information-gain block\n'
  failures=$((failures + 1))
fi

# ---------------------------------------------------------------------------
printf '\n'
if [ "$failures" -eq 0 ]; then
  printf '\033[32mig-e2e: all assertions passed\033[0m (article %s)\n' "$ARTICLE_ID"
  exit 0
fi
printf '\033[31mig-e2e: %s assertion(s) failed\033[0m (article %s)\n' "$failures" "$ARTICLE_ID"
exit 1
