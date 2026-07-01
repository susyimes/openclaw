# OpenClaw Runtime Variant

This branch is a runtime-focused OpenClaw variant based on upstream `v2026.6.11`.
It keeps the Gateway, CLI, Control UI, core agent/session/runtime surfaces, browser/Codex/memory-oriented plugins, and a small provider/tool catalog.

This checkout intentionally does not bundle the upstream mobile/desktop app tree, broad external channel zoo, release platform matrix, or showcase/media assets.

## What This Variant Keeps

- Gateway runtime, daemon/service commands, sessions, cron, tools, policies, and configuration.
- CLI and Control UI development surfaces.
- Core agent, model/provider, browser automation, memory, diagnostics, search, diffs, and runtime helper plugins.
- Provider/plugin catalog entries that match this runtime direction, including Codex, DeepSeek, Kimi, Qwen, OpenAI/local providers, browser/search tooling, diagnostics, diffs, memory-lancedb, OpenShell, parallel, Tavily, SearXNG, Exa, Firecrawl, TokenJuice, and related retained plugins.

## What Is Removed Or Not Default

- `apps/android`, `apps/ios`, `apps/macos`, `apps/macos-mlx-tts`, and `apps/swabble`.
- Upstream external channel defaults such as Discord, Telegram, Slack, WhatsApp, Matrix, Feishu, Teams, iMessage, LINE, Signal, Zalo, and similar channel packages.
- Upstream mobile/macOS release machinery, broad GitHub Actions platform matrix, fastlane/mobile build docs, and showcase image assets.
- The official external channel catalog is empty in this variant. Add channels back explicitly only when they become part of the new runtime direction.

## Local Development

Use the source checkout directly. Do not install or link this variant globally while validating it if you want to keep the machine's installed OpenClaw untouched.

```bash
pnpm install
pnpm build
node scripts/run-vitest.mjs
```

For the user-requested full test entrypoint:

```bash
npm test
```

`npm test` runs the repository-local `scripts/test-projects.mjs`; it does not install a global OpenClaw binary.

## Runtime Notes

- Prefer local, repo-scoped commands during development: `node scripts/...`, `pnpm ...`, and `npm test`.
- Avoid `npm install -g`, `pnpm link`, or service installation commands from this checkout unless you explicitly intend to replace or register a local runtime.
- Keep local secrets, config files, caches, generated state, and machine-specific runtime outputs out of git with `.gitignore`.

## Validation Focus

The important checks for this variant are:

```bash
node scripts/run-tsgo.mjs -p tsconfig.core.json
node scripts/run-tsgo.mjs -p tsconfig.extensions.json
node scripts/run-vitest.mjs
npm test
```

Run narrower targets first when editing routing or catalogs, then run `npm test` before publishing the variant branch.
