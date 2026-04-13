import { createSignal, createEffect, onCleanup, Show, For } from "solid-js";
import {
  getBlock,
  ensureLifeStage,
  getOutgoingLinks,
  getBacklinks,
  deleteBlock,
  waterBlock,
  harvestBlock,
  snoozeBlock,
  recordLinger,
  type Block,
  type LifeStage,
  type LifeStageRecord,
  type Link,
} from "../db";
import {
  formatLingerSeconds,
  formatTimestampMedium,
  nextReviewPresentation,
} from "../ui/helpers";
import {
  IconArrowLeft,
  IconTrash,
  IconInfo,
  IconX,
  IconCheckCircle,
  IconNotePencil,
  IconClock,
  IconLink,
} from "../ui/Icons";
import { IconArrowsClockwise } from "../ui/arrows-clockwise-icon";
import { ICON_PX } from "../ui/icon-sizes";
import shell from "../ui/app-shell.module.css";
import styles from "./PassageView.module.css";

const STAGE_LABEL: Record<LifeStage, string> = {
  seed: "Seed",
  sprout: "Sprout",
  mature: "Mature",
  ember: "Ember",
};

/** One saved item in the garden (scripture, note, entity, …) — DB table is `blocks`. */
export function PassageView(props: {
  passageId: string;
  onBack: () => void;
  onNavigate: (passageId: string) => void;
  onDeleted: () => void;
  onNote: (passageId: string, displayRef: string) => void;
  /** Daily kindling: “n of m” beside next-review date in header; optional if `onKindlingAdvance` is set */
  kindlingProgress?: { index: number; total: number };
  /** After water / harvest / snooze, advance kindling queue (library mode: omit) */
  onKindlingAdvance?: () => void;
}) {
  const isKindling = () => props.onKindlingAdvance != null;
  const [block, setBlock] = createSignal<Block | null>(null);
  const [lifeStage, setLifeStage] = createSignal<LifeStageRecord | null>(null);
  const [outgoing, setOutgoing] = createSignal<Link[]>([]);
  const [backlinks, setBacklinks] = createSignal<Link[]>([]);
  const [linkedBlocks, setLinkedBlocks] = createSignal<Map<string, Block>>(new Map());
  const [loading, setLoading] = createSignal(true);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [startTs, setStartTs] = createSignal(Date.now());
  const [showSnooze, setShowSnooze] = createSignal(false);
  const [snoozeDate, setSnoozeDate] = createSignal("");
  const [showReviewDetails, setShowReviewDetails] = createSignal(false);

  createEffect(() => {
    const id = props.passageId;
    setStartTs(Date.now());
    setShowSnooze(false);
    setSnoozeDate("");
    setConfirmDelete(false);
    setShowReviewDetails(false);

    setLoading(true);
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });

    void (async () => {
      try {
        const b = await getBlock(id);
        if (cancelled) return;
        setBlock(b);
        if (b) {
          const [out, back] = await Promise.all([
            getOutgoingLinks(b.id),
            getBacklinks(b.id),
          ]);
          if (cancelled) return;
          const ls = await ensureLifeStage(b.id);
          if (cancelled) return;
          setLifeStage(ls);
          setOutgoing(out);
          setBacklinks(back);

          const blockMap = new Map<string, Block>();
          const ids = new Set<string>();
          for (const l of [...out, ...back]) {
            ids.add(l.from_block);
            ids.add(l.to_block);
          }
          ids.delete(b.id);
          for (const linkId of ids) {
            const linked = await getBlock(linkId);
            if (cancelled) return;
            if (linked) blockMap.set(linkId, linked);
          }
          if (!cancelled) setLinkedBlocks(blockMap);
        } else {
          setLifeStage(null);
          setOutgoing([]);
          setBacklinks([]);
          setLinkedBlocks(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  });

  createEffect(() => {
    if (!showReviewDetails()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowReviewDetails(false);
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  const refreshLifeStage = async () => {
    const ls = await ensureLifeStage(props.passageId);
    setLifeStage(ls);
  };

  const handleDelete = async () => {
    await deleteBlock(props.passageId);
    props.onDeleted();
  };

  const linkedBlockTitle = (link: Link, direction: "from" | "to") => {
    const id = direction === "from" ? link.from_block : link.to_block;
    const blk = linkedBlocks().get(id);
    return blk?.scripture_display_ref ?? blk?.entity_name ?? blk?.content.slice(0, 40) ?? id;
  };

  const handleSnooze = async (days: number) => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    await recordLinger(props.passageId, lingerSec);
    const until = new Date();
    until.setDate(until.getDate() + days);
    await snoozeBlock(props.passageId, until);
    setShowSnooze(false);
    await refreshLifeStage();
    props.onKindlingAdvance?.();
  };

  const handleSnoozeDate = async () => {
    const d = snoozeDate();
    if (!d) return;
    const lingerSec = (Date.now() - startTs()) / 1000;
    await recordLinger(props.passageId, lingerSec);
    await snoozeBlock(props.passageId, new Date(d + "T00:00:00"));
    setShowSnooze(false);
    await refreshLifeStage();
    props.onKindlingAdvance?.();
  };

  const handleAction = async (action: "water" | "harvest") => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    try {
      await recordLinger(props.passageId, lingerSec);
      if (action === "water") await waterBlock(props.passageId);
      else if (action === "harvest") await harvestBlock(props.passageId);
    } catch {
      /* ignore */
    }
    await refreshLifeStage();
    props.onKindlingAdvance?.();
  };

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={shell.header}>
          <div class={shell.headerLeading}>
            <button
              type="button"
              class={shell.backBtn}
              onClick={props.onBack}
              aria-label="Back"
            >
              <IconArrowLeft size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <div class={styles.blockHeaderCenterInner}>
              <Show
                when={
                  !!block() &&
                  (!!lifeStage() || !!props.kindlingProgress)
                }
              >
                <p class={styles.headerMetaRow}>
                  <Show when={lifeStage()}>
                    {(ls) => (
                      <span class={styles.rhythmDate}>
                        {nextReviewPresentation(ls().next_watering).dateMedium}
                      </span>
                    )}
                  </Show>
                  <Show when={lifeStage() && props.kindlingProgress}>
                    <span class={styles.headerMetaSep} aria-hidden>
                      ·
                    </span>
                  </Show>
                  <Show when={props.kindlingProgress}>
                    {(kp) => (
                      <span class={styles.kindlingStep}>
                        {kp().index + 1} of {kp().total}
                      </span>
                    )}
                  </Show>
                </p>
              </Show>
            </div>
          </div>
          <div class={shell.headerTrailing}>
            <button
              type="button"
              class={styles.infoBtn}
              disabled={loading() || !block()}
              onClick={() => setShowReviewDetails(true)}
              aria-label="Review details"
              title="Review details"
            >
              <IconInfo size={ICON_PX.header} />
            </button>
            <button
              type="button"
              class={styles.deleteBtn}
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete"
            >
              <IconTrash size={ICON_PX.header} />
            </button>
          </div>
        </header>

        <div class={shell.main}>
      <Show when={!loading()} fallback={<p style={{ padding: "40px 0", color: "var(--color-text-tertiary)" }}>Loading...</p>}>
        <Show when={block()} fallback={<p style={{ padding: "40px 0", color: "var(--color-text-tertiary)" }}>Block not found</p>}>
          {(b) => {
            return (
              <div class={shell.shellContent}>
                <div class={styles.readingStack}>
                  <Show when={b().type === "scripture" && b().scripture_display_ref}>
                    <div class={styles.refHead}>
                      <h2 class={styles.ref}>{b().scripture_display_ref}</h2>
                      <Show when={b().scripture_translation}>
                        <span class={styles.translation}>{b().scripture_translation}</span>
                      </Show>
                    </div>
                  </Show>

                  <Show when={b().entity_name}>
                    <div class={styles.refHead}>
                      <h2 class={styles.ref}>{b().entity_name}</h2>
                      <Show when={b().entity_type}>
                        <span class={styles.translation}>{b().entity_type}</span>
                      </Show>
                    </div>
                  </Show>

                  <Show when={b().type === "note"}>
                    <h2 class={styles.ref}>Your Reflection</h2>
                  </Show>

                  <div class={styles.textBlock}>
                    <Show
                      when={b().scripture_verses && b().scripture_verses!.length > 0}
                      fallback={<p>{b().content}</p>}
                    >
                      <For each={b().scripture_verses!}>
                        {(v) => (
                          <p class={styles.verse}>
                            <span class={styles.verseNum}>{v.number}</span>
                            <span class={styles.verseText}>{v.text}</span>
                          </p>
                        )}
                      </For>
                    </Show>
                  </div>

                  <Show
                    when={
                      isKindling() &&
                      (outgoing().length > 0 || backlinks().length > 0)
                    }
                  >
                    <div class={styles.connectionsSection}>
                      <p class={styles.connectionsTitle}>
                        <IconLink size={ICON_PX.compact} /> Connections
                      </p>
                      <div class={styles.connections}>
                        <For each={outgoing()}>
                          {(link) => (
                            <span class={styles.connectionChipStatic}>
                              {linkedBlockTitle(link, "to")}
                            </span>
                          )}
                        </For>
                        <For each={backlinks()}>
                          {(link) => (
                            <span class={styles.connectionChipStatic}>
                              {linkedBlockTitle(link, "from")}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>

                <Show when={!isKindling() && outgoing().length > 0}>
                  <div>
                    <p class={styles.sectionTitle}>Connected</p>
                    <div class={styles.connections}>
                      <For each={outgoing()}>
                        {(link) => (
                          <button
                            type="button"
                            class={styles.connectionChip}
                            onClick={() => props.onNavigate(link.to_block)}
                          >
                            {linkedBlockTitle(link, "to")}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={!isKindling() && backlinks().length > 0}>
                  <div>
                    <p class={styles.sectionTitle}>Referenced by</p>
                    <div class={styles.connections}>
                      <For each={backlinks()}>
                        {(link) => (
                          <button
                            type="button"
                            class={styles.connectionChip}
                            onClick={() => props.onNavigate(link.from_block)}
                          >
                            {linkedBlockTitle(link, "from")}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={lifeStage()}>
                  <div class={styles.decisionPanel}>
                    <div class={styles.actions}>
                      <button
                        type="button"
                        class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => handleAction("water")}
                      >
                                               <span class={styles.decisionArrowsOptical}>
                          <IconArrowsClockwise size={ICON_PX.decisionPanel} />
                        </span>
                        <span>Review later</span>
                      </button>
                      <button
                        type="button"
                        class={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                        onClick={() => handleAction("harvest")}
                      >
                        <IconCheckCircle size={ICON_PX.decisionPanel} />
                        <span>Mastered</span>
                      </button>
                    </div>

                    <div class={styles.tertiaryRow}>
                      <button
                        type="button"
                        class={styles.tertiaryBtn}
                        onClick={() => setShowSnooze(!showSnooze())}
                        aria-expanded={showSnooze()}
                      >
                        <IconClock size={ICON_PX.decisionPanel} />
                        Snooze
                      </button>
                    </div>

                    <Show when={showSnooze()}>
                      <div class={styles.snoozePanel}>
                        <div class={styles.snoozePresets}>
                          <For each={[1, 3, 7, 30]}>
                            {(days) => (
                              <button type="button" class={styles.snoozePreset} onClick={() => handleSnooze(days)}>
                                {days}d
                              </button>
                            )}
                          </For>
                        </div>
                        <div class={styles.snoozeCustom}>
                          <input
                            type="date"
                            class={styles.snoozeInput}
                            value={snoozeDate()}
                            min={new Date().toISOString().split("T")[0]}
                            onInput={(e) => setSnoozeDate(e.currentTarget.value)}
                          />
                          <button
                            type="button"
                            class={styles.snoozePreset}
                            disabled={!snoozeDate()}
                            onClick={handleSnoozeDate}
                          >
                            Go
                          </button>
                        </div>
                      </div>
                    </Show>

                    <Show when={b().scripture_display_ref}>
                      <div class={styles.reflectionBlock}>
                        <button
                          type="button"
                          class={styles.noteBtn}
                          onClick={() =>
                            props.onNote(props.passageId, b().scripture_display_ref ?? "")
                          }
                        >
                          <IconNotePencil size={ICON_PX.decisionPanel} />
                          <span>Add reflection</span>
                        </button>
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={confirmDelete()}>
                  <div class={styles.confirmRow}>
                    <span class={styles.confirmText}>Delete this block?</span>
                    <button type="button" class={styles.confirmNo} onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                    <button type="button" class={styles.confirmYes} onClick={handleDelete}>
                      Delete
                    </button>
                  </div>
                </Show>
              </div>
            );
          }}
        </Show>
      </Show>
        </div>
      </div>

      <Show when={showReviewDetails() && block()}>
        {(b) => (
          <div
            class={styles.reviewDetailsRoot}
            role="presentation"
            onClick={() => setShowReviewDetails(false)}
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
                  onClick={() => setShowReviewDetails(false)}
                  aria-label="Close"
                >
                  <IconX size={ICON_PX.header} />
                </button>
              </div>
              <div class={styles.reviewDetailsList}>
                <div class={styles.reviewDetailRow}>
                  <span class={styles.reviewDetailLabel}>Added</span>
                  <span class={styles.reviewDetailValue}>
                    {formatTimestampMedium(b().captured_at)}
                  </span>
                </div>
                <div class={styles.reviewDetailRow}>
                  <span class={styles.reviewDetailLabel}>Last updated</span>
                  <span class={styles.reviewDetailValue}>
                    {formatTimestampMedium(b().modified_at)}
                  </span>
                </div>
                <Show when={lifeStage()}>
                  {(stage) => (
                    <>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Growth stage</span>
                        <span class={styles.reviewDetailValue}>
                          {STAGE_LABEL[stage().stage]}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Reviews</span>
                        <span class={styles.reviewDetailValue}>
                          {stage().watering_count}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Last review</span>
                        <span class={styles.reviewDetailValue}>
                          {stage().last_watered
                            ? formatTimestampMedium(stage().last_watered)
                            : "—"}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Next opens</span>
                        <span class={styles.reviewDetailValue}>
                          {nextReviewPresentation(stage().next_watering).dateMedium}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Rhythm since</span>
                        <span class={styles.reviewDetailValue}>
                          {formatTimestampMedium(stage().planted_at)}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Time on passage</span>
                        <span class={styles.reviewDetailValue}>
                          {formatLingerSeconds(stage().linger_seconds)}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Reflections added</span>
                        <span class={styles.reviewDetailValue}>
                          {stage().notes_added}
                        </span>
                      </div>
                      <div class={styles.reviewDetailRow}>
                        <span class={styles.reviewDetailLabel}>Connections</span>
                        <span class={styles.reviewDetailValue}>
                          {stage().connections_made}
                        </span>
                      </div>
                    </>
                  )}
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
