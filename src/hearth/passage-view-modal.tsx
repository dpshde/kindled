import type { JSX } from "solid-js";
import type { Block, LifeStageRecord } from "../db/types";
import { formatLingerSeconds, formatTimestampMedium, nextReviewPresentation } from "../ui/helpers";
import { IconX } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import { PASSAGE_STAGE_LABEL } from "./passage-stage-labels";
import styles from "./PassageView.module.css";
import { hapticLight } from "../haptics";

export function PassageReviewDetailsModal(props: {
  block: Block;
  lifeStage: LifeStageRecord | null;
  onClose: () => void;
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
  return (
    <>
      <ReviewDetailRow label="Flame stage" value={PASSAGE_STAGE_LABEL[s.stage]} />
      <ReviewDetailRow label="Reviews" value={String(s.review_count)} />
      <ReviewDetailRow
        label="Last review"
        value={s.last_reviewed ? formatTimestampMedium(s.last_reviewed) : "—"}
      />
      <ReviewDetailRow
        label="Next opens"
        value={nextReviewPresentation(s.next_review_at).dateMedium}
      />
      <ReviewDetailRow label="Kindled" value={formatTimestampMedium(s.kindled_at)} />
      <ReviewDetailRow label="Time on passage" value={formatLingerSeconds(s.linger_seconds)} />
      <ReviewDetailRow label="Reflections added" value={String(s.notes_added)} />
      <ReviewDetailRow label="Connections" value={String(s.connections_made)} />
    </>
  );
}
