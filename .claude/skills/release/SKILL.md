---
name: release
description: Cut a Datum release by checking and merging the open release-please PR. Use when the user asks to cut, ship, or publish a release, or asks what's pending for the next release.
---

# Cutting a release

Releases are automated by release-please (see RELEASING.md). Your job is only to inspect and merge the release PR it maintains — never create tags, GitHub releases, or version bumps yourself.

1. Find the open PR titled `chore(main): release X.Y.Z` (author: github-actions / release-please). If none exists, there are no releasable commits (`feat`/`fix`) on `main` since the last release — report that and stop.
2. Report to the user: the proposed version, and the changelog entries from the PR body.
3. Verify the PR is mergeable and its required checks (`ci`, `pr-title`) are green. If checks never started (release PR opened with the default `GITHUB_TOKEN`), tell the user — the fix is the `RELEASE_PLEASE_TOKEN` secret described in RELEASING.md.
4. Merge only with the user's explicit go-ahead in this conversation (squash merge, keeping the PR title). Merging IS the release: release-please then tags `vX.Y.Z` and publishes the GitHub Release automatically — don't do either by hand and don't edit CHANGELOG.md.
5. Afterwards, confirm the tag and GitHub Release exist and report the release URL.
