import { describe, expect, it } from "vitest";
import {
  type OfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalProviderContractPluginIds,
  resolveOfficialExternalProviderPluginIds,
  resolveOfficialExternalProviderPluginIdsForEnv,
  resolveOfficialExternalWebProviderContractPluginIdsForEnv,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall,
} from "./official-external-plugin-catalog.js";

function expectCatalogEntry(id: string): OfficialExternalPluginCatalogEntry {
  const entry = getOfficialExternalPluginCatalogEntry(id);
  if (entry === undefined) {
    throw new Error(`Expected external plugin catalog entry for ${id}`);
  }
  return entry;
}

describe("official external plugin catalog", () => {
  it("only lists the runtime variant external catalog entries", () => {
    const ids = listOfficialExternalPluginCatalogEntries()
      .map((entry) => resolveOfficialExternalPluginId(entry))
      .filter((id): id is string => Boolean(id))
      .toSorted((left, right) => left.localeCompare(right));

    expect(ids).toEqual([
      "acpx",
      "brave",
      "codex",
      "deepseek",
      "diagnostics-otel",
      "diagnostics-prometheus",
      "diffs",
      "diffs-language-pack",
      "exa",
      "firecrawl",
      "kimi",
      "memory-lancedb",
      "openshell",
      "parallel",
      "qwen",
      "searxng",
      "tavily",
      "tokenjuice",
    ]);
    expect(getOfficialExternalPluginCatalogEntry("discord")).toBeUndefined();
    expect(getOfficialExternalPluginCatalogEntry("matrix")).toBeUndefined();
    expect(getOfficialExternalPluginCatalogEntry("groq")).toBeUndefined();
  });

  it("keeps install metadata for retained runtime plugins and providers", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("acpx"))).toMatchObject({
      npmSpec: "@openclaw/acpx",
      defaultChoice: "npm",
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("deepseek"))).toMatchObject({
      clawhubSpec: "clawhub:@openclaw/deepseek-provider",
      npmSpec: "@openclaw/deepseek-provider",
      defaultChoice: "npm",
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("diffs-language-pack"))).toEqual(
      {
        npmSpec: "@openclaw/diffs-language-pack",
        clawhubSpec: "clawhub:@openclaw/diffs-language-pack",
        defaultChoice: "npm",
        minHostVersion: ">=2026.5.27",
      },
    );
  });

  it("resolves retained provider aliases and environment credentials", () => {
    const qwen = expectCatalogEntry("qwen");
    const kimi = expectCatalogEntry("kimi");

    expect(getOfficialExternalPluginCatalogEntry("modelstudio")).toBe(qwen);
    expect(getOfficialExternalPluginCatalogEntry("qwen-portal")).toBe(qwen);
    expect(getOfficialExternalPluginCatalogEntry("kimi-coding")).toBe(kimi);
    expect(
      resolveOfficialExternalProviderPluginIds({
        providerIds: new Set(["deepseek", "kimi-coding", "modelstudio", "groq"]),
      }),
    ).toEqual(["deepseek", "kimi", "qwen"]);
    expect(
      resolveOfficialExternalProviderPluginIdsForEnv({
        DEEPSEEK_API_KEY: "deepseek-key",
        KIMI_API_KEY: "kimi-key",
        MODELSTUDIO_API_KEY: "qwen-key",
        GROQ_API_KEY: "ignored",
      }),
    ).toEqual(["deepseek", "kimi", "qwen"]);
  });

  it("maps retained web-search contracts to plugin owners", () => {
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "webSearchProviders",
        providerIds: new Set(["brave", "firecrawl", "parallel-free", "tavily"]),
      }),
    ).toEqual(["firecrawl", "parallel", "tavily"]);
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webSearchProviders",
        env: {
          BRAVE_API_KEY: "brave-key",
          EXA_API_KEY: "exa-key",
          FIRECRAWL_API_KEY: "firecrawl-key",
          PARALLEL_API_KEY: "parallel-key",
          TAVILY_API_KEY: "tavily-key",
        },
      }),
    ).toEqual(["exa", "firecrawl", "parallel", "tavily"]);
  });

  it("allows invalid-config recovery only for retained stock external plugins", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("brave"))).toMatchObject({
      npmSpec: "@openclaw/brave-plugin",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("searxng"))).toMatchObject({
      npmSpec: "@openclaw/searxng-plugin",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("tavily"))).toMatchObject({
      npmSpec: "@openclaw/tavily-plugin",
      allowInvalidConfigRecovery: true,
    });
  });
});
