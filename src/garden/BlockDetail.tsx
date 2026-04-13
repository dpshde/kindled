import { createSignal, onMount, Show, For } from "solid-js";
import {
  getBlock,
  getLifeStage,
  getOutgoingLinks,
  getBacklinks,
  deleteBlock,
  type Block,
  type LifeStageRecord,
  type LifeStage,
  type Link,
} from "../db";
import { stageColor } from "../ui/helpers";
import {
  IconArrowLeft,
  IconSeedling,
  IconTree,
  IconLeaf,
  IconFire,
  IconTrash,
} from "../ui/Icons";
import styles from "./BlockDetail.module.css";

const STAGE_ICON: Record<LifeStage, typeof IconSeedling> = {
  seed: IconSeedling,
  sprout: IconTree,
  mature: IconLeaf,
  ember: IconFire,
};

export function BlockDetail(props: {
  blockId: string;
  onBack: () => void;
  onNavigate: (blockId: string) => void;
  onDeleted: () => void;
}) {
  const [block, setBlock] = createSignal<Block | null>(null);
  const [lifeStage, setLifeStage] = createSignal<LifeStageRecord | null>(null);
  const [outgoing, setOutgoing] = createSignal<Link[]>([]);
  const [backlinks, setBacklinks] = createSignal<Link[]>([]);
  const [linkedBlocks, setLinkedBlocks] = createSignal<Map<string, Block>>(new Map());
  const [loading, setLoading] = createSignal(true);
  const [confirmDelete, setConfirmDelete] = createSignal(false);

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

        // Load linked block data
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

  const handleDelete = async () => {
    await deleteBlock(props.blockId);
    props.onDeleted();
  };

  const linkedBlockTitle = (link: Link, direction: "from" | "to") => {
    const id = direction === "from" ? link.from_block : link.to_block;
    const b = linkedBlocks().get(id);
    return b?.scripture_display_ref ?? b?.entity_name ?? b?.content.slice(0, 40) ?? id;
  };

  return (
    <div class={styles.view}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={props.onBack}>
          <IconArrowLeft size={20} />
        </button>
        <span class={styles.headerTitle}>
          {block()?.scripture_display_ref ?? block()?.entity_name ?? "Block"}
        </span>
        <button class={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
          <IconTrash size={18} />
        </button>
      </div>

      <Show when={!loading()} fallback={<p style={{ padding: "40px 20px", color: "var(--color-text-tertiary)" }}>Loading...</p>}>
        <Show when={block()} fallback={<p style={{ padding: "40px 20px", color: "var(--color-text-tertiary)" }}>Block not found</p>}>
          {(b) => {
            const stage = () => lifeStage()?.stage ?? "seed";
            const StageIcon = STAGE_ICON[stage()];

            return (
              <div class={styles.body}>
                <Show when={stage()}>
                  {(s) => (
                    <div class={styles.stage} style={{ color: stageColor(s()) }}>
                      <StageIcon size={14} />
                      <span>{s()}</span>
                    </div>
                  )}
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

                <Show when={lifeStage()}>
                  {(ls) => (
                    <p class={styles.meta}>
                      Watered {ls().watering_count}x · {ls().notes_added} notes · {ls().connections_made} connections · planted {new Date(ls().planted_at).toLocaleDateString()}
                    </p>
                  )}
                </Show>

                <Show when={outgoing().length > 0}>
                  <div>
                    <p class={styles.sectionTitle}>Connected</p>
                    <div class={styles.connections}>
                      <For each={outgoing()}>
                        {(link) => (
                          <button
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

                <Show when={confirmDelete()}>
                  <div class={styles.confirmRow}>
                    <span class={styles.confirmText}>Delete this block?</span>
                    <button class={styles.confirmNo} onClick={() => setConfirmDelete(false)}>Cancel</button>
                    <button class={styles.confirmYes} onClick={handleDelete}>Delete</button>
                  </div>
                </Show>
              </div>
            );
          }}
        </Show>
      </Show>
    </div>
  );
}
