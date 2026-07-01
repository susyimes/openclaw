// Official channel catalog tests validate variant channel catalog generation.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOfficialChannelCatalog,
  OFFICIAL_CHANNEL_CATALOG_RELATIVE_PATH,
  writeOfficialChannelCatalog,
} from "../scripts/write-official-channel-catalog.mjs";
import { cleanupTempDirs, makeTempRepoRoot, writeJsonFile } from "./helpers/temp-repo.js";

const tempDirs: string[] = [];

type OfficialChannelCatalogEntry = ReturnType<
  typeof buildOfficialChannelCatalog
>["entries"][number];
type OfficialChannelInstall = NonNullable<
  NonNullable<OfficialChannelCatalogEntry["openclaw"]>["install"]
>;

function makeRepoRoot(prefix: string): string {
  return makeTempRepoRoot(tempDirs, prefix);
}

function writeJson(filePath: string, value: unknown): void {
  writeJsonFile(filePath, value);
}

function requireInstall(entry: OfficialChannelCatalogEntry | undefined): OfficialChannelInstall {
  const install = entry?.openclaw?.install;
  if (!install) {
    throw new Error("expected official channel install config");
  }
  return install;
}

function findCatalogEntry(
  entries: OfficialChannelCatalogEntry[],
  predicate: (entry: OfficialChannelCatalogEntry) => boolean,
): OfficialChannelCatalogEntry {
  const entry = entries.find(predicate);
  if (!entry) {
    throw new Error("expected official channel catalog entry");
  }
  return entry;
}

function summarizeCatalogEntry(entry: OfficialChannelCatalogEntry) {
  return {
    name: entry.name,
    description: entry.description,
    source: entry.source,
    plugin: entry.openclaw?.plugin,
    channel: entry.openclaw?.channel,
    install: entry.openclaw?.install,
  };
}

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

describe("buildOfficialChannelCatalog", () => {
  it("includes publishable local channel plugins without injecting external channels", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-");
    writeJson(path.join(repoRoot, "extensions", "storepack-chat", "package.json"), {
      name: "@openclaw/storepack-chat",
      version: "2026.6.11",
      description: "OpenClaw Storepack channel plugin",
      openclaw: {
        channel: {
          id: "storepack-chat",
          label: "Storepack Chat",
          selectionLabel: "Storepack Chat",
          detailLabel: "Storepack Chat",
          docsPath: "/channels/storepack-chat",
          blurb: "storepack-first channel",
        },
        install: {
          clawhubSpec: "clawhub:@openclaw/storepack-chat",
          npmSpec: "@openclaw/storepack-chat",
          defaultChoice: "clawhub",
        },
        release: {
          publishToNpm: true,
        },
      },
    });
    writeJson(path.join(repoRoot, "extensions", "local-only", "package.json"), {
      name: "@openclaw/local-only",
      openclaw: {
        channel: {
          id: "local-only",
          label: "Local Only",
          selectionLabel: "Local Only",
          docsPath: "/channels/local-only",
          blurb: "dev only",
        },
        install: {
          localPath: "extensions/local-only",
        },
        release: {
          publishToNpm: false,
        },
      },
    });

    const entries = buildOfficialChannelCatalog({ repoRoot }).entries;

    expect(entries.some((entry) => entry.source === "external")).toBe(false);
    expect(entries.map((entry) => entry.name)).not.toContain("@wecom/wecom-openclaw-plugin");
    expect(entries.map((entry) => entry.name)).not.toContain("openclaw-plugin-yuanbao");
    expect(entries.map((entry) => entry.openclaw?.channel?.id)).not.toContain("whatsapp");
    expect(entries.map((entry) => entry.openclaw?.channel?.id)).not.toContain("local-only");
    expect(
      summarizeCatalogEntry(
        findCatalogEntry(entries, (entry) => entry.openclaw?.channel?.id === "storepack-chat"),
      ),
    ).toEqual({
      name: "@openclaw/storepack-chat",
      description: "OpenClaw Storepack channel plugin",
      source: undefined,
      plugin: undefined,
      channel: {
        id: "storepack-chat",
        label: "Storepack Chat",
        selectionLabel: "Storepack Chat",
        detailLabel: "Storepack Chat",
        docsPath: "/channels/storepack-chat",
        blurb: "storepack-first channel",
      },
      install: {
        clawhubSpec: "clawhub:@openclaw/storepack-chat",
        npmSpec: "@openclaw/storepack-chat",
        defaultChoice: "clawhub",
      },
    });
  });

  it("preserves ClawHub specs when generating publishable channel catalog entries", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-clawhub-");
    writeJson(path.join(repoRoot, "extensions", "storepack-chat", "package.json"), {
      name: "@openclaw/storepack-chat",
      openclaw: {
        channel: {
          id: "storepack-chat",
          label: "Storepack Chat",
          selectionLabel: "Storepack Chat",
          docsPath: "/channels/storepack-chat",
          blurb: "storepack-first channel",
        },
        install: {
          clawhubSpec: "clawhub:@openclaw/storepack-chat",
          npmSpec: "@openclaw/storepack-chat",
          defaultChoice: "clawhub",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    const entry = buildOfficialChannelCatalog({ repoRoot }).entries.find(
      (candidate) => candidate.openclaw?.channel?.id === "storepack-chat",
    );

    expect(requireInstall(entry)).toEqual({
      clawhubSpec: "clawhub:@openclaw/storepack-chat",
      npmSpec: "@openclaw/storepack-chat",
      defaultChoice: "clawhub",
    });
  });

  it("writes the official catalog under dist", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-write-");
    writeJson(path.join(repoRoot, "extensions", "storepack-chat", "package.json"), {
      name: "@openclaw/storepack-chat",
      description: "OpenClaw Storepack channel plugin",
      openclaw: {
        channel: {
          id: "storepack-chat",
          label: "Storepack Chat",
          selectionLabel: "Storepack Chat",
          docsPath: "/channels/storepack-chat",
          blurb: "storepack-first channel",
        },
        install: {
          npmSpec: "@openclaw/storepack-chat",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    writeOfficialChannelCatalog({ repoRoot });

    const outputPath = path.join(repoRoot, OFFICIAL_CHANNEL_CATALOG_RELATIVE_PATH);
    expect(fs.existsSync(outputPath)).toBe(true);
    const entries = JSON.parse(fs.readFileSync(outputPath, "utf8")).entries;
    expect(entries.map((entry: { name?: string }) => entry.name)).not.toContain(
      "@wecom/wecom-openclaw-plugin",
    );
    expect(entries.map((entry: { name?: string }) => entry.name)).not.toContain(
      "openclaw-plugin-yuanbao",
    );
    const storepackEntries = entries.filter(
      (entry: { openclaw?: { channel?: { id?: string } } }) =>
        entry.openclaw?.channel?.id === "storepack-chat",
    );
    expect(storepackEntries).toHaveLength(1);
  });
});
