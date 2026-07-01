---
summary: "Runtime variant validation commands"
title: "Validation"
read_when:
  - You need the local checks for this runtime-focused variant
  - You are preparing a private branch or pull request
---

This runtime-focused variant does not ship the upstream GitHub Actions, mobile,
release, Docker, or showcase CI matrix. Treat validation as a local/private-CI
contract around the retained Gateway, CLI, Control UI, extension, provider, and
catalog surfaces.

## Local Checks

Use these commands from the repository root:

```bash
npm test
node scripts/run-vitest.mjs
node scripts/run-tsgo.mjs -p tsconfig.core.json
node scripts/run-tsgo.mjs -p tsconfig.extensions.json
pnpm build
```

Prefer focused `node scripts/run-vitest.mjs <target>` runs while editing, then
run `npm test` before publishing or merging the variant branch.

## Boundary

This page intentionally does not describe upstream jobs for Android, iOS, macOS
apps, fastlane, broad Docker release suites, or public GitHub Actions status.
Those sources were removed from this branch and should only be restored if they
become part of the variant's runtime direction again.
