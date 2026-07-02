// Projection review gateway methods bridge the Control UI to the local
// projection-agent review queue without making the browser read files directly.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const DEFAULT_WINDOWS_REVIEW_ROOT = "D:\\atprojection-agent\\review";
const DEFAULT_WINDOWS_PROJECTION_AGENT_ROOT = "D:\\projection-agent";
const MAX_PENDING_CARDS = 100;
const MAX_CARD_BYTES = 512 * 1024;
const MAX_BODY_PREVIEW_CHARS = 6_000;
const MAX_COMMENT_CHARS = 2_000;
const MAX_PROCESS_OUTPUT_CHARS = 16_000;

type FrontMatter = Record<string, unknown>;

type ProjectionReviewSourceRef = {
  source?: string;
  topic?: string;
  title?: string;
  url?: string;
  when?: string;
};

type ProjectionReviewSpark = {
  title?: string;
  spark?: string;
  why?: string;
  transferPattern?: string;
  smallExperiment?: string;
  doNotDoYet?: string;
  score?: number;
  sourceRefs: ProjectionReviewSourceRef[];
};

type ProjectionReviewCard = {
  id: string;
  kind: string;
  status: string;
  title: string;
  summary: string;
  createdAt?: string;
  source?: string;
  autonomyLevel?: string;
  signalKey?: string;
  actionKey?: string;
  actionFingerprint?: string;
  objectRef?: string;
  memoryRefs: string[];
  path: string;
  bodyPreview: string;
  spark?: ProjectionReviewSpark;
};

