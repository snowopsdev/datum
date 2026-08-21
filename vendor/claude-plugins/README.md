# Vendored Claude Code plugins

This directory is a local plugin marketplace for Claude Code. It exists so plugins load automatically in every session in this repo — including cloud sessions, where user-level plugin installs don't persist. `.claude/settings.json` registers it under the name `datum-local` and enables the plugins below.

## pstack

Agent workflow skills by Lauren Tan (MIT, see `pstack/LICENSE`).

Vendored from [cursor/plugins](https://github.com/cursor/plugins) at commit `46125561306434d8a1d7745d540d8932ab0cd2a2`.

Local modifications from upstream:

- The `.cursor-plugin/plugin.json` manifest is converted to Claude Code's `.claude-plugin/plugin.json` format (same fields, different directory).
- `skills/poteto-mode/SKILL.md`: frontmatter `name` normalized from `Poteto Mode` to `poteto-mode` to satisfy Claude Code's skill-name constraints (lowercase-hyphen, matching the directory).
- `agents/comment-sicko.md`: frontmatter `name` normalized from `Comment Sicko` to `comment-sicko` (same lowercase-hyphen constraint for custom agents), and the `subagent_type` reference in `skills/no-comments/SKILL.md` updated to match.

Known limitations in Claude Code (the plugin was written for Cursor):

- `setup-pstack` writes its model-override rule to `~/.cursor/rules/pstack-models.mdc`, which Claude Code never reads, and detects models via Cursor's `Task`/`AskQuestion` interfaces — running it in Claude Code has no effect; the other skills just use their inline defaults.
- `poteto-mode`'s helper scripts (`scripts/watch-pr/watch-pr`, `scripts/orch/orch.ts`) require the [Bun](https://bun.sh) runtime (`#!/usr/bin/env bun`), which this repo's npm/Node toolchain does not provide. The skills degrade to manual workflows without them.

To update: re-copy `pstack/` from a newer upstream commit, keep the `.claude-plugin/` directory in place of `.cursor-plugin/`, bump the version in `.claude-plugin/plugin.json` to match upstream, and record the new commit hash here. Validate with `claude plugin validate vendor/claude-plugins`.
