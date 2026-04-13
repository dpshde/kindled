import { createSignal, onMount, Show, For } from "solid-js";
import {
  getBlock,
  getLifeStage,
  waterBlock,
  transplantBlock,
  harvestBlock,
  emberBlock,
  snoozeBlock,
  recordLinger,
  getOutgoingLinks,
  getBacklinks,
  type Block,
  type LifeStageRecord,
  type LifeStage,
  type Link,
} from "../db";
import { stageColor } from "../ui/helpers";
import {
  IconDrop,
  IconArrowUp,
  IconCheckCircle,
  IconX,
  IconNotePencil,
  IconSeedling,
  IconTree,
  IconLeaf,
  IconFire,
  IconClock,
  IconLink,
} from "../ui/Icons";
import styles from "./PassageView.module.css";

const STAGE_ICON: Record<LifeStage, typeof IconSeedling> = {
  seed: IconSeedling,
  sprout: IconTree,
  mature: IconLeaf,
  ember: IconFire,
};

export function PassageView(props: {
  blockId: string;
  index: number;
  total: number;
  onAction: (blockId: string, action: "water" | "transplant" | "harvest") => void;
  onNote: (blockId: string, displayRef: string) => void;
  onBack: () => void;
}) {
  const [block, setBlock] = createSignal<Block | null>(null);
  const [lifeStage, setLifeStage] = createSignal<LifeStageRecord | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [startTs] = createSignal(Date.now());
  const [showSnooze, setShowSnooze] = createSignal(false);
  const [snoozeDate, setSnoozeDate] = createSignal("");
  const [outgoing, setOutgoing] = createSignal<Link[]>([]);
  const [backlinks, setBacklinks] = createSignal<Link[]>([]);
  const [linkedBlocks, setLinkedBlocks] = createSignal<Map<string, Block>>(new Map());

  onMount(async () => {
    try {
      const b = await getBlock(props.blockId);
      setBlock(b);
      if (b) {
        const [ls, out, back] = await Promise.all([
          getLifeStage(b.id),
          getOutgoingLinks(b.id),
          getBacklinks(b.id),
        ]);
        setLifeStage(ls);
        setOutgoing(out);
        setBacklinks(back);

        const blockMap = new Map<string, Block>();
        const ids = new Set<string>();
        for (const l of [...out, ...back]) { ids.add(l.from_block); ids.add(l.to_block); }
        ids.delete(b.id);
        for (const id of ids) {
          const linked = await getBlock(id);
          if (linked) blockMap.set(id, linked);
        }
        setLinkedBlocks(blockMap);
      }
    } finally {
      setLoading(false);
    }
  });

  const handleSnooze = async (days: number) => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    await recordLinger(props.blockId, lingerSec);
    const until = new Date();
    until.setDate(until.getDate() + days);
    await snoozeBlock(props.blockId, until);
    props.onAction(props.blockId, "water");
  };

  const handleSnoozeDate = async () => {
    const d = snoozeDate();
    if (!d) return;
    const lingerSec = (Date.now() - startTs()) / 1000;
    await recordLinger(props.blockId, lingerSec);
    await snoozeBlock(props.blockId, new Date(d + "T00:00:00"));
    props.onAction(props.blockId, "water");
  };

  const linkedBlockTitle = (link: Link, direction: "from" | "to") => {
    const id = direction === "from" ? link.from_block : link.to_block;
    const b = linkedBlocks().get(id);
    return b?.scripture_display_ref ?? b?.entity_name ?? b?.content.slice(0, 40) ?? id;
  };

  const handleAction = async (action: "water" | "transplant" | "harvest" | "ember") => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    try {
      await recordLinger(props.blockId, lingerSec);
      if (action === "water") await waterBlock(props.blockId);
      else if (action === "transplant") await transplantBlock(props.blockId);
      else if (action === "harvest") await harvestBlock(props.blockId);
      else if (action === "ember") {
        await emberBlock(props.blockId);
        props.onAction(props.blockId, "water");
        return;
      }
    } catch {}
    if (action !== "ember") props.onAction(props.blockId, action);
  };

  return (
    <div class={styles.view}>
      <div class={styles.header}>
        <button class={styles.closeBtn} onClick={props.onBack}>
          <IconX size={20} />
        </button>
        <span class={styles.progress}>
          {props.index + 1} of {props.total}
        </span>
        <div style={{ width: "20px" }} />
      </div>

      <Show when={!loading()} fallback={<p class={styles.loading}>Loading...</p>}>
        <Show when={block()} fallback={<p class={styles.error}>Block not found</p>}>
          {(b) => {
            const stage = () => lifeStage()?.stage ?? "seed";
            const StageIcon = STAGE_ICON[stage()];

            return (
              <div class={styles.content}>
                <Show when={stage()}>
                  {(s) => (
                    <div class={styles.stage} style={{ color: stageColor(s()) }}>
                      <StageIcon size={14} />
                      <span>{s()}</span>
                    </div>
                  )}
                </Show>

                <Show when={b().type === "scripture" && b().scripture_display_ref}>
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
                    fallback={<p class={styles.text}>{b().content}</p>}
                  >
                    {b()
                      .scripture_verses!.map((v) => (
                        <p class={styles.verse}>
                          <span class={styles.verseNum}>{v.number}</span>{" "}
                          <span class={styles.verseText}>{v.text}</span>
                        </p>
                      ))}
                  </Show>
                </div>

                <Show when={outgoing().length > 0 || backlinks().length > 0}>
                  <div class={styles.connections}>
                    <p class={styles.connectionsTitle}>
                      <IconLink size={14} /> Connections
                    </p>
                    <div class={styles.connectionsList}>
                      <For each={outgoing()}>
                        {(link) => (
                          <span class={styles.connectionChip}>
                            {linkedBlockTitle(link, "to")}
                          </span>
                        )}
                      </For>
                      <For each={backlinks()}>
                        {(link) => (
                          <span class={styles.connectionChip}>
                            {linkedBlockTitle(link, "from")}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <div class={styles.actions}>
                  <button
                    class={styles.actionBtn}
                    style={{ "--action-color": "var(--color-growth)" }}
                    onClick={() => handleAction("water")}
                  >
                    <IconDrop size={20} />
                    <span>Review Later</span>
                  </button>
                  <button
                    class={styles.actionBtn}
                    style={{ "--action-color": "var(--color-fire)" }}
                    onClick={() => handleAction("transplant")}
                  >
                    <IconArrowUp size={20} />
                    <span>Prioritize</span>
                  </button>
                  <button
                    class={styles.actionBtn}
                    style={{ "--action-color": "var(--color-mature)" }}
                    onClick={() => handleAction("harvest")}
                  >
                    <IconCheckCircle size={20} />
                    <span>Mastered</span>
                  </button>
                </div>

                <div class={styles.snoozeRow}>
                  <button
                    class={styles.snoozeBtn}
                    onClick={() => setShowSnooze(!showSnooze())}
                  >
                    <IconClock size={16} />
                    <span>Snooze</span>
                  </button>
                  <Show when={stage() !== "ember"}>
                    <button
                      class={styles.snoozeBtn}
                      style={{ color: "var(--color-text-tertiary)" }}
                      onClick={() => handleAction("ember")}
                    >
                      <IconFire size={16} />
                      <span>Archive</span>
                    </button>
                  </Show>
                </div>

                <Show when={showSnooze()}>
                  <div class={styles.snoozePanel}>
                    <div class={styles.snoozePresets}>
                      <For each={[1, 3, 7, 30]}>
                        {(days) => (
                          <button class={styles.snoozePreset} onClick={() => handleSnooze(days)}>
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
                  <button
                    class={styles.noteBtn}
                    onClick={() =>
                      props.onNote(props.blockId, b().scripture_display_ref ?? "")
                    }
                  >
                    <IconNotePencil size={16} /> Add Reflection
                  </button>
                </Show>
              </div>
            );
          }}
        </Show>
      </Show>
    </div>
  );
}