type ProjectionReviewListResult = {
  enabled: boolean;
  reviewRoot: string;
  pending: ProjectionReviewCard[];
  scriptAvailable: boolean;
  scriptPath?: string;
  interactionDir?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function compactText(value: unknown, limit = 240): string {
  const text = String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function resolveConfiguredPath(envName: string): string | undefined {
  const value = process.env[envName]?.trim();
  return value ? path.resolve(value) : undefined;
}

function resolveReviewRoot(): string {
  const configured = resolveConfiguredPath("OPENCLAW_PROJECTION_REVIEW_ROOT");
  if (configured) {
    return configured;
  }
  if (process.platform === "win32") {
    return DEFAULT_WINDOWS_REVIEW_ROOT;
  }
  return path.join(os.homedir(), ".atprojection-agent", "review");
}

function resolveProjectionAgentRoot(): string | undefined {
  const configured = resolveConfiguredPath("OPENCLAW_PROJECTION_AGENT_ROOT");
  if (configured) {
    return configured;
  }
  if (process.platform === "win32" && existsSync(DEFAULT_WINDOWS_PROJECTION_AGENT_ROOT)) {
    return DEFAULT_WINDOWS_PROJECTION_AGENT_ROOT;
  }
  const sibling = path.resolve(process.cwd(), "..", "projection-agent");
  return existsSync(sibling) ? sibling : undefined;
}

function resolveProjectionReviewScript(): string | undefined {
  const configured = resolveConfiguredPath("OPENCLAW_PROJECTION_REVIEW_SCRIPT");
  if (configured) {
    return configured;
  }
  const root = resolveProjectionAgentRoot();
  if (!root) {
    return undefined;
  }
  const script = path.join(root, "tools", "projection_review.py");
  return existsSync(script) ? script : undefined;
}

function resolveInteractionDir(scriptPath: string | undefined): string | undefined {
  const configured = resolveConfiguredPath("OPENCLAW_PROJECTION_INTERACTION_DIR");
  if (configured) {
    return configured;
  }
  const root = resolveProjectionAgentRoot();
  if (root) {
    return path.join(root, "memory", "interaction");
  }
  if (!scriptPath) {
    return undefined;
  }
  return path.resolve(path.dirname(scriptPath), "..", "memory", "interaction");
}

function resolveInspirationOutputDir(): string | undefined {
  return resolveConfiguredPath("OPENCLAW_PROJECTION_INSPIRATION_OUTPUT_DIR");
}

function resolveInspirationInboxDir(): string | undefined {
  return resolveConfiguredPath("OPENCLAW_PROJECTION_INSPIRATION_INBOX_DIR");
}

function parseListValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.flatMap((item) => readString(item) ?? []) : [];
    } catch {
      return trimmed
        .slice(1, -1)
        .split(",")
        .flatMap((item) => readString(item.replace(/^["']|["']$/gu, "")) ?? []);
    }
  }
  return [trimmed];
}

function parseFrontMatterScalar(rawValue: string): unknown {
  const value = rawValue.trim();
  if (value === '""') {
    return "";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return parseListValue(value);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseFrontMatter(text: string): { frontMatter: FrontMatter; body: string } {
  if (!text.startsWith("---")) {
    return { frontMatter: {}, body: text };
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) {
    return { frontMatter: {}, body: text };
  }
  const raw = text.slice(3, end);
  const body = text.slice(end + "\n---".length).replace(/^\s*\r?\n/u, "");
  const frontMatter: FrontMatter = {};
  for (const line of raw.split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z0-9_-]+):\s*(.*?)\s*$/u.exec(line);
    if (!match) {
      continue;
    }
    frontMatter[match[1] ?? ""] = parseFrontMatterScalar(match[2] ?? "");
  }
  return { frontMatter, body };
}

function extractJsonEvidence(body: string): unknown {
  const match = /```json\s*([\s\S]*?)```/u.exec(body);
  if (!match?.[1] || match[1].length > MAX_CARD_BYTES) {
    return undefined;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

function parseSourceRefs(value: unknown): ProjectionReviewSourceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    return [
      {
        source: readString(entry.source),
        topic: readString(entry.topic),
        title: readString(entry.title),
        url: readString(entry.url),
        when: readString(entry.when),
      },
    ];
  });
}

function parseSpark(evidence: unknown): ProjectionReviewSpark | undefined {
  if (!isRecord(evidence) || !isRecord(evidence.projection_spark)) {
    return undefined;
  }
  const spark = evidence.projection_spark;
  const scores = isRecord(spark.scores) ? spark.scores : {};
  const scoreValue = scores.spark_score;
  const score =
    typeof scoreValue === "number" && Number.isFinite(scoreValue) ? scoreValue : undefined;
  return {
    title: readString(spark.title),
    spark: readString(spark.spark),
    why: readString(spark.why_you_might_care),
    transferPattern: readString(spark.transfer_pattern),
    smallExperiment: readString(spark.small_experiment),
    doNotDoYet: readString(spark.do_not_do_yet),
    ...(score === undefined ? {} : { score }),
    sourceRefs: parseSourceRefs(spark.source_refs),
  };
}

async function readProjectionCard(filePath: string): Promise<ProjectionReviewCard | null> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > MAX_CARD_BYTES) {
    return null;
  }
  const text = await fs.readFile(filePath, "utf8");
  const { frontMatter, body } = parseFrontMatter(text);
  const id = readString(frontMatter.card_id);
  if (!id) {
    return null;
  }
  const evidence = extractJsonEvidence(body);
  const bodyPreview =
    body.length <= MAX_BODY_PREVIEW_CHARS
      ? body
      : `${body.slice(0, MAX_BODY_PREVIEW_CHARS).trimEnd()}\n...`;
  return {
    id,
    kind: readString(frontMatter.kind) ?? "review",
    status: readString(frontMatter.status) ?? "pending",
    title: readString(frontMatter.title) ?? id,
    summary: readString(frontMatter.summary) ?? "",
    createdAt: readString(frontMatter.created_at),
    source: readString(frontMatter.source),
    autonomyLevel: readString(frontMatter.autonomy_level),
    signalKey: readString(frontMatter.signal_key),
    actionKey: readString(frontMatter.action_key),
    actionFingerprint: readString(frontMatter.action_fingerprint),
    objectRef: readString(frontMatter.object_ref),
    memoryRefs: Array.isArray(frontMatter.memory_refs)
      ? frontMatter.memory_refs.flatMap((item) => readString(item) ?? [])
      : [],
    path: filePath,
    bodyPreview,
    spark: parseSpark(evidence),
  };
}

