---
summary: "Runtime-focused OpenClaw variant documentation."
read_when:
  - Introducing this OpenClaw runtime variant
title: "OpenClaw Runtime Variant"
---

# OpenClaw Runtime Variant

This branch is a runtime-focused OpenClaw variant. It keeps the Gateway, CLI,
Control UI, retained plugins, provider integrations, and local validation
surface while removing the upstream mobile/desktop apps, broad external channel
catalog, public CI matrix, release packaging, and showcase assets.

<Columns>
  <Card title="Getting Started" href="/start/getting-started" icon="rocket">
    Bring up the retained Gateway/runtime surfaces from a source checkout.
  </Card>
  <Card title="Gateway" href="/gateway" icon="server">
    Runtime control plane, sessions, auth, services, and status.
  </Card>
  <Card title="Validation" href="/ci" icon="check-circle">
    Local checks that replace the removed upstream CI matrix in this branch.
  </Card>
</Columns>

## Scope

The variant keeps:

- Gateway runtime and CLI.
- Control UI and Web surfaces.
- Agent/session/memory/runtime infrastructure.
- Retained browser, Codex, diagnostics, diffs, memory, search, provider, and runtime helper plugins.

The variant does not bundle:

- Android, iOS, macOS, macOS MLX TTS, or Swabble app sources.
- Upstream external channel defaults.
- Public GitHub Actions/mobile/release CI.
- Showcase image assets.

## Development Loop

Use repository-local commands so this checkout does not replace a machine-level
OpenClaw install:

```bash
npm test
node scripts/run-vitest.mjs
node scripts/run-tsgo.mjs -p tsconfig.core.json
node scripts/run-tsgo.mjs -p tsconfig.extensions.json
pnpm build
```

## Start Here

<Columns>
  <Card title="Configuration" href="/gateway/configuration" icon="settings">
    Core runtime configuration and provider setup.
  </Card>
  <Card title="Security" href="/gateway/security" icon="shield">
    Trusted-operator model, sandboxing, and exposure boundaries.
  </Card>
  <Card title="Plugins" href="/plugins" icon="plug">
    Retained plugin surfaces and plugin development references.
  </Card>
</Columns>
