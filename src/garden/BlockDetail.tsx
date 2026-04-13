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
  type LifeStageRecord,
  type Link,
} from "../db";
import { nextReviewPresentation } from "../ui/helpers";
import {
  IconArrowLeft,
  IconTrash,
  IconDrop,
  IconCheckCircle,
  IconNotePencil,
  IconClock,
} from "../ui/Icons";
import styles from "./BlockDetail.module.css";

export function BlockDetail(props: {
  blockId: string;
  onBack: () => void;
  onNavigate: (blockId: string) => void;
  onDeleted: () => void;
  onNote: (blockId: string, displayRef: string) => void;
}) {
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

  createEffect(() => {
    const id = props.blockId;
    setStartTs(Date.now());
    setShowSnooze(false);
    setSnoozeDate("");
    setConfirmDelete(false);

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

  const refreshLifeStage = async () => {
    const ls = await ensureLifeStage(props.blockId);
    setLifeStage(ls);
  };

  const handleDelete = async () => {
    await deleteBlock(props.blockId);
    props.onDeleted();
  };

  const linkedBlockTitle = (link: Link, direction: "from" | "to") => {
    const id = direction === "from" ? link.from_block : link.to_block;
    const blk = linkedBlocks().get(id);
    return blk?.scripture_display_ref ?? blk?.entity_name ?? blk?.content.slice(0, 40) ?? id;
  };

  const handleSnooze = async (days: number) => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    await recordLinger(props.blockId, lingerSec);
    const until = new Date();
    until.setDate(until.getDate() + days);
    await snoozeBlock(props.blockId, until);
    setShowSnooze(false);
    await refreshLifeStage();
  };

  const handleSnoozeDate = async () => {
    const d = snoozeDate();
    if (!d) return;
    const lingerSec = (Date.now() - startTs()) / 1000;
    await recordLinger(props.blockId, lingerSec);
    await snoozeBlock(props.blockId, new Date(d + "T00:00:00"));
    setShowSnooze(false);
    await refreshLifeStage();
  };

  const handleAction = async (action: "water" | "harvest") => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    try {
      await recordLinger(props.blockId, lingerSec);
      if (action === "water") await waterBlock(props.blockId);
      else if (action === "harvest") await harvestBlock(props.blockId);
    } catch {
      /* ignore */
    }
    await refreshLifeStage();
  };

  return (
    <div class={styles.view}>
      <div class={styles.shell}>
        <header class={styles.header}>
          <button
            type="button"
            class={styles.backBtn}
            onClick={props.onBack}
            aria-label="Back"
          >
            <IconArrowLeft size={20} />
          </button>
          <button
            type="button"
            class={styles.deleteBtn}
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete"
          >
            <IconTrash size={18} />
          </button>
        </header>

        <div class={styles.main}>
      <Show when={!loading()} fallback={<p style={{ padding: "40px 0", color: "var(--color-text-tertiary)" }}>Loading...</p>}>
        <Show when={block()} fallback={<p style={{ padding: "40px 0", color: "var(--color-text-tertiary)" }}>Block not found</p>}>
          {(b) => {
            return (
              <div class={styles.body}>
                <Show when={lifeStage()}>
                  {(ls) => {
                    const rhythm = () => nextReviewPresentation(ls().next_watering);
                    return (
                      <p class={styles.rhythmLine}>
                        <span class={styles.rhythmLabel}>{rhythm().heading}</span>{" "}
                        <span class={styles.rhythmDate}>{rhythm().dateMedium}</span>
                      </p>
                    );
                  }}
                </Show>

                <Show when={b().scripture_display_ref}>
                  <h2 class={styles.ref}>{b().scripture_display_ref}</h2>
                  <Show when={b().scripture_translation}>
                    <span class={styles.translation}>{b().scripture_translation}</span>
                  </Show>
                </Show>

                <Show when={b().entity_name}>
                  <h2 class={styles.ref}>{b().entity_name}</h2>
                  <span class={styles.translation}>{b().entity_type}</span>
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

                <Show when={outgoing().length > 0}>
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

                <Show when={backlinks().length > 0}>
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
                    <p class={styles.decisionLabel}>What should happen next?</p>
                    <div class={styles.actions}>
                      <button
                        type="button"
                        class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => handleAction("water")}
                      >
                        <IconDrop size={20} />
                        <span>Review later</span>
                      </button>
                      <button
                        type="button"
                        class={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                        onClick={() => handleAction("harvest")}
                      >
                        <IconCheckCircle size={20} />
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
                        <IconClock size={15} />
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
                            props.onNote(props.blockId, b().scripture_display_ref ?? "")
                          }
                        >
                          <IconNotePencil size={17} />
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
    </div>
  );
}