async function listProjectionReviewCards(): Promise<ProjectionReviewListResult> {
  const reviewRoot = resolveReviewRoot();
  const pendingDir = path.join(reviewRoot, "pending");
  const scriptPath = resolveProjectionReviewScript();
  const interactionDir = resolveInteractionDir(scriptPath);
  try {
    const entries = await fs.readdir(pendingDir, { withFileTypes: true });
    const mdFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join(pendingDir, entry.name));
    const cards = (await Promise.all(mdFiles.map((file) => readProjectionCard(file)))).flatMap(
      (card) => (card ? [card] : []),
    );
    cards.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
    return {
      enabled: true,
      reviewRoot,
      pending: cards.slice(0, MAX_PENDING_CARDS),
      scriptAvailable: Boolean(scriptPath),
      ...(scriptPath ? { scriptPath } : {}),
      ...(interactionDir ? { interactionDir } : {}),
    };
  } catch (error) {
    const code = isRecord(error) ? readString(error.code) : undefined;
    return {
      enabled: false,
      reviewRoot,
      pending: [],
      scriptAvailable: Boolean(scriptPath),
      ...(scriptPath ? { scriptPath } : {}),
      ...(interactionDir ? { interactionDir } : {}),
      error: code === "ENOENT" ? "projection review queue not found" : String(error),
    };
  }
}

function buildFeedbackText(params: Record<string, unknown>): string | null {
  const raw = readString(params.feedbackText);
  if (!raw) {
    return null;
  }
  return raw.length <= MAX_COMMENT_CHARS ? raw : raw.slice(0, MAX_COMMENT_CHARS);
}

function resolveFeedbackCardId(params: Record<string, unknown>): string | null {
  const cardId = readString(params.cardId);
  if (!cardId || !/^rv_[A-Za-z0-9_-]+$/u.test(cardId)) {
    return null;
  }
  return cardId;
}

async function runProjectionFeedback(params: {
  cardId: string;
  feedbackText: string;
  reviewRoot: string;
  scriptPath: string;
  interactionDir?: string;
  inspirationOutputDir?: string;
  inspirationInboxDir?: string;
}): Promise<unknown> {
  const python = process.env.OPENCLAW_PROJECTION_REVIEW_PYTHON?.trim() || "python";
  const args = [
    params.scriptPath,
    "--review-root",
    params.reviewRoot,
    ...(params.interactionDir ? ["--interaction-dir", params.interactionDir] : []),
    "feedback",
    "--card",
    params.cardId,
    "--text",
    params.feedbackText,
    "--format",
    "json",
    ...(params.inspirationOutputDir
      ? ["--inspiration-output-dir", params.inspirationOutputDir]
      : []),
    ...(params.inspirationInboxDir ? ["--inspiration-inbox-dir", params.inspirationInboxDir] : []),
  ];
  const cwd = path.resolve(path.dirname(params.scriptPath), "..");
  return await new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: existsSync(cwd) ? cwd : process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-MAX_PROCESS_OUTPUT_CHARS);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-MAX_PROCESS_OUTPUT_CHARS);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(compactText(stderr || stdout || `projection review exited ${code}`, 800)));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ output: stdout.trim() });
      }
    });
  });
}

export const projectionReviewHandlers: GatewayRequestHandlers = {
  "projection.review.list": async ({ respond }) => {
    respond(true, await listProjectionReviewCards());
  },
  "projection.review.feedback": async ({ params, respond }) => {
    const cardId = resolveFeedbackCardId(params);
    const feedbackText = buildFeedbackText(params);
    if (!cardId || !feedbackText) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "invalid projection.review.feedback params: cardId and feedbackText required",
        ),
      );
      return;
    }
    const reviewRoot = resolveReviewRoot();
    const scriptPath = resolveProjectionReviewScript();
    if (!scriptPath) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "projection review script not found"),
      );
      return;
    }
    try {
      const interactionDir = resolveInteractionDir(scriptPath);
      const inspirationOutputDir = resolveInspirationOutputDir();
      const inspirationInboxDir = resolveInspirationInboxDir();
      const result = await runProjectionFeedback({
        cardId,
        feedbackText,
        reviewRoot,
        scriptPath,
        interactionDir,
        inspirationOutputDir,
        inspirationInboxDir,
      });
      respond(true, {
        ok: true,
        result,
        review: await listProjectionReviewCards(),
      });
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, String(error)));
    }
  },
};

export const testApi = {
  parseFrontMatter,
  parseSpark,
  listProjectionReviewCards,
};
export { testApi as __test };
