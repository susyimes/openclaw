// Control UI controller for the local projection-agent review queue.
import type { GatewayBrowserClient } from "../gateway.ts";

export type ProjectionReviewSourceRef = {
  source?: string;
  topic?: string;
  title?: string;
  url?: string;
  when?: string;
};

export type ProjectionReviewSpark = {
  title?: string;
  spark?: string;
  why?: string;
  transferPattern?: string;
  smallExperiment?: string;
  doNotDoYet?: string;
  score?: number;
  sourceRefs: ProjectionReviewSourceRef[];
};

export type ProjectionReviewCard = {
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

export type ProjectionReviewListResult = {
  enabled: boolean;
  reviewRoot: string;
  pending: ProjectionReviewCard[];
  scriptAvailable: boolean;
  scriptPath?: string;
  interactionDir?: string;
  error?: string;
};

export type ProjectionReviewState = {
  client: GatewayBrowserClient | null;
  projectionReviewLoading: boolean;
  projectionReviewResult: ProjectionReviewListResult | null;
  projectionReviewError: string | null;
  reviewFeedbackBusyId: string | null;
  reviewFeedbackMessage: { kind: "success" | "error"; text: string } | null;
  reviewCommentDrafts: Record<string, string>;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadProjectionReview(state: ProjectionReviewState): Promise<void> {
  const client = state.client;
  if (!client) {
    return;
  }
  state.projectionReviewLoading = true;
  state.projectionReviewError = null;
  try {
    state.projectionReviewResult = await client.request<ProjectionReviewListResult>(
      "projection.review.list",
      {},
    );
  } catch (error) {
    state.projectionReviewError = errorText(error);
  } finally {
    state.projectionReviewLoading = false;
  }
}

export function buildProjectionFeedbackText(params: {
  phrase?: string;
  score?: number;
  comment?: string;
}): string {
  const parts: string[] = [];
  if (params.phrase?.trim()) {
    parts.push(params.phrase.trim());
  }
  if (params.score) {
    parts.push(`score: ${params.score}`);
  }
  if (params.comment?.trim()) {
    parts.push(`comment: ${params.comment.trim()}`);
  }
  return parts.join("\n");
}

export async function sendProjectionReviewFeedback(
  state: ProjectionReviewState,
  params: { cardId: string; feedbackText: string; commentId: string },
): Promise<void> {
  const client = state.client;
  if (!client || state.reviewFeedbackBusyId) {
    return;
  }
  state.reviewFeedbackBusyId = params.commentId;
  state.reviewFeedbackMessage = null;
  try {
    const response = await client.request<{ review?: ProjectionReviewListResult }>(
      "projection.review.feedback",
      {
        cardId: params.cardId,
        feedbackText: params.feedbackText,
      },
    );
    if (response.review) {
      state.projectionReviewResult = response.review;
    } else {
      await loadProjectionReview(state);
    }
    state.reviewCommentDrafts = {
      ...state.reviewCommentDrafts,
      [params.commentId]: "",
    };
    state.reviewFeedbackMessage = {
      kind: "success",
      text: "Projection feedback recorded.",
    };
  } catch (error) {
    state.reviewFeedbackMessage = {
      kind: "error",
      text: `Projection feedback failed: ${errorText(error)}`,
    };
  } finally {
    state.reviewFeedbackBusyId = null;
  }
}
