// Test Extension tests cover test extension script behavior.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { bundledPluginFile, bundledPluginRoot } from "openclaw/plugin-sdk/test-fixtures";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  detectChangedExtensionIds,
  listAvailableExtensionIds,
  listChangedExtensionIds,
} from "../../scripts/lib/changed-extensions.mjs";
import {
  DEFAULT_EXTENSION_TEST_SHARD_COUNT,
  createExtensionTestShards,
  resolveExtensionBatchPlan,
  resolveExtensionTestPlan,
} from "../../scripts/lib/extension-test-plan.mjs";
import { relativizeExtensionVitestArgs } from "../../scripts/lib/extension-vitest-paths.mjs";
import { buildVitestBatchPnpmArgs } from "../../scripts/lib/vitest-batch-runner.mjs";
import {
  parseExtensionIds,
  parseExactVitestExcludePaths,
  resolveExtensionBatchParallelism,
  runExtensionBatchPlan,
} from "../../scripts/test-extension-batch.mjs";
import { expectNoNodeFsScans } from "../../src/test-utils/fs-scan-assertions.js";

const scriptPath = path.join(process.cwd(), "scripts", "test-extension.mjs");
const posixIt = process.platform === "win32" ? it.skip : it;

type RunGroupParams = {
  args: string[];
  config: string;
  env: Record<string, string | undefined>;
  targets: string[];
};
function runScriptResult(args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function requireFirstMockArg<T>(mock: { mock: { calls: Array<[T, ...unknown[]]> } }): T {
  const [call] = mock.mock.calls;
  if (!call) {
    throw new Error("expected first mock call argument");
  }
  const [arg] = call;
  if (arg === undefined) {
    throw new Error("expected first mock call argument");
  }
  return arg;
}

function findExtensionWithoutTests() {
  const extensionId = listAvailableExtensionIds().find(
    (candidate) => !resolveExtensionTestPlan({ targetArg: candidate, cwd: process.cwd() }).hasTests,
  );

  if (!extensionId) {
    throw new Error("Expected at least one extension without tests");
  }
  return extensionId;
}

function expectPositiveIntegerMetric(value: number) {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
}

describe("scripts/test-extension.mjs", () => {
  let balancedExtensionShards: ReturnType<typeof createExtensionTestShards>;
  let balancedExpectedExtensionIds: string[];

  beforeAll(() => {
    balancedExtensionShards = createExtensionTestShards({
      cwd: process.cwd(),
      shardCount: DEFAULT_EXTENSION_TEST_SHARD_COUNT,
    });
    balancedExpectedExtensionIds = listAvailableExtensionIds().filter(
      (extensionId) =>
        resolveExtensionTestPlan({ cwd: process.cwd(), targetArg: extensionId }).hasTests,
    );
  });

  it("resolves acpx onto the acpx vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "acpx", cwd: process.cwd() });

    expect(plan.extensionId).toBe("acpx");
    expect(plan.config).toBe("test/vitest/vitest.extension-acpx.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("acpx"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves diffs onto the diffs vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "diffs", cwd: process.cwd() });

    expect(plan.extensionId).toBe("diffs");
    expect(plan.config).toBe("test/vitest/vitest.extension-diffs.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("diffs"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves OpenAI onto its own provider vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "openai", cwd: process.cwd() });

    expect(plan.extensionId).toBe("openai");
    expect(plan.config).toBe("test/vitest/vitest.extension-provider-openai.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("openai"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves memory extensions onto the memory vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "memory-core", cwd: process.cwd() });

    expect(plan.extensionId).toBe("memory-core");
    expect(plan.config).toBe("test/vitest/vitest.extension-memory.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("memory-core"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves broad dedicated extension groups onto their narrow vitest configs", () => {
    expect(resolveExtensionTestPlan({ targetArg: "browser", cwd: process.cwd() }).config).toBe(
      "test/vitest/vitest.extension-browser.config.ts",
    );
    expect(resolveExtensionTestPlan({ targetArg: "firecrawl", cwd: process.cwd() }).config).toBe(
      "test/vitest/vitest.extension-misc.config.ts",
    );
  });

  it("resolves codex onto the codex vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "codex", cwd: process.cwd() });

    expect(plan.extensionId).toBe("codex");
    expect(plan.config).toBe("test/vitest/vitest.extension-codex.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("codex"));
    expect(plan.hasTests).toBe(true);
  });

  it("omits src/<extension> when no paired core root exists", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "firecrawl", cwd: process.cwd() });

    expect(plan.roots).toContain(bundledPluginRoot("firecrawl"));
    expect(plan.roots).not.toContain("src/firecrawl");
    expect(plan.config).toBe("test/vitest/vitest.extension-misc.config.ts");
    expect(plan.hasTests).toBe(true);
  });

  it("infers the extension from the current working directory", () => {
    const cwd = path.join(process.cwd(), "extensions", "firecrawl");
    const plan = resolveExtensionTestPlan({ cwd });

    expect(plan.extensionId).toBe("firecrawl");
    expect(plan.extensionDir).toBe(bundledPluginRoot("firecrawl"));
  });

  it("maps changed paths back to extension ids", () => {
    const extensionIds = detectChangedExtensionIds([
      bundledPluginFile("browser", "src/browser.ts"),
      bundledPluginFile("firecrawl", "package.json"),
      "src/not-a-plugin/file.ts",
    ]);

    expect(extensionIds).toEqual(["browser", "firecrawl"]);
  });

  it("lists available extension ids", () => {
    const extensionIds = listAvailableExtensionIds();

    expect(extensionIds).toContain("browser");
    expect(extensionIds).toContain("firecrawl");
    expect(extensionIds).toEqual(
      [...extensionIds].toSorted((left, right) => left.localeCompare(right)),
    );
  });

  it("lists available extension ids from git without reading extension directories", () => {
    const payload = expectNoNodeFsScans<{
      changed: string[];
      ids: number;
    }>(`
      const { detectChangedExtensionIds, listAvailableExtensionIds } =
        await import("./scripts/lib/changed-extensions.mjs");
      const ids = listAvailableExtensionIds();
      const changed = detectChangedExtensionIds([
        "extensions/browser/src/browser.ts",
        "extensions/not-real/package.json",
      ]);
      return { changed, ids: ids.length };
    `);
    expect(payload.changed).toEqual(["browser"]);
    expect(payload.ids).toBeGreaterThan(0);
  });

  it("can fail safe to all extensions when the base revision is unavailable", () => {
    const extensionIds = listChangedExtensionIds({
      base: "refs/heads/openclaw-test-missing-base",
      unavailableBaseBehavior: "all",
    });

    expect(extensionIds).toEqual(listAvailableExtensionIds());
  });

  it("resolves a plan for extensions without tests", () => {
    const extensionId = findExtensionWithoutTests();
    const plan = resolveExtensionTestPlan({ cwd: process.cwd(), targetArg: extensionId });

    expect(plan.extensionId).toBe(extensionId);
    expect(plan.hasTests).toBe(false);
    expect(plan.testFileCount).toBe(0);
  });

  it("batches extensions into config-specific vitest invocations", () => {
    const batch = resolveExtensionBatchPlan({
      cwd: process.cwd(),
      extensionIds: [
        "firecrawl",
        "openai",
        "memory-core",
        "deepseek",
        "acpx",
        "diffs",
        "browser",
      ],
    });

    expect(batch.extensionIds).toEqual([
      "acpx",
      "browser",
      "deepseek",
      "diffs",
      "firecrawl",
      "memory-core",
      "openai",
    ]);
    const stablePlanGroups = batch.planGroups.map(({ estimatedCost, testFileCount, ...group }) => {
      expectPositiveIntegerMetric(estimatedCost);
      expectPositiveIntegerMetric(testFileCount);
      return group;
    });

    expect(stablePlanGroups).toEqual([
      {
        config: "test/vitest/vitest.extension-acpx.config.ts",
        extensionIds: ["acpx"],
        roots: [bundledPluginRoot("acpx")],
      },
      {
        config: "test/vitest/vitest.extension-browser.config.ts",
        extensionIds: ["browser"],
        roots: [bundledPluginRoot("browser")],
      },
      {
        config: "test/vitest/vitest.extension-diffs.config.ts",
        extensionIds: ["diffs"],
        roots: [bundledPluginRoot("diffs")],
      },
      {
        config: "test/vitest/vitest.extension-memory.config.ts",
        extensionIds: ["memory-core"],
        roots: [bundledPluginRoot("memory-core")],
      },
      {
        config: "test/vitest/vitest.extension-misc.config.ts",
        extensionIds: ["firecrawl"],
        roots: [bundledPluginRoot("firecrawl")],
      },
      {
        config: "test/vitest/vitest.extension-provider-openai.config.ts",
        extensionIds: ["openai"],
        roots: [bundledPluginRoot("openai")],
      },
      {
        config: "test/vitest/vitest.extension-providers.config.ts",
        extensionIds: ["deepseek"],
        roots: [bundledPluginRoot("deepseek")],
      },
    ]);
  });

  it("keeps explicitly requested extensions without tests in batch plans", () => {
    const extensionId = findExtensionWithoutTests();
    const batch = resolveExtensionBatchPlan({
      cwd: process.cwd(),
      extensionIds: [extensionId, "firecrawl"],
    });

    expect(batch.extensionIds).toEqual(
      [extensionId, "firecrawl"].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(batch.extensionCount).toBe(2);
    expect(batch.noTestExtensionIds).toEqual([extensionId]);
    expect(batch.hasTests).toBe(true);
    expect(batch.testFileCount).toBe(1);
    expect(batch.planGroups.flatMap((group) => group.extensionIds)).toEqual(["firecrawl"]);
  });

  it("counts tracked extension tests without walking extension directories", () => {
    const payload = expectNoNodeFsScans<{
      batchTests: number;
      shards: number;
      shardTests: number;
    }>(
      `
        const { createExtensionTestShards, resolveExtensionBatchPlan } =
          await import("./scripts/lib/extension-test-plan.mjs");
        const extensionIds = ["browser", "deepseek", "firecrawl", "openai"];
        const batch = resolveExtensionBatchPlan({ cwd: process.cwd(), extensionIds });
        const shards = createExtensionTestShards({ cwd: process.cwd(), extensionIds, shardCount: 2 });
        return {
          batchTests: batch.testFileCount,
          shards: shards.length,
          shardTests: shards.reduce((total, shard) => total + shard.testFileCount, 0),
        };
      `,
      { counters: ["readdirSync"] },
    );
    expect(payload.batchTests).toBeGreaterThan(0);
    expect(payload.shards).toBe(2);
    expect(payload.shardTests).toBe(payload.batchTests);
  });

  it("balances extension test shards by estimated CI cost", () => {
    const shards = balancedExtensionShards;

    expect(shards).toHaveLength(DEFAULT_EXTENSION_TEST_SHARD_COUNT);
    expect(shards.map((shard) => shard.checkName)).toEqual(
      shards.map((shard, index) => `checks-node-extensions-shard-${index + 1}`),
    );

    const assigned = shards.flatMap((shard) => shard.extensionIds);
    const uniqueAssigned = [...new Set(assigned)];

    expect(uniqueAssigned.toSorted((left, right) => left.localeCompare(right))).toEqual(
      balancedExpectedExtensionIds.toSorted((left, right) => left.localeCompare(right)),
    );
    expect(assigned).toHaveLength(balancedExpectedExtensionIds.length);

    const totals = shards.map((shard) => shard.estimatedCost);
    const largestSingleExtensionCost = Math.max(
      ...balancedExpectedExtensionIds.map(
        (extensionId) => resolveExtensionTestPlan({ cwd: process.cwd(), targetArg: extensionId })
          .estimatedCost,
      ),
    );
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(
      largestSingleExtensionCost,
    );

    for (const shard of shards) {
      expect(shard.extensionIds.length).toBeGreaterThan(0);
    }
  });

  it("rejects malformed extension shard counts", () => {
    expect(() =>
      createExtensionTestShards({
        cwd: process.cwd(),
        extensionIds: ["deepseek", "openai"],
        shardCount: "2x",
      }),
    ).toThrow("shardCount must be a positive integer");
  });

  it("runs extension batch config groups concurrently when requested", async () => {
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const runGroup = vi.fn((params: RunGroupParams) => {
      started.push(params.config);
      return new Promise<number>((resolve) => {
        resolvers.push(() => resolve(0));
      });
    });
    const runPromise = runExtensionBatchPlan(
      {
        extensionCount: 3,
        extensionIds: ["one", "two", "three"],
        estimatedCost: 60,
        hasTests: true,
        planGroups: [
          {
            config: "light",
            estimatedCost: 10,
            extensionIds: ["one"],
            roots: ["extensions/one"],
            testFileCount: 1,
          },
          {
            config: "heavy",
            estimatedCost: 30,
            extensionIds: ["two"],
            roots: ["extensions/two"],
            testFileCount: 3,
          },
          {
            config: "middle",
            estimatedCost: 20,
            extensionIds: ["three"],
            roots: ["extensions/three"],
            testFileCount: 2,
          },
        ],
        testFileCount: 6,
      },
      {
        env: { OPENCLAW_EXTENSION_BATCH_PARALLEL: "2" },
        runGroup,
        vitestArgs: ["--reporter=dot"],
      },
    );

    await Promise.resolve();
    expect(started).toEqual(["heavy", "middle"]);
    resolvers.shift()?.();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(started).toEqual(["heavy", "middle", "light"]);
    while (resolvers.length > 0) {
      resolvers.shift()?.();
    }
    await expect(runPromise).resolves.toBe(0);
    expect(runGroup).toHaveBeenCalledTimes(3);
    const firstRunGroupParams = requireFirstMockArg<RunGroupParams>(runGroup);
    expect(firstRunGroupParams).toEqual({
      args: ["--reporter=dot"],
      config: "heavy",
      env: {
        OPENCLAW_EXTENSION_BATCH_PARALLEL: "2",
        OPENCLAW_VITEST_FS_MODULE_CACHE_PATH: path.join(
          process.cwd(),
          "node_modules",
          ".experimental-vitest-cache",
          "extension-batch",
          "0-heavy",
        ),
      },
      targets: ["two"],
    });
  });

  it("keeps extension batch parallelism bounded by group count", () => {
    expect(resolveExtensionBatchParallelism(3, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "2" })).toBe(2);
    expect(resolveExtensionBatchParallelism(1, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "4" })).toBe(1);
    expect(resolveExtensionBatchParallelism(3, {})).toBe(1);
  });

  it("rejects malformed extension batch parallelism", () => {
    for (const value of ["nope", "2x", "0"]) {
      expect(() =>
        resolveExtensionBatchParallelism(3, { OPENCLAW_EXTENSION_BATCH_PARALLEL: value }),
      ).toThrow("OPENCLAW_EXTENSION_BATCH_PARALLEL must be a positive integer");
    }
  });

  it("preserves positional Vitest args after the extension batch separator", () => {
    expect(
      parseExtensionIds([
        "firecrawl",
        "--coverage",
        "--",
        "extensions/firecrawl/index.test.ts",
        "--run",
      ]),
    ).toEqual({
      extensionIds: ["firecrawl"],
      passthroughArgs: ["--coverage", "extensions/firecrawl/index.test.ts", "--run"],
    });
  });

  it("places Vitest passthrough options before batch target roots", () => {
    expect(
      buildVitestBatchPnpmArgs({
        args: ["--exclude", "codex/src/app-server/run-attempt.test.ts"],
        config: "test/vitest/vitest.extensions.config.ts",
        targets: ["codex"],
      }),
    ).toEqual([
      "exec",
      "vitest",
      "run",
      "--config",
      "test/vitest/vitest.extensions.config.ts",
      "--exclude",
      "codex/src/app-server/run-attempt.test.ts",
      "codex",
    ]);
  });

  it("relativizes extension Vitest path args to the scoped extensions dir", () => {
    expect(
      relativizeExtensionVitestArgs([
        "--exclude",
        "extensions/codex/src/app-server/run-attempt.test.ts",
        "--outputFile",
        "extensions/codex/report.json",
        "-c",
        "./vitest.local.ts",
        "-r",
        ".",
        "--exclude=extensions/codex/src/app-server/client.test.ts",
        "extensions/codex/src/app-server/models.test.ts",
        "--reporter=dot",
      ]),
    ).toEqual([
      "--exclude",
      "codex/src/app-server/run-attempt.test.ts",
      "--outputFile",
      "extensions/codex/report.json",
      "-c",
      "./vitest.local.ts",
      "-r",
      ".",
      "--exclude=codex/src/app-server/client.test.ts",
      "codex/src/app-server/models.test.ts",
      "--reporter=dot",
    ]);
  });

  posixIt("relativizes single-extension Vitest paths from extension cwd", () => {
    const root = mkdtempSync(path.join(tmpdir(), "openclaw-test-extension-args-"));
    const fakePnpmPath = path.join(root, "pnpm");
    const argsPath = path.join(root, "args.json");
    const extensionCwd = path.join(process.cwd(), "extensions", "codex");

    writeFakePnpm(fakePnpmPath);
    try {
      const result = spawnSync(
        process.execPath,
        [
          scriptPath,
          "codex",
          "--exclude",
          path.join(extensionCwd, "src", "app-server", "run-attempt.test.ts"),
          path.join(extensionCwd, "src", "app-server", "client.test.ts"),
        ],
        {
          cwd: extensionCwd,
          encoding: "utf8",
          env: {
            ...process.env,
            OPENCLAW_FAKE_PNPM_ARGS_PATH: argsPath,
            npm_execpath: fakePnpmPath,
          },
        },
      );

      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(argsPath, "utf8"))).toEqual([
        "exec",
        "vitest",
        "run",
        "--config",
        "test/vitest/vitest.extension-codex.config.ts",
        "--exclude",
        "codex/src/app-server/run-attempt.test.ts",
        "codex/src/app-server/client.test.ts",
        "codex",
      ]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  posixIt(
    "preserves wrapper termination when the pnpm child exits cleanly after SIGTERM",
    async () => {
      const root = mkdtempSync(path.join(tmpdir(), "openclaw-test-extension-signal-"));
      const fakePnpmPath = path.join(root, "pnpm");
      const childPidPath = path.join(root, "child.pid");
      const descendantPidPath = path.join(root, "descendant.pid");
      const signaledPath = path.join(root, "signaled");

      writeFakePnpm(fakePnpmPath);
      const runner = spawn(process.execPath, [scriptPath, "firecrawl"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          OPENCLAW_FAKE_PNPM_DESCENDANT_PID_PATH: descendantPidPath,
          OPENCLAW_FAKE_PNPM_PID_PATH: childPidPath,
          OPENCLAW_FAKE_PNPM_SIGNALED_PATH: signaledPath,
          npm_execpath: fakePnpmPath,
        },
        stdio: "ignore",
      });
      let childPid = 0;
      let descendantPid = 0;

      try {
        await waitFor(() => fileExists(childPidPath), 5_000);
        await waitFor(() => fileExists(descendantPidPath), 5_000);
        childPid = Number(readFileSync(childPidPath, "utf8"));
        descendantPid = Number(readFileSync(descendantPidPath, "utf8"));
        expect(Number.isInteger(childPid)).toBe(true);
        expect(Number.isInteger(descendantPid)).toBe(true);

        expect(runner.pid).toBeGreaterThan(0);
        process.kill(runner.pid!, "SIGTERM");
        const result = await waitForClose(runner);

        expect(result).toEqual({ code: null, signal: "SIGTERM" });
        await waitFor(() => fileExists(signaledPath), 5_000);
        expect(readFileSync(signaledPath, "utf8")).toBe("SIGTERM");
        await waitFor(() => !isProcessAlive(childPid), 5_000);
        await waitFor(() => !isProcessAlive(descendantPid), 5_000);
      } finally {
        if (runner.pid && isProcessAlive(runner.pid)) {
          process.kill(runner.pid, "SIGKILL");
        }
        if (childPid && isProcessAlive(childPid)) {
          process.kill(childPid, "SIGKILL");
        }
        if (descendantPid && isProcessAlive(descendantPid)) {
          process.kill(descendantPid, "SIGKILL");
        }
        rmSync(root, { force: true, recursive: true });
      }
    },
  );

  it("expands extension batch roots before applying exact Vitest excludes", async () => {
    const runGroup = vi.fn<() => Promise<number>>().mockResolvedValue(0);
    await runExtensionBatchPlan(
      {
        extensionCount: 1,
        extensionIds: ["codex"],
        estimatedCost: 1,
        hasTests: true,
        planGroups: [
          {
            config: "test/vitest/vitest.extensions.config.ts",
            estimatedCost: 1,
            extensionIds: ["codex"],
            roots: [bundledPluginRoot("codex")],
            testFileCount: 1,
          },
        ],
        testFileCount: 1,
      },
      {
        runGroup,
        vitestArgs: ["--exclude", "extensions/codex/src/app-server/run-attempt.test.ts"],
      },
    );

    const runParams = requireFirstMockArg<RunGroupParams>(runGroup);
    expect(runParams.targets).not.toContain("extensions/codex/src/app-server/run-attempt.test.ts");
    expect(runParams.targets).not.toContain("codex/src/app-server/run-attempt.test.ts");
    expect(runParams.targets).toContain("codex/src/app-server/client.test.ts");
  });

  it("fails extension batch groups when exact excludes remove every test", async () => {
    const runGroup = vi.fn<() => Promise<number>>().mockResolvedValue(0);
    const result = await runExtensionBatchPlan(
      resolveExtensionBatchPlan({ cwd: process.cwd(), extensionIds: ["firecrawl"] }),
      {
        runGroup,
        vitestArgs: ["--exclude", bundledPluginFile("firecrawl", "src/firecrawl-tools.test.ts")],
      },
    );

    expect(result).toBe(1);
    expect(runGroup).not.toHaveBeenCalled();
  });

  it("fails extension batch groups when dir-relative exact excludes remove every test", async () => {
    const runGroup = vi.fn<() => Promise<number>>().mockResolvedValue(0);
    const result = await runExtensionBatchPlan(
      resolveExtensionBatchPlan({ cwd: process.cwd(), extensionIds: ["firecrawl"] }),
      {
        runGroup,
        vitestArgs: ["--exclude", "firecrawl/src/firecrawl-tools.test.ts"],
      },
    );

    expect(result).toBe(1);
    expect(runGroup).not.toHaveBeenCalled();
  });

  it("allows extension batch groups to opt into empty exact excludes", async () => {
    const runGroup = vi.fn<() => Promise<number>>().mockResolvedValue(0);
    const result = await runExtensionBatchPlan(
      resolveExtensionBatchPlan({ cwd: process.cwd(), extensionIds: ["firecrawl"] }),
      {
        allowEmptyAfterExclude: true,
        runGroup,
        vitestArgs: ["--exclude", bundledPluginFile("firecrawl", "src/firecrawl-tools.test.ts")],
      },
    );

    expect(result).toBe(0);
    expect(runGroup).not.toHaveBeenCalled();
  });

  it("detects exact Vitest excludes in extension batch args", () => {
    expect([
      ...parseExactVitestExcludePaths([
        "--exclude",
        "extensions/codex/src/app-server/run-attempt.test.ts",
      ]),
    ]).toEqual(["extensions/codex/src/app-server/run-attempt.test.ts"]);
    expect([...parseExactVitestExcludePaths(["--exclude=extensions/**/*.test.ts"])]).toEqual([]);
  });

  it("accepts pnpm's leading argument separator before extension ids", () => {
    expect(parseExtensionIds(["--", "browser,firecrawl", "--run"])).toEqual({
      extensionIds: ["browser", "firecrawl"],
      passthroughArgs: ["--run"],
    });
  });

  it("fails explicitly requested extensions without tests by default", () => {
    const extensionId = findExtensionWithoutTests();
    const result = runScriptResult([extensionId]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`No tests found for ${bundledPluginRoot(extensionId)}.`);
  });

  it("allows explicitly requested extensions without tests when requested", () => {
    const extensionId = findExtensionWithoutTests();
    const result = runScriptResult([extensionId, "--allow-no-tests"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(`No tests found for ${bundledPluginRoot(extensionId)}.`);
  });
});

function writeFakePnpm(filePath: string): void {
  writeFileSync(
    filePath,
    [
      "#!/usr/bin/env node",
      'const { spawn } = require("node:child_process");',
      'const fs = require("node:fs");',
      "if (process.env.OPENCLAW_FAKE_PNPM_ARGS_PATH) {",
      "  fs.writeFileSync(process.env.OPENCLAW_FAKE_PNPM_ARGS_PATH, JSON.stringify(process.argv.slice(2)));",
      "  process.exit(0);",
      "}",
      "if (process.env.OPENCLAW_FAKE_PNPM_DESCENDANT_PID_PATH) {",
      "  const child = spawn(process.execPath, [",
      '    "-e",',
      "    \"process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);\",",
      "  ], { stdio: 'ignore' });",
      "  fs.writeFileSync(process.env.OPENCLAW_FAKE_PNPM_DESCENDANT_PID_PATH, String(child.pid));",
      "}",
      "fs.writeFileSync(process.env.OPENCLAW_FAKE_PNPM_PID_PATH, String(process.pid));",
      'process.on("SIGTERM", () => {',
      '  fs.writeFileSync(process.env.OPENCLAW_FAKE_PNPM_SIGNALED_PATH, "SIGTERM");',
      "  process.exit(0);",
      "});",
      "setInterval(() => {}, 1000);",
      "",
    ].join("\n"),
  );
  chmodSync(filePath, 0o755);
}

async function waitFor(condition: () => boolean, timeoutMs = 3_000): Promise<void> {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await delay(25);
  }
}

async function waitForClose(
  child: ReturnType<typeof spawn>,
  timeoutMs = 5_000,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return await Promise.race([
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.once("close", (code, signal) => resolve({ code, signal }));
    }),
    delay(timeoutMs).then(() => {
      throw new Error("timed out waiting for child close");
    }),
  ]);
}

function fileExists(filePath: string): boolean {
  try {
    readFileSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
