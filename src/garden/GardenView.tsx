import { createSignal, onMount } from "solid-js";
import { getAllBlocks, getLifeStage, type Block, type LifeStageRecord, type LifeStage } from "../db";
import { stageColor } from "../ui/helpers";
import {
  IconArrowLeft,
  IconMagnifyingGlass,
  IconPlus,
  IconSeedling,
  IconTree,
  IconLeaf,
  IconFire,
  IconBookOpen,
  IconUser,
  IconMapPin,
  IconNotePencil,
} from "../ui/Icons";
import styles from "./GardenView.module.css";

type IconComponent = typeof IconSeedling;

const STAGE_ICON: Record<LifeStage, IconComponent> = {
  seed: IconSeedling,
  sprout: IconTree,
  mature: IconLeaf,
  ember: IconFire,
};

const TYPE_ICON: Record<string, IconComponent> = {
  scripture: IconBookOpen,
  person: IconUser,
  place: IconMapPin,
  theme: IconLeaf,
  note: IconNotePencil,
};

export function GardenView(props: {
  onBack: () => void;
  onCapture: () => void;
}) {
  const [blocks, setBlocks] = createSignal<(Block & { stage?: LifeStage })[]>([]);
  const [stages, setStages] = createSignal<Map<string, LifeStageRecord>>(new Map());
  const [query, setQuery] = createSignal("");
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const all = await getAllBlocks();
      const stageMap = new Map<string, LifeStageRecord>();
      for (const b of all) {
        const ls = await getLifeStage(b.id);
        if (ls) stageMap.set(b.id, ls);
      }
      setBlocks(all);
      setStages(stageMap);
    } finally {
      setLoading(false);
    }
  });

  const filtered = () => {
    const q = query().toLowerCase();
    if (!q) return blocks();
    return blocks().filter(
      (b) =>
        b.content.toLowerCase().includes(q) ||
        b.scripture_display_ref?.toLowerCase().includes(q) ||
        b.entity_name?.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q)),
    );
  };

  return (
    <div class={styles.view}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={props.onBack}>
          <IconArrowLeft size={20} />
        </button>
        <h1 class={styles.title}>Garden</h1>
        <button class={styles.addBtn} onClick={props.onCapture}>
          <IconPlus size={20} />
        </button>
      </div>

      <div class={styles.search}>
        <span class={styles.searchIcon}>
          <IconMagnifyingGlass size={16} />
        </span>
        <input
          type="text"
          placeholder="Search your garden..."
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          class={styles.searchInput}
        />
      </div>

      <div class={styles.list}>
        {loading() && <p class={styles.empty}>Loading garden...</p>}

        {!loading() && filtered().length === 0 && (
          <div class={styles.empty}>
            <span class={styles.emptyIcon}>
              <IconSeedling size={32} />
            </span>
            <p>{query() ? "No results found." : "Your garden is empty."}</p>
          </div>
        )}

        {filtered().map((block) => {
          const ls = stages().get(block.id);
          const stage = ls?.stage ?? "seed";
          const StageIcon = STAGE_ICON[stage];
          const TypeIcon = TYPE_ICON[block.type] ?? IconBookOpen;

          return (
            <div class={styles.card} style={{ "--stage-color": stageColor(stage) }}>
              <div class={styles.cardIcon}>
                <TypeIcon size={16} />
              </div>
              <div class={styles.cardContent}>
                <span class={styles.cardTitle}>
                  {block.scripture_display_ref ?? block.entity_name ?? "Note"}
                </span>
                <span class={styles.cardSub}>
                  {block.content.slice(0, 80)}
                  {block.content.length > 80 ? "..." : ""}
                </span>
              </div>
              <div class={styles.cardStage}>
                <StageIcon size={14} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
