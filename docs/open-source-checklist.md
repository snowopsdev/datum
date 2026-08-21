# Opening this repository publicly — checklist for maintainers
#
# Complete these in the GitHub UI after merging open-source readiness changes:
#
# 1. Settings → General → Danger Zone → Change visibility → Public
# 2. Settings → General → Features → enable Issues (and Discussions if desired)
# 3. Settings → Code security → enable Dependabot alerts / private vulnerability reporting
# 4. Settings → Branches → protect `main`: require PR + require CI status check `ci`
# 5. Confirm SECURITY.md and advisories link work for the public repo
# 6. Optional: run a secret scan (gitleaks / trufflehog) on git history before going public
#
# Code-side readiness (LICENSE, README, CONTRIBUTING, CI, etc.) is handled in-repo.
