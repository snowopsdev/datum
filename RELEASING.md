# Releasing

Datum uses [release-please](https://github.com/googleapis/release-please) to automate versioning. Nobody — human or agent — hand-writes version numbers, tags, changelogs, or GitHub releases.

## How it works

1. Every PR is **squash-merged** with a [Conventional Commits](https://www.conventionalcommits.org/) title (enforced by the `pr-title` check). The title becomes the commit message on `main`.
2. On every push to `main`, the `Release Please` workflow (`.github/workflows/release-please.yml`) opens or updates a **release PR** titled `chore(main): release X.Y.Z`. It accumulates pending changes into `CHANGELOG.md` and bumps the `version` field in the root `package.json`:
   - `fix:` → patch (`0.1.0` → `0.1.1`)
   - `feat:` → minor (`0.1.0` → `0.2.0`)
   - `feat!:` / a `BREAKING CHANGE:` footer → major (`0.1.0` → `1.0.0`)
   - `docs:`, `chore:`, `ci:`, etc. → no bump (still listed in the changelog where configured)
3. **Cutting a release = merging that release PR.** On merge, the workflow creates the `vX.Y.Z` git tag and the GitHub Release with the changelog notes. That's the entire release procedure.

The single source of truth for the current version is the root `package.json` `version` field, mirrored in `.release-please-manifest.json`. The `cms` and `pipeline` workspace versions are not used and stay untouched.

There is no release schedule — merge the release PR whenever `main` holds something worth shipping.

## Hand-edit policy

Never manually:

- edit `CHANGELOG.md`, the root `package.json` `version`, or `.release-please-manifest.json`
- create or push `v*` git tags
- create GitHub releases in the UI

If a release needs correcting, fix it through release-please (e.g. a `release-as` override in `release-please-config.json`), not by hand.

## First release (one-time bootstrap)

`release-please-config.json` currently pins `"release-as": "0.1.0"` so the first release PR proposes exactly **v0.1.0** with a changelog covering the repo's full history. **After merging the v0.1.0 release PR, remove the `release-as` line** from `release-please-config.json` (a `chore(release): drop release-as bootstrap pin` PR) — if it stays, every subsequent release is forced to 0.1.0.

## One-time repository settings

Configure these in GitHub settings (they can't be committed as code):

1. **Pull Requests** → allow **only squash merging**, and set "Default commit message" to **Pull request title**. This is what makes PR titles the commits release-please reads.
2. **Actions → General** → check **"Allow GitHub Actions to create and approve pull requests"** (required for the workflow to open release PRs).
3. **Branch ruleset on `main`**: require pull requests, require the `ci` and `pr-title` status checks, block force pushes.
4. Optional but recommended — **`RELEASE_PLEASE_TOKEN` secret**: PRs opened with the default `GITHUB_TOKEN` don't trigger other workflows, so CI never runs on release PRs and required checks block them. Create a fine-grained PAT (this repo only; Contents + Pull requests: read/write) and add it as an Actions secret named `RELEASE_PLEASE_TOKEN`; the workflow picks it up automatically. Without it, you'd need to close/reopen each release PR to kick CI.

After the repo goes public, also enable (Settings → Advanced Security / Security): secret scanning + push protection, Dependabot alerts, and private vulnerability reporting (SECURITY.md points reporters at the advisories page).
