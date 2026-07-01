---
summary: "Runtime variant source setup and local validation"
read_when:
  - Setting up a runtime-variant source checkout
  - You want to validate source changes without touching an installed OpenClaw
title: "Setup"
---

<Note>
This branch is a runtime-focused source variant. It does not bundle the upstream
macOS, iOS, Android, Swabble, public release, or showcase asset surfaces.
</Note>

## TL;DR

- Keep personal state outside the repo: `~/.openclaw/openclaw.json`,
  `~/.openclaw/workspace/`, and credentials stay in the local OpenClaw home.
- Work from this checkout with repo-local commands: `pnpm install`,
  `pnpm build`, `node scripts/run-vitest.mjs`, and `npm test`.
- Avoid global install, global link, service install, or release commands while
  validating this variant so an already installed OpenClaw stays untouched.

## Prereqs

- Node 24 recommended. Node 22 LTS (`22.19+`) remains supported.
- `pnpm` is required for source checkouts because bundled plugins are workspace
  packages under `extensions/*`.
- Docker is optional and only relevant if you explicitly reintroduce container
  workflows for your own private validation.

## Local Source Setup

Install dependencies from the checkout:

```bash
pnpm install
```

Build the repo:

```bash
pnpm build
```

Run the repo-local validation suite:

```bash
npm test
```

For a narrower Vitest pass while iterating:

```bash
node scripts/run-vitest.mjs
```

## Runtime State Boundary

Source changes should not live in the same place as personal runtime state:

- Config: `~/.openclaw/openclaw.json`
- Workspace: `~/.openclaw/workspace`
- Credentials: `~/.openclaw/credentials`
- Model auth profiles:
  `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Sessions: `~/.openclaw/agents/<agentId>/sessions`
- Logs: `/tmp/openclaw/`

If you need to inspect the repo CLI without changing an installed command, use
the local package entry through pnpm:

```bash
pnpm openclaw health
```

## Gateway Development Loop

After `pnpm build`, you can run the packaged Gateway entry directly from this
checkout:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

For TypeScript Gateway iteration:

```bash
pnpm gateway:watch
```

`gateway:watch` starts or restarts the Gateway watch process in a named tmux
session and reloads on relevant source, config, and bundled-plugin metadata
changes. It does not rebuild `dist/control-ui`, so rerun `pnpm ui:build` after
`ui/` changes or use `pnpm ui:dev` while developing the Control UI.

## Updating This Checkout

Keep personal prompts, local config, and credentials out of the repository. To
update the runtime variant source tree:

```bash
git fetch --tags upstream
git status --short --branch
pnpm install
npm test
```

If you maintain a private derivative branch, merge or rebase upstream tags into
that branch first, then re-run the repo-local tests before pushing.

## Related Docs

- [Gateway runbook](/gateway)
- [Gateway configuration](/gateway/configuration)
- [OpenClaw assistant setup](/start/openclaw)
- [Security](/gateway/security)
