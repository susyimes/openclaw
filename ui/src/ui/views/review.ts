// Control UI view renders the non-modal review queue for scoring and approvals.
import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { EventLogEntry } from "../app-events.ts";
import type { ExecApprovalDecision, ExecApprovalRequest } from "../controllers/exec-approval.ts";
import type {
  ProjectionReviewCard,
  ProjectionReviewListResult,
} from "../controllers/projection-review.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";

type ReviewFeedbackKind = "good" | "too_noisy" | "ask_first" | "act_next_time" | "bad_memory";

export type ReviewProps = {
  approvals: ExecApprovalRequest[];
  events: EventLogEntry[];
  projection: ProjectionReviewListResult | null;
  projectionLoading: boolean;
  projectionError: string | null;
  comments: Record<string, string>;
  approvalBusy: boolean;
  feedbackBusyId: string | null;
  feedbackMessage: { kind: "success" | "error"; text: string } | null;
  onRefreshApprovals: () => void;
  onRefreshProjection: () => void;
  onApprovalDecision: (entry: ExecApprovalRequest, decision: ExecApprovalDecision) => void;
  onCommentChange: (id: string, comment: string) => void;
  onFeedback: (target: ReviewFeedbackTarget, feedback: ReviewFeedbackKind, comment: string) => void;
  onProjectionFeedback: (
    card: ProjectionReviewCard,
    feedback: { phrase?: string; score?: number },
    comment: string,
    commentId: string,
  ) => void;
};

export type ReviewFeedbackTarget =
  | {
      kind: "approval";
      id: string;
      title: string;
    }
  | {
      kind: "event";
      id: string;
      title: string;
    };

const FEEDBACK_ACTIONS: ReviewFeedbackKind[] = [
  "good",
  "too_noisy",
  "ask_first",
  "act_next_time",
  "bad_memory",
];

const SCORE_VALUES = [1, 2, 3, 4, 5] as const;

const SPARK_ACTIONS: Array<{ phrase: string; labelKey: string }> = [
  { phrase: "转 Research Brief", labelKey: "review.feedbackActions.promoteResearch" },
  { phrase: "做小实验", labelKey: "review.feedbackActions.experimentNext" },
  { phrase: "这个方向继续", labelKey: "review.feedbackActions.continueDirection" },
  { phrase: "太远", labelKey: "review.feedbackActions.tooFar" },
];

