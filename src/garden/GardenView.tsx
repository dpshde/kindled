import { createSignal, onMount } from "solid-js";
import { getAllBlocks, searchBlocks, getLifeStage, type Block, type LifeStageRecord, type LifeStage } from "../db";
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
  onSelect: (blockId: string) => void;
}) {
  const [blocks, setBlocks] = createSignal<Block[]>([]);
  const [stages, setStages] = createSignal<Map<string, LifeStageRecord>>(new Map());
  const [query, setQuery] = createSignal("");
  const [loading, setLoading] = createSignal(true);

  const loadStageMap = async (bs: Block[]) => {
    const stageMap = new Map<string, LifeStageRecord>();
    for (const b of bs) {
      const ls = await getLifeStage(b.id);
      if (ls) stageMap.set(b.id, ls);
    }
    setStages(stageMap);
  };

  onMount(async () => {
    try {
      const all = await getAllBlocks();
      setBlocks(all);
      await loadStageMap(all);
    } finally {
      setLoading(false);
    }
  });

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const handleSearch = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimer);
    if (!val.trim()) {
      getAllBlocks().then(async (all) => { setBlocks(all); await loadStageMap(all); });
      return;
    }
    searchTimer = setTimeout(async () => {
      const results = await searchBlocks(val.trim());
      setBlocks(results);
      await loadStageMap(results);
    }, 200);
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
          onInput={(e) => handleSearch(e.currentTarget.value)}
          class={styles.searchInput}
        />
      </div>

      <div class={styles.list}>
        {loading() && <p class={styles.empty}>Loading garden...</p>}

        {!loading() && blocks().length === 0 && (
          <div class={styles.empty}>
            <span class={styles.emptyIcon}>
              <IconSeedling size={32} />
            </span>
            <p>{query() ? "No results found." : "Your garden is empty."}</p>
          </div>
        )}

        {blocks().map((block) => {
          const ls = stages().get(block.id);
          const stage = ls?.stage ?? "seed";
          const StageIcon = STAGE_ICON[stage];
          const TypeIcon = TYPE_ICON[block.type] ?? IconBookOpen;

          return (
            <button
              class={styles.card}
              style={{ "--stage-color": stageColor(stage) }}
              onClick={() => props.onSelect(block.id)}
            >
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
