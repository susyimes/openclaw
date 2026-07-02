/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import type { EventLogEntry } from "../app-events.ts";
import type { ExecApprovalRequest } from "../controllers/exec-approval.ts";
import type {
  ProjectionReviewCard,
  ProjectionReviewListResult,
} from "../controllers/projection-review.ts";
import { renderReview, type ReviewProps } from "./review.ts";

function approval(overrides: Partial<ExecApprovalRequest> = {}): ExecApprovalRequest {
  return {
    id: "approval-1",
    kind: "exec",
    request: {
      command: "pnpm test",
      cwd: "D:\\openclaw",
      agentId: "projection-agent",
      allowedDecisions: ["allow-once", "deny"],
    },
    createdAtMs: 1_000,
    expiresAtMs: Date.now() + 60_000,
    ...overrides,
  };
}

function event(overrides: Partial<EventLogEntry> = {}): EventLogEntry {
  return {
    ts: 2_000,
    event: "system-event",
    payload: { text: "drafted a next action" },
    ...overrides,
  };
}

function projectionCard(overrides: Partial<ProjectionReviewCard> = {}): ProjectionReviewCard {
  return {
    id: "rv_20260702_161337_baab3136",
    kind: "projection_spark",
    status: "pending",
    title: "spark: benchmark acceptance check",
    summary: "score=62; turn benchmark ideas into acceptance checks.",
    createdAt: "2026-07-02T16:13:37+00:00",
    source: "projection-agent",
    autonomyLevel: "L2",
    signalKey: "projection_spark:llm_agents",
    actionKey: "abc123",
    actionFingerprint: "abc123",
    objectRef: "http://example.test/paper",
    memoryRefs: [],
    path: "D:\\atprojection-agent\\review\\pending\\card.md",
    bodyPreview: "# spark",
    spark: {
      title: "benchmark acceptance check",
      spark: "Turn benchmark ideas into local acceptance checks.",
      smallExperiment: "Generate pass/fail acceptance text.",
      transferPattern: "external evaluator -> local acceptance check",
      score: 62,
      sourceRefs: [],
    },
    ...overrides,
  };
}

function projectionResult(
  overrides: Partial<ProjectionReviewListResult> = {},
): ProjectionReviewListResult {
  return {
    enabled: true,
    reviewRoot: "D:\\atprojection-agent\\review",
    pending: [projectionCard()],
    scriptAvailable: true,
    ...overrides,
  };
}

function props(overrides: Partial<ReviewProps> = {}): ReviewProps {
  return {
    approvals: [approval()],
    events: [event()],
    projection: projectionResult(),
    projectionLoading: false,
    projectionError: null,
    comments: {},
    approvalBusy: false,
    feedbackBusyId: null,
    feedbackMessage: null,
    onRefreshApprovals: vi.fn(),
    onRefreshProjection: vi.fn(),
    onApprovalDecision: vi.fn(),
    onCommentChange: vi.fn(),
    onFeedback: vi.fn(),
    onProjectionFeedback: vi.fn(),
    ...overrides,
  };
}

function buttonByText(container: Element, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (entry) => entry.textContent?.trim() === label,
  );
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

describe("renderReview", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    await i18n.setLocale("en");
  });

  it("renders inline approvals and resolves an approval decision", () => {
    const container = document.createElement("div");
    const onApprovalDecision = vi.fn();

    render(renderReview(props({ onApprovalDecision })), container);
    buttonByText(container, "Approve once").click();

    expect(container.textContent).toContain("Pending approvals");
    expect(container.textContent).toContain("pnpm test");
    expect(onApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({ id: "approval-1" }),
      "allow-once",
    );
  });

  it("sends event feedback with the current comment text", () => {
    const container = document.createElement("div");
    const onCommentChange = vi.fn();
    const onFeedback = vi.fn();

    render(
      renderReview(
        props({
          approvals: [],
          projection: projectionResult({ pending: [] }),
          onCommentChange,
          onFeedback,
        }),
      ),
      container,
    );

    const textarea = container.querySelector<HTMLTextAreaElement>(".review-comment");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    textarea!.value = "ask before touching memory";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    buttonByText(container, "Ask first").click();

    expect(onCommentChange).toHaveBeenCalledWith(
      "event:system-event:2000:0",
      "ask before touching memory",
    );
    expect(onFeedback).toHaveBeenCalledWith(
      {
        kind: "event",
        id: "system-event:2000:0",
        title: "system-event",
      },
      "ask_first",
      "ask before touching memory",
    );
  });

  it("sends projection score and spark action feedback with comments", () => {
    const container = document.createElement("div");
    const onProjectionFeedback = vi.fn();

    render(
      renderReview(
        props({
          approvals: [],
          events: [],
          onProjectionFeedback,
        }),
      ),
      container,
    );

    const textarea = container.querySelector<HTMLTextAreaElement>(
      ".review-card--projection .review-comment",
    );
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    textarea!.value = "this is worth pursuing";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    buttonByText(container, "5").click();
    buttonByText(container, "Research brief").click();

    expect(container.textContent).toContain("Projection review");
    expect(container.textContent).toContain("spark: benchmark acceptance check");
    expect(onProjectionFeedback).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "rv_20260702_161337_baab3136" }),
      { score: 5 },
      "this is worth pursuing",
      "projection:rv_20260702_161337_baab3136",
    );
    expect(onProjectionFeedback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "rv_20260702_161337_baab3136" }),
      { phrase: "转 Research Brief" },
      "this is worth pursuing",
      "projection:rv_20260702_161337_baab3136",
    );
  });
});
