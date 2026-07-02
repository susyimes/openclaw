import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureEnv, setTestEnvValue } from "../../test-utils/env.js";
import { projectionReviewHandlers } from "./projection-review.js";
import type { RespondFn } from "./types.js";

const envSnapshot = captureEnv([
  "OPENCLAW_PROJECTION_REVIEW_ROOT",
  "OPENCLAW_PROJECTION_AGENT_ROOT",
  "OPENCLAW_PROJECTION_REVIEW_SCRIPT",
  "OPENCLAW_PROJECTION_REVIEW_PYTHON",
  "OPENCLAW_PROJECTION_INTERACTION_DIR",
  "OPENCLAW_PROJECTION_INSPIRATION_OUTPUT_DIR",
  "OPENCLAW_PROJECTION_INSPIRATION_INBOX_DIR",
]);

type ProjectionReviewListPayload = {
  enabled?: boolean;
  pending?: Array<Record<string, unknown>>;
};

let tempDir: string;
let reviewRoot: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-projection-review-"));
  reviewRoot = path.join(tempDir, "review");
  await fs.mkdir(path.join(reviewRoot, "pending"), { recursive: true });
  await fs.mkdir(path.join(reviewRoot, "done"), { recursive: true });
  setTestEnvValue("OPENCLAW_PROJECTION_REVIEW_ROOT", reviewRoot);
  setTestEnvValue("OPENCLAW_PROJECTION_AGENT_ROOT", tempDir);
  setTestEnvValue("OPENCLAW_PROJECTION_INTERACTION_DIR", path.join(tempDir, "memory"));
});

afterEach(async () => {
  envSnapshot.restore();
  await fs.rm(tempDir, { recursive: true, force: true });
});

function captureRespond() {
  const calls: Parameters<RespondFn>[] = [];
  const respond: RespondFn = (...args) => {
    calls.push(args);
  };
  return { calls, respond };
}

async function runHandler(
  method: "projection.review.list" | "projection.review.feedback",
  params = {},
) {
  const { calls, respond } = captureRespond();
  await projectionReviewHandlers[method]({
    req: { type: "req", id: `req-${method}`, method },
    params,
    respond,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return calls;
}

async function writeCard(cardId = "rv_20260702_161337_baab3136"): Promise<string> {
  const cardPath = path.join(reviewRoot, "pending", `2026-projection_spark-${cardId}.md`);
  await fs.writeFile(
    cardPath,
    `---
schema: projection.review_card.v1
card_id: ${cardId}
kind: projection_spark
status: pending
title: "spark: Benchmark"
summary: "score=62; make an acceptance check."
created_at: 2026-07-02T16:13:37+00:00
source: projection-agent
autonomy_level: L2
signal_key: projection_spark:llm_agents
action_key: abc123
action_fingerprint: abc123
object_ref: http://example.test/paper
memory_refs: []
---

# spark: Benchmark

summary

\`\`\`json
{
  "projection_spark": {
    "title": "Benchmark",
    "spark": "Turn evaluator ideas into acceptance checks.",
    "transfer_pattern": "external evaluator -> local acceptance check",
    "small_experiment": "Generate a pass/fail line.",
    "scores": { "spark_score": 62 },
    "source_refs": [{ "source": "arxiv", "url": "http://example.test/paper" }]
  }
}
\`\`\`
`,
    "utf8",
  );
  return cardPath;
}

async function writeFakeFeedbackCli(): Promise<string> {
  const scriptPath = path.join(tempDir, "fake-projection-review.cjs");
  await fs.writeFile(
    scriptPath,
    `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const readArg = (name) => args[args.indexOf(name) + 1];
const reviewRoot = readArg("--review-root");
const cardId = readArg("--card");
const pending = path.join(reviewRoot, "pending");
const done = path.join(reviewRoot, "done");
const file = fs.readdirSync(pending).find((name) => name.includes(cardId));
if (!file) {
  console.error("card not found");
  process.exit(2);
}
fs.mkdirSync(done, { recursive: true });
fs.renameSync(path.join(pending, file), path.join(done, file));
process.stdout.write(JSON.stringify({ applied: true, card_id: cardId }));
`,
    "utf8",
  );
  return scriptPath;
}

describe("projectionReviewHandlers", () => {
  it("lists projection review cards from the local queue", async () => {
    await writeCard();

    const calls = await runHandler("projection.review.list");
    const payload = calls[0]?.[1] as ProjectionReviewListPayload;

    expect(calls[0]?.[0]).toBe(true);
    expect(payload.enabled).toBe(true);
    expect(payload.pending).toHaveLength(1);
    expect(payload.pending?.[0]).toMatchObject({
      id: "rv_20260702_161337_baab3136",
      kind: "projection_spark",
      title: "spark: Benchmark",
      spark: {
        score: 62,
        smallExperiment: "Generate a pass/fail line.",
      },
    });
  });

  it("applies feedback through the projection review command and refreshes cards", async () => {
    await writeCard();
    const scriptPath = await writeFakeFeedbackCli();
    setTestEnvValue("OPENCLAW_PROJECTION_REVIEW_SCRIPT", scriptPath);
    setTestEnvValue("OPENCLAW_PROJECTION_REVIEW_PYTHON", process.execPath);

    const calls = await runHandler("projection.review.feedback", {
      cardId: "rv_20260702_161337_baab3136",
      feedbackText: "score: 5",
    });
    const payload = calls[0]?.[1] as { review?: ProjectionReviewListPayload } | undefined;

    expect(calls[0]?.[0]).toBe(true);
    expect(payload?.review?.pending).toHaveLength(0);
    await expect(
      fs.stat(
        path.join(reviewRoot, "done", "2026-projection_spark-rv_20260702_161337_baab3136.md"),
      ),
    ).resolves.toBeTruthy();
  });
});
