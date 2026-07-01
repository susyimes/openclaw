---
summary: "Android app sources are not bundled in the runtime variant"
title: "Android app"
read_when:
  - You are checking whether Android app sources are available in this branch
---

The upstream Android app is not bundled in this runtime-focused variant.

`apps/android` and the Android release/build pipeline were removed so this
branch can focus on the Gateway, CLI, retained plugins, providers, and local
runtime validation. Restore an Android runbook only after reintroducing the app
source and its validation path.
