import { createSignal, onMount, Show } from "solid-js";
import {
  getBlock,
  getLifeStage,
  waterBlock,
  transplantBlock,
  harvestBlock,
  recordLinger,
  type Block,
  type LifeStageRecord,
  type LifeStage,
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

  onMount(async () => {
    try {
      const b = await getBlock(props.blockId);
      setBlock(b);
      if (b) {
        const ls = await getLifeStage(b.id);
        setLifeStage(ls);
      }
    } finally {
      setLoading(false);
    }
  });

  const handleAction = async (action: "water" | "transplant" | "harvest") => {
    const lingerSec = (Date.now() - startTs()) / 1000;
    try {
      await recordLinger(props.blockId, lingerSec);
      if (action === "water") await waterBlock(props.blockId);
      else if (action === "transplant") await transplantBlock(props.blockId);
      else if (action === "harvest") await harvestBlock(props.blockId);
    } catch {}
    props.onAction(props.blockId, action);
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

                <div class={styles.actions}>
                  <button
                    class={styles.actionBtn}
                    style={{ "--action-color": "var(--color-growth)" }}
                    onClick={() => handleAction("water")}
                  >
                    <IconDrop size={20} />
                    <span>Water</span>
                  </button>
                  <button
                    class={styles.actionBtn}
                    style={{ "--action-color": "var(--color-fire)" }}
                    onClick={() => handleAction("transplant")}
                  >
                    <IconArrowUp size={20} />
                    <span>Transplant</span>
                  </button>
                  <button
                    class={styles.actionBtn}
                    style={{ "--action-color": "var(--color-mature)" }}
                    onClick={() => handleAction("harvest")}
                  >
                    <IconCheckCircle size={20} />
                    <span>Harvest</span>
                  </button>
                </div>

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
