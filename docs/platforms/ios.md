---
summary: "iOS app sources are not bundled in the runtime variant"
title: "iOS app"
read_when:
  - You are checking whether iOS app sources are available in this branch
---

The upstream iOS app is not bundled in this runtime-focused variant.

`apps/ios` and the iOS release/build pipeline were removed so this branch can
focus on the Gateway, CLI, retained plugins, providers, and local runtime
validation. Restore an iOS runbook only after reintroducing the app source and
its validation path.
