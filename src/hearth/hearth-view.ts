import { html, reactive, watch, type ArrowTemplate } from "@arrow-js/core";
import { getAllBlocks, getLifeStage, searchBlocks, type Block, type LifeStageRecord } from "../db";
import { nextReviewPresentation } from "../ui/helpers";
import { IconArrowLeft, IconFire, IconMagnifyingGlass, IconPlus } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import shell from "../ui/app-shell.module.css";
import styles from "./HearthView.module.css";
import { hapticTrigger } from "../haptics";
import { hearthTypeIcon } from "./hearth-type-icon";

export function hearthView(props: {
  onBack: () => void;
  onCapture: () => void;
  onSelect: (blockId: string) => void;
}): ArrowTemplate {
  const state = reactive({
    blocks: [] as Block[],
    /** Plain object — Arrow `reactive` does not support `Map` (`.get` breaks on the proxy). */
    stages: {} as Record<string, LifeStageRecord>,
    query: "",
    loading: true,
  });

  const debounce = { t: undefined as ReturnType<typeof setTimeout> | undefined };

  watch(() => {
    void bootstrapHearth(state);
  });

  return html`<div class="${shell.view}">
    <div class="${shell.shell}">
      <header class="${shell.header}">
        <div class="${shell.headerLeading}">
          <button
            type="button"
            class="${shell.backBtn}"
            @click="${() => {
              hapticTrigger();
              props.onBack();
            }}"
            aria-label="Back"
          >
            ${IconArrowLeft({ size: ICON_PX.header })}
          </button>
        </div>
        <div class="${shell.headerCenter}">
          <h1 class="${shell.headerTitle}">Hearth</h1>
        </div>
        <div class="${shell.headerTrailing}">
          <button
            type="button"
            class="${styles.addBtn}"
            @click="${() => {
              hapticTrigger();
              props.onCapture();
            }}"
            aria-label="Add passage"
          >
            ${IconPlus({ size: ICON_PX.header })}
          </button>
        </div>
      </header>
      <div class="${shell.main}">
        <div class="${shell.shellContent}">
          <div class="${styles.search}">
            <span class="${styles.searchIcon}">
              ${IconMagnifyingGlass({ size: ICON_PX.inline })}
            </span>
            <input
              type="text"
              placeholder="Search what you've kindled..."
              class="${styles.searchInput}"
              value="${() => state.query}"
              @input="${(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                hearthSearch(state, val, debounce);
              }}"
            />
          </div>
          <div class="${styles.list}">
            ${() => hearthList(state, props)}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

async function bootstrapHearth(state: {
  blocks: Block[];
  stages: Record<string, LifeStageRecord>;
  loading: boolean;
}) {
  try {
    const all = await getAllBlocks();
    state.blocks = all;
    state.stages = await loadStageMap(all);
  } finally {
    state.loading = false;
  }
}

async function loadStageMap(bs: Block[]): Promise<Record<string, LifeStageRecord>> {
  const stageMap: Record<string, LifeStageRecord> = {};
  for (const b of bs) {
    const ls = await getLifeStage(b.id);
    if (ls) stageMap[b.id] = ls;
  }
  return stageMap;
}

function hearthSearch(
  state: { query: string; blocks: Block[]; stages: Record<string, LifeStageRecord> },
  val: string,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
) {
  state.query = val;
  if (debounce.t) clearTimeout(debounce.t);
  if (!val.trim()) {
    debounce.t = undefined;
    void getAllBlocks().then(async (all) => {
      state.blocks = all;
      state.stages = await loadStageMap(all);
    });
    return;
  }
  debounce.t = setTimeout(async () => {
    const results = await searchBlocks(val.trim());
    state.blocks = results;
    state.stages = await loadStageMap(results);
  }, 200);
}

function hearthList(
  state: {
    loading: boolean;
    blocks: Block[];
    query: string;
    stages: Record<string, LifeStageRecord>;
  },
  props: { onSelect: (id: string) => void },
): ArrowTemplate {
  if (state.loading) {
    return html`<p class="${styles.empty}">Loading...</p>`;
  }
  if (state.blocks.length === 0) {
    return html`<div class="${styles.empty}">
      <span class="${styles.emptyIcon}">${IconFire({ size: ICON_PX.hero })}</span>
      <p>
        ${state.query ? "No results found." : "Your hearth is empty—capture a passage to kindle a flame."}
      </p>
    </div>`;
  }
  return html`${() =>
    state.blocks.map((block) => hearthCard(block, state.stages, props))}`;
}

function hearthCard(
  block: Block,
  stages: Record<string, LifeStageRecord>,
  props: { onSelect: (id: string) => void },
): ArrowTemplate {
  const ls = stages[block.id];
  const rhythm = ls ? nextReviewPresentation(ls.next_review_at) : null;
  const TypeIcon = hearthTypeIcon(block.type);
  const title = block.scripture_display_ref ?? block.entity_name ?? "Note";
  const sub =
    block.content.slice(0, 80) + (block.content.length > 80 ? "..." : "");
  return html`<button
    type="button"
    class="${styles.card}"
    @click="${() => {
      hapticTrigger();
      props.onSelect(block.id);
    }}"
  >
    <div class="${styles.cardIcon}">${TypeIcon({ size: ICON_PX.inline })}</div>
    <div class="${styles.cardContent}">
      <span class="${styles.cardTitle}">${title}</span>
      ${rhythm
        ? html`<span class="${styles.cardRhythm}"
            >${rhythm.heading} · ${rhythm.dateMedium}</span
          >`
        : html``}
      <span class="${styles.cardSub}">${sub}</span>
    </div>
  </button>`;
}
