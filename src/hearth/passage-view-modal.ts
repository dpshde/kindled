import { html, type ArrowTemplate } from "@arrow-js/core";
import type { Block, LifeStageRecord } from "../db/types";
import { formatLingerSeconds, formatTimestampMedium, nextReviewPresentation } from "../ui/helpers";
import { IconX } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import { PASSAGE_STAGE_LABEL } from "./passage-stage-labels";
import styles from "./PassageView.module.css";
import { hapticTrigger } from "../haptics";

export function passageReviewDetailsModal(
  show: boolean,
  block: Block | null,
  lifeStage: LifeStageRecord | null,
  onClose: () => void,
): ArrowTemplate {
  if (!show || !block) return html``;
  return html`<div
    class="${styles.reviewDetailsRoot}"
    role="presentation"
    @click="${() => {
      hapticTrigger();
      onClose();
    }}"
  >
    <div
      class="${styles.reviewDetailsPanel}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-details-title"
      @click="${(e: Event) => e.stopPropagation()}"
    >
      <div class="${styles.reviewDetailsHeader}">
        <h2 id="review-details-title" class="${styles.reviewDetailsTitle}">Review details</h2>
        <button
          type="button"
          class="${styles.reviewDetailsClose}"
          @click="${() => {
            hapticTrigger();
            onClose();
          }}"
          aria-label="Close"
        >
          ${IconX({ size: ICON_PX.header })}
        </button>
      </div>
      <div class="${styles.reviewDetailsList}">
        ${reviewDetailRow("Added", formatTimestampMedium(block.captured_at))}
        ${reviewDetailRow("Last updated", formatTimestampMedium(block.modified_at))}
        ${lifeStage ? reviewStageRows(lifeStage) : html``}
      </div>
    </div>
  </div>`;
}

function reviewDetailRow(label: string, value: string): ArrowTemplate {
  return html`<div class="${styles.reviewDetailRow}">
    <span class="${styles.reviewDetailLabel}">${label}</span>
    <span class="${styles.reviewDetailValue}">${value}</span>
  </div>`;
}

function reviewStageRows(stage: LifeStageRecord): ArrowTemplate {
  return html`${reviewDetailRow("Flame stage", PASSAGE_STAGE_LABEL[stage.stage])}
    ${reviewDetailRow("Reviews", String(stage.review_count))}
    ${reviewDetailRow(
      "Last review",
      stage.last_reviewed ? formatTimestampMedium(stage.last_reviewed) : "—",
    )}
    ${reviewDetailRow(
      "Next opens",
      nextReviewPresentation(stage.next_review_at).dateMedium,
    )}
    ${reviewDetailRow("Kindled", formatTimestampMedium(stage.kindled_at))}
    ${reviewDetailRow("Time on passage", formatLingerSeconds(stage.linger_seconds))}
    ${reviewDetailRow("Reflections added", String(stage.notes_added))}
    ${reviewDetailRow("Connections", String(stage.connections_made))}`;
}
