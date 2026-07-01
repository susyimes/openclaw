---
summary: "macOS app sources are not bundled in the runtime variant"
title: "macOS app"
read_when:
  - You are checking whether macOS companion app sources are available in this branch
---

The upstream macOS companion app is not bundled in this runtime-focused variant.

`apps/macos` and `apps/macos-mlx-tts` were removed so this branch can focus on
the Gateway, CLI, retained plugins, providers, and local runtime validation.
Restore macOS app runbooks only after reintroducing the app sources and their
validation path.