function stringifyPayload(payload: unknown): string {
  if (payload == null) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function approvalTitle(entry: ExecApprovalRequest): string {
  if (entry.kind === "plugin") {
    return entry.pluginTitle ?? entry.request.command;
  }
  return entry.request.command;
}

function eventTitle(entry: EventLogEntry): string {
  return entry.event || "event";
}

function formatCardTime(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? formatRelativeTimestamp(ms) : value;
}

function feedbackLabel(kind: ReviewFeedbackKind): string {
  switch (kind) {
    case "good":
      return t("review.feedbackActions.good");
    case "too_noisy":
      return t("review.feedbackActions.noisy");
    case "ask_first":
      return t("review.feedbackActions.ask");
    case "act_next_time":
      return t("review.feedbackActions.act");
    case "bad_memory":
      return t("review.feedbackActions.badMemory");
  }
}

function canAlwaysApprove(entry: ExecApprovalRequest): boolean {
  return entry.request.allowedDecisions?.includes("allow-always") ?? entry.kind !== "exec";
}

function renderFeedbackButtons(
  props: ReviewProps,
  target: ReviewFeedbackTarget,
  commentId: string,
) {
  const comment = props.comments[commentId] ?? "";
  return html`
    <div class="review-feedback">
      <textarea
        class="review-comment"
        rows="2"
        placeholder=${t("review.commentPlaceholder")}
        .value=${comment}
        @input=${(event: Event) =>
          props.onCommentChange(commentId, (event.target as HTMLTextAreaElement).value)}
      ></textarea>
      <div class="review-feedback__actions">
        ${FEEDBACK_ACTIONS.map(
          (kind) => html`
            <button
              type="button"
              class="btn btn--sm"
              ?disabled=${props.feedbackBusyId === commentId}
              @click=${(event: Event) => {
                const feedback = (event.currentTarget as HTMLElement).closest(".review-feedback");
                const currentComment =
                  feedback?.querySelector<HTMLTextAreaElement>(".review-comment")?.value ?? comment;
                props.onFeedback(target, kind, currentComment);
              }}
            >
              ${feedbackLabel(kind)}
            </button>
          `,
        )}
      </div>
    </div>
  `;
}

function currentComment(props: ReviewProps, root: Element | null, commentId: string): string {
  return (
    root?.querySelector<HTMLTextAreaElement>(".review-comment")?.value ??
    props.comments[commentId] ??
    ""
  );
}

function renderProjectionCard(props: ReviewProps, card: ProjectionReviewCard) {
  const commentId = `projection:${card.id}`;
  const comment = props.comments[commentId] ?? "";
  const created = formatCardTime(card.createdAt);
  const spark = card.spark;
  const busy = props.feedbackBusyId === commentId;
  return html`
    <article class="review-card review-card--projection">
      <div class="review-card__header">
        <div class="review-card__title">
          <span class="review-card__icon" aria-hidden="true">${icons.zap}</span>
          <span>${card.title}</span>
        </div>
        <span class="review-pill">${card.kind}</span>
      </div>
      <div class="review-card__meta">
        ${created ? html`<span>${t("review.created", { time: created })}</span>` : nothing}
        ${card.autonomyLevel ? html`<span>${card.autonomyLevel}</span>` : nothing}
        ${spark?.score !== undefined
          ? html`<span>${t("review.sparkScore", { score: String(spark.score) })}</span>`
          : nothing}
        ${card.objectRef ? html`<span>${card.objectRef}</span>` : nothing}
      </div>
      ${card.summary ? html`<p class="review-card__summary">${card.summary}</p>` : nothing}
      ${spark
        ? html`
            <div class="review-spark">
              ${spark.spark ? html`<p>${spark.spark}</p>` : nothing}
              ${spark.smallExperiment
                ? html`<p>
                    <strong>${t("review.feedbackActions.experimentNext")}:</strong>
                    ${spark.smallExperiment}
                  </p>`
                : nothing}
              ${spark.transferPattern
                ? html`<p><strong>Pattern:</strong> ${spark.transferPattern}</p>`
                : nothing}
            </div>
          `
        : html`<pre class="review-card__body">${card.bodyPreview}</pre>`}
      <div class="review-feedback">
        <textarea
          class="review-comment"
          rows="2"
          placeholder=${t("review.commentPlaceholder")}
          .value=${comment}
          @input=${(event: Event) =>
            props.onCommentChange(commentId, (event.target as HTMLTextAreaElement).value)}
        ></textarea>
        <div class="review-score-row" aria-label=${t("review.scoreLabel")}>
          ${SCORE_VALUES.map(
            (score) => html`
              <button
                type="button"
                class="btn btn--sm review-score-button"
                title=${`${t("review.scoreLabel")} ${score}`}
                ?disabled=${busy}
                @click=${(event: Event) => {
                  const root = (event.currentTarget as HTMLElement).closest(".review-feedback");
                  props.onProjectionFeedback(
                    card,
                    { score },
                    currentComment(props, root, commentId),
                    commentId,
                  );
                }}
              >
                ${score}
              </button>
            `,
          )}
        </div>
        <div class="review-feedback__actions">
          ${FEEDBACK_ACTIONS.map(
            (kind) => html`
              <button
                type="button"
                class="btn btn--sm"
                ?disabled=${busy}
                @click=${(event: Event) => {
                  const root = (event.currentTarget as HTMLElement).closest(".review-feedback");
                  props.onProjectionFeedback(
                    card,
                    { phrase: feedbackLabel(kind) },
                    currentComment(props, root, commentId),
                    commentId,
                  );
                }}
              >
                ${feedbackLabel(kind)}
              </button>
            `,
          )}
          ${card.kind === "projection_spark"
            ? SPARK_ACTIONS.map(
                (action) => html`
                  <button
                    type="button"
                    class="btn btn--sm"
                    ?disabled=${busy}
                    @click=${(event: Event) => {
                      const root = (event.currentTarget as HTMLElement).closest(".review-feedback");
                      props.onProjectionFeedback(
                        card,
                        { phrase: action.phrase },
                        currentComment(props, root, commentId),
                        commentId,
                      );
                    }}
                  >
                    ${t(action.labelKey)}
                  </button>
                `,
              )
            : nothing}
        </div>
      </div>
    </article>
  `;
}

function renderApproval(props: ReviewProps, entry: ExecApprovalRequest) {
  const title = approvalTitle(entry);
  const remaining = formatRelativeTimestamp(entry.expiresAtMs);
  const commentId = `approval:${entry.id}`;
  const target = {
    kind: "approval" as const,
    id: entry.id,
    title,
  };
  return html`
    <article class="review-card review-card--approval">
      <div class="review-card__header">
        <div class="review-card__title">
          <span class="review-card__icon" aria-hidden="true">${icons.check}</span>
          <span>${title}</span>
        </div>
        <span class="review-pill">${entry.kind}</span>
      </div>
      <div class="review-card__meta">
        <span>${t("review.expires", { time: remaining })}</span>
        ${entry.request.agentId ? html`<span>${entry.request.agentId}</span>` : nothing}
        ${entry.request.sessionKey ? html`<span>${entry.request.sessionKey}</span>` : nothing}
      </div>
      ${entry.kind === "plugin" && entry.pluginDescription
        ? html`<pre class="review-card__body">${entry.pluginDescription}</pre>`
        : html`<pre class="review-card__body">${entry.request.command}</pre>`}
      <div class="review-actions">
        <button
          type="button"
          class="btn primary"
          ?disabled=${props.approvalBusy}
          @click=${() => props.onApprovalDecision(entry, "allow-once")}
        >
          ${t("review.approveOnce")}
        </button>
        ${canAlwaysApprove(entry)
          ? html`
              <button
                type="button"
                class="btn"
                ?disabled=${props.approvalBusy}
                @click=${() => props.onApprovalDecision(entry, "allow-always")}
              >
                ${t("review.approveAlways")}
              </button>
            `
          : nothing}
        <button
          type="button"
          class="btn danger"
          ?disabled=${props.approvalBusy}
          @click=${() => props.onApprovalDecision(entry, "deny")}
        >
          ${t("review.deny")}
        </button>
      </div>
      ${renderFeedbackButtons(props, target, commentId)}
    </article>
  `;
}

function renderEvent(props: ReviewProps, entry: EventLogEntry, index: number) {
  const id = `${entry.event}:${entry.ts}:${index}`;
  const commentId = `event:${id}`;
  const payload = stringifyPayload(entry.payload);
  const target = {
    kind: "event" as const,
    id,
    title: eventTitle(entry),
  };
  return html`
    <article class="review-card">
      <div class="review-card__header">
        <div class="review-card__title">
          <span class="review-card__icon" aria-hidden="true">${icons.activity}</span>
          <span>${eventTitle(entry)}</span>
        </div>
        <span class="review-pill">${formatRelativeTimestamp(entry.ts)}</span>
      </div>
      ${payload ? html`<pre class="review-card__body">${payload}</pre>` : nothing}
      ${renderFeedbackButtons(props, target, commentId)}
    </article>
  `;
}

export function renderReview(props: ReviewProps) {
  const visibleEvents = props.events.slice(-30).reverse();
  const projectionCards = props.projection?.pending ?? [];
  const projectionError = props.projectionError ?? props.projection?.error ?? null;
  return html`
    <section class="review-page" aria-label=${t("review.title")}>
      <header class="review-header">
        <div>
          <h2>${t("review.title")}</h2>
          <p>${t("review.subtitle")}</p>
        </div>
        <button type="button" class="btn" @click=${props.onRefreshApprovals}>
          ${t("review.refresh")}
        </button>
      </header>

      ${props.feedbackMessage
        ? html`<div class="review-message review-message--${props.feedbackMessage.kind}">
            ${props.feedbackMessage.text}
          </div>`
        : nothing}

      <div class="review-grid">
        <section class="review-column">
          <div class="review-column__header">
            <div>
              <h3>${t("review.pendingApprovals")}</h3>
              <p>${t("review.pendingApprovalsSubtitle")}</p>
            </div>
            <span>${t("review.visibleCount", { count: String(props.approvals.length) })}</span>
          </div>
          <div class="review-list">
            ${props.approvals.length === 0
              ? html`<div class="review-empty">${t("review.noApprovals")}</div>`
              : props.approvals.map((entry) => renderApproval(props, entry))}
          </div>
        </section>

        <section class="review-column review-column--projection">
          <div class="review-column__header">
            <div>
              <h3>${t("review.projectionCards")}</h3>
              <p>${t("review.projectionCardsSubtitle")}</p>
            </div>
            <span>${t("review.visibleCount", { count: String(projectionCards.length) })}</span>
          </div>
          <div class="review-list">
            ${projectionError
              ? html`<div class="review-empty">
                  ${t("review.projectionUnavailable")} ${projectionError}
                </div>`
              : props.projectionLoading
                ? html`<div class="review-empty">${t("common.loading")}</div>`
                : projectionCards.length === 0
                  ? html`<div class="review-empty">${t("review.noProjectionCards")}</div>`
                  : projectionCards.map((card) => renderProjectionCard(props, card))}
          </div>
        </section>

        <section class="review-column review-column--events">
          <div class="review-column__header">
            <div>
              <h3>${t("review.scoring")}</h3>
              <p>${t("review.scoringSubtitle")}</p>
            </div>
            <span>${t("review.visibleCount", { count: String(visibleEvents.length) })}</span>
          </div>
          <div class="review-list">
            ${visibleEvents.length === 0
              ? html`<div class="review-empty">${t("review.noEvents")}</div>`
              : visibleEvents.map((entry, index) => renderEvent(props, entry, index))}
          </div>
        </section>
      </div>
    </section>
  `;
}
