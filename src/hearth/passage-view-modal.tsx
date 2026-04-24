import type { JSX } from "solid-js";
import type { Block, LifeStageRecord } from "../db/types";
import { formatTimestampMedium, nextReviewPresentation } from "../ui/helpers";
import { IconTrash, IconX } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import { PASSAGE_STAGE_LABEL } from "./passage-stage-labels";
import styles from "./PassageView.module.css";
import { hapticLight } from "../haptics";

export function PassageReviewDetailsModal(props: {
  block: Block;
  lifeStage: LifeStageRecord | null;
  onClose: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <div
      class={styles.reviewDetailsRoot}
      role="presentation"
      onClick={() => {
        hapticLight();
        props.onClose();
      }}
    >
      <div
        class={styles.reviewDetailsPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div class={styles.reviewDetailsHeader}>
          <h2 id="review-details-title" class={styles.reviewDetailsTitle}>
            Review details
          </h2>
          <button
            type="button"
            class={styles.reviewDetailsClose}
            onClick={() => {
              hapticLight();
              props.onClose();
            }}
            aria-label="Close"
          >
            <IconX size={ICON_PX.header} />
          </button>
        </div>
        <div class={styles.reviewDetailsDivider} aria-hidden="true" />
        <div class={styles.reviewDetailsList}>
          <ReviewDetailRow label="Added" value={formatTimestampMedium(props.block.captured_at)} />
          <ReviewDetailRow label="Last updated" value={formatTimestampMedium(props.block.modified_at)} />
          {props.lifeStage && <ReviewStageRows stage={props.lifeStage} />}
        </div>
        <div class={styles.reviewDetailsFooter}>
          <button
            type="button"
            class={styles.reviewDetailsDeleteBtn}
            onClick={() => {
              hapticLight();
              props.onDelete();
            }}
          >
            <IconTrash size={ICON_PX.compact} />
            Delete passage
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewDetailRow(props: { label: string; value: string }): JSX.Element {
  return (
    <div class={styles.reviewDetailRow}>
      <span class={styles.reviewDetailLabel}>{props.label}</span>
      <span class={styles.reviewDetailValue}>{props.value}</span>
    </div>
  );
}

function ReviewStageRows(props: { stage: LifeStageRecord }): JSX.Element {
  const s = props.stage;
  const hasBeenReviewed = s.review_count > 0;
  const nextReview = nextReviewPresentation(s.next_review_at);
  
  return (
    <>
      <ReviewDetailRow label="Flame stage" value={PASSAGE_STAGE_LABEL[s.stage]} />
      <ReviewDetailRow 
        label="Reviews" 
        value={hasBeenReviewed ? String(s.review_count) : "None yet"} 
      />
      <ReviewDetailRow
        label="Last review"
        value={s.last_reviewed ? formatTimestampMedium(s.last_reviewed) : "Never reviewed"}
      />
      <ReviewDetailRow
        label="Next opens"
        value={hasBeenReviewed ? nextReview.dateMedium : "Now (ready for first review)"}
      />
      <ReviewDetailRow label="Kindled" value={formatTimestampMedium(s.kindled_at)} />
      <ReviewDetailRow 
        label="Time on passage" 
        value={formatLingerSecondsHuman(s.linger_seconds)} 
      />
      <ReviewDetailRow 
        label="Reflections added" 
        value={s.notes_added > 0 ? String(s.notes_added) : "None yet"} 
      />
      <ReviewDetailRow 
        label="Connections" 
        value={s.connections_made > 0 ? String(s.connections_made) : "None yet"} 
      />
    </>
  );
}

function formatLingerSecondsHuman(totalSeconds: number): string {
  if (totalSeconds === 0) return "Not yet spent";
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return remainingMinutes === 1 ? "1 minute" : `${remainingMinutes} minutes`;
  }
  if (remainingMinutes === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${hours}h ${remainingMinutes}m`;
}
