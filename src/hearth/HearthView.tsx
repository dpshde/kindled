import { createSignal, onMount } from "solid-js";
import { getAllBlocks, searchBlocks, getLifeStage, type Block, type LifeStageRecord } from "../db";
import { nextReviewPresentation } from "../ui/helpers";
import {
  IconArrowLeft,
  IconMagnifyingGlass,
  IconPlus,
  IconFire,
  IconSparkle,
  IconBookOpen,
  IconUser,
  IconMapPin,
  IconNotePencil,
} from "../ui/Icons";
import { ICON_PX } from "../ui/icon-sizes";
import shell from "../ui/app-shell.module.css";
import styles from "./HearthView.module.css";
import { hapticTrigger } from "../haptics";

type IconComponent = typeof IconFire;

const TYPE_ICON: Record<string, IconComponent> = {
  scripture: IconBookOpen,
  person: IconUser,
  place: IconMapPin,
  theme: IconSparkle,
  note: IconNotePencil,
};

export function HearthView(props: {
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
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={shell.header}>
          <div class={shell.headerLeading}>
            <button
              type="button"
              class={shell.backBtn}
              onClick={() => {
                hapticTrigger();
                props.onBack();
              }}
              aria-label="Back"
            >
              <IconArrowLeft size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <h1 class={shell.headerTitle}>Hearth</h1>
          </div>
          <div class={shell.headerTrailing}>
            <button
              type="button"
              class={styles.addBtn}
              onClick={() => {
                hapticTrigger();
                props.onCapture();
              }}
              aria-label="Add passage"
            >
              <IconPlus size={ICON_PX.header} />
            </button>
          </div>
        </header>

        <div class={shell.main}>
        <div class={shell.shellContent}>
        <div class={styles.search}>
          <span class={styles.searchIcon}>
            <IconMagnifyingGlass size={ICON_PX.inline} />
          </span>
          <input
            type="text"
            placeholder="Search what you've kindled..."
            value={query()}
            onInput={(e) => handleSearch(e.currentTarget.value)}
            class={styles.searchInput}
          />
        </div>

        <div class={styles.list}>
        {loading() && <p class={styles.empty}>Loading...</p>}

        {!loading() && blocks().length === 0 && (
          <div class={styles.empty}>
            <span class={styles.emptyIcon}>
              <IconFire size={ICON_PX.hero} />
            </span>
            <p>{query() ? "No results found." : "Your hearth is empty—capture a passage to kindle a flame."}</p>
          </div>
        )}

        {blocks().map((block) => {
          const ls = stages().get(block.id);
          const TypeIcon = TYPE_ICON[block.type] ?? IconBookOpen;
          const rhythm = ls ? nextReviewPresentation(ls.next_review_at) : null;

          return (
                       <button
              type="button"
              class={styles.card}
              onClick={() => {
                hapticTrigger();
                props.onSelect(block.id);
              }}
            >
              <div class={styles.cardIcon}>
                <TypeIcon size={ICON_PX.inline} />
              </div>
              <div class={styles.cardContent}>
                <span class={styles.cardTitle}>
                  {block.scripture_display_ref ?? block.entity_name ?? "Note"}
                </span>
                {rhythm && (
                  <span class={styles.cardRhythm}>
                    {rhythm.heading} · {rhythm.dateMedium}
                  </span>
                )}
                <span class={styles.cardSub}>
                  {block.content.slice(0, 80)}
                  {block.content.length > 80 ? "..." : ""}
                </span>
              </div>
            </button>
          );
        })}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
