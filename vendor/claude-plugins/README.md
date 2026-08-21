# Vendored Claude Code plugins

This directory is a local plugin marketplace for Claude Code. It exists so plugins load automatically in every session in this repo — including cloud sessions, where user-level plugin installs don't persist. `.claude/settings.json` registers it under the name `datum-local` and enables the plugins below.

## pstack

Agent workflow skills by Lauren Tan (MIT, see `pstack/LICENSE`).

Vendored from [cursor/plugins](https://github.com/cursor/plugins) at commit `46125561306434d8a1d7745d540d8932ab0cd2a2`, with the upstream `.cursor-plugin/plugin.json` manifest converted to Claude Code's `.claude-plugin/plugin.json` format (same fields, different directory). Everything else is unmodified upstream content.

To update: re-copy `pstack/` from a newer upstream commit, keep the `.claude-plugin/` directory in place of `.cursor-plugin/`, bump the version in `.claude-plugin/plugin.json` to match upstream, and record the new commit hash here. Validate with `claude plugin validate vendor/claude-plugins`.
