import { html, reactive, watch, type ArrowTemplate } from "@arrow-js/core";
import {
  deleteBlock,
  deleteReflection,
  deepenBlock,
  ensureLifeStage,
  getReflectionsForBlock,
  recordLinger,
  snoozeBlock,
  stokeBlock,
  type Block,
  type LifeStageRecord,
  type Link,
  type Reflection,
} from "../db";
import type { PassageNoteAction } from "../app/app-screen";
import type { AppRootModel } from "../app/app-model";
import {
  formatTimestampMedium,
  nextReviewPresentation,
} from "../ui/helpers";
import {
  IconArrowLeft,
  IconArrowSquareUpRight,
  IconArrowsClockwise,
  IconCheckCircle,
  IconClock,
  IconInfo,
  IconLink,
  IconNotePencil,
  IconTrash,
} from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import shell from "../ui/app-shell.module.css";
import styles from "./PassageView.module.css";
import { hapticTrigger } from "../haptics";
import { fetchPassageBundle } from "./passage-data-load";
import { linkEndpointLabel } from "./passage-link-title";
import { passageReviewDetailsModal } from "./passage-view-modal";
import { routeBibleHandoffUrl } from "../scripture/RouteBibleClient";

export function passageView(props: {
  app: AppRootModel;
  passageId: string;
  kindlingProgress?: { index: number; total: number };
  onKindlingAdvance?: () => void;
  onBack: () => void;
  onNavigate: (passageId: string) => void;
  onDeleted: () => void;
  onNote: (opts: PassageNoteAction) => void;
}): ArrowTemplate {
  const isKindling = props.onKindlingAdvance != null;
  const state = reactive({
    block: null as Block | null,
    lifeStage: null as LifeStageRecord | null,
    outgoing: [] as Link[],
    backlinks: [] as Link[],
    linkedBlocks: {} as Record<string, Block>,
    loading: true,
    confirmDelete: false,
    startTs: Date.now(),
    showSnooze: false,
    snoozeDate: "",
    showReviewDetails: false,
    reflections: [] as Reflection[],
  });

  let passageLoadSeq = 0;
  let reviewDetailsKeyCleanup: (() => void) | undefined;

  watch(() => {
    void props.app.passageReloadTick;
    const id = props.passageId;
    passageLoadReset(state);
    const seq = ++passageLoadSeq;
    state.loading = true;
    void (async () => {
      const data = await fetchPassageBundle(id, () => seq !== passageLoadSeq);
      if (seq !== passageLoadSeq || data === null) return;
      state.block = data.block;
      state.lifeStage = data.lifeStage;
      state.outgoing = data.outgoing;
      state.backlinks = data.backlinks;
      state.linkedBlocks = data.linkedBlocks;
      state.reflections = data.reflections;
      state.loading = false;
    })();
  });

  watch(() => {
    reviewDetailsKeyCleanup?.();
    reviewDetailsKeyCleanup = undefined;
    if (!state.showReviewDetails) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") state.showReviewDetails = false;
    };
    document.addEventListener("keydown", onKey);
    reviewDetailsKeyCleanup = () => document.removeEventListener("keydown", onKey);
  });

  return html`<div class="${shell.view}">
    <div class="${shell.shell}">
      ${passageHeader(state, props, isKindling)}
      <div class="${shell.main}">
        ${() => passageMain(state, props, isKindling)}
      </div>
    </div>
    ${() =>
      passageReviewDetailsModal(
        state.showReviewDetails,
        state.block,
        state.lifeStage,
        () => {
          state.showReviewDetails = false;
        },
      )}
  </div>`;
}

function passageLoadReset(state: {
  startTs: number;
  showSnooze: boolean;
  snoozeDate: string;
  confirmDelete: boolean;
  showReviewDetails: boolean;
}) {
  state.startTs = Date.now();
  state.showSnooze = false;
  state.snoozeDate = "";
  state.confirmDelete = false;
  state.showReviewDetails = false;
}

function passageHeader(
  state: {
    loading: boolean;
    block: Block | null;
    lifeStage: LifeStageRecord | null;
    showReviewDetails: boolean;
    confirmDelete: boolean;
  },
  props: {
    onBack: () => void;
    kindlingProgress?: { index: number; total: number };
  },
  _isKindling: boolean,
): ArrowTemplate {
  return html`<header class="${shell.header}">
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
      <div class="${styles.blockHeaderCenterInner}">
        ${() => passageHeaderMeta(state, props)}
      </div>
    </div>
    <div class="${shell.headerTrailing}">
      <button
        type="button"
        class="${styles.infoBtn}"
        disabled="${() => state.loading || !state.block}"
        @click="${() => {
          hapticTrigger();
          state.showReviewDetails = true;
        }}"
        aria-label="Review details"
        title="Review details"
      >
        ${IconInfo({ size: ICON_PX.header })}
      </button>
      <button
        type="button"
        class="${styles.deleteBtn}"
        @click="${() => {
          hapticTrigger();
          state.confirmDelete = true;
        }}"
        aria-label="Delete"
      >
        ${IconTrash({ size: ICON_PX.header })}
      </button>
    </div>
  </header>`;
}

function passageHeaderMeta(
  state: { block: Block | null; lifeStage: LifeStageRecord | null },
  props: { kindlingProgress?: { index: number; total: number } },
): ArrowTemplate {
  if (!state.block || (!state.lifeStage && !props.kindlingProgress)) return html``;
  return html`<p class="${styles.headerMetaRow}">
    ${() =>
      state.lifeStage
        ? html`<span class="${styles.rhythmDate}"
            >${nextReviewPresentation(state.lifeStage.next_review_at).dateMedium}</span
          >`
        : html``}
    ${() =>
      state.lifeStage && props.kindlingProgress
        ? html`<span class="${styles.headerMetaSep}" aria-hidden="true">·</span>`
        : html``}
    ${() =>
      props.kindlingProgress
        ? html`<span class="${styles.kindlingStep}"
            >${props.kindlingProgress.index + 1} of ${props.kindlingProgress.total}</span
          >`
        : html``}
  </p>`;
}

function passageMain(
  state: {
    loading: boolean;
    block: Block | null;
    lifeStage: LifeStageRecord | null;
    outgoing: Link[];
    backlinks: Link[];
    linkedBlocks: Record<string, Block>;
    confirmDelete: boolean;
    showSnooze: boolean;
    snoozeDate: string;
    reflections: Reflection[];
    startTs: number;
  },
  props: {
    passageId: string;
    onKindlingAdvance?: () => void;
    onNavigate: (id: string) => void;
    onDeleted: () => void;
    onNote: (opts: PassageNoteAction) => void;
  },
  isKindling: boolean,
): ArrowTemplate {
  if (state.loading) {
    return html`<p style="padding:40px 0;color:var(--color-text-tertiary)">Loading...</p>`;
  }
  if (!state.block) {
    return html`<p style="padding:40px 0;color:var(--color-text-tertiary)">Block not found</p>`;
  }
  const b = state.block;
  return html`<div class="${shell.shellContent}">
    ${passageReadingStack(b, state, isKindling, props)}
    ${() => passageConnectionsLibrary(state, props, isKindling)}
    ${() => passageDecisionPanel(b, state, props, isKindling)}
    ${() => passageConfirmDelete(state, props)}
  </div>`;
}

function passageReadingStack(
  b: Block,
  state: { outgoing: Link[]; backlinks: Link[]; linkedBlocks: Record<string, Block> },
  isKindling: boolean,
  _props: unknown,
): ArrowTemplate {
  return html`<div class="${styles.readingStack}">
    ${scriptureRefHead(b)}
    ${entityRefHead(b)}
    ${b.type === "note" ? html`<h2 class="${styles.ref}">Your Reflection</h2>` : html``}
    <div class="${styles.textBlock}">
      ${verseOrContent(b)}
    </div>
    ${() => kindlingConnectionsSection(state, isKindling)}
  </div>`;
}

function scriptureRefHead(b: Block): ArrowTemplate {
  if (b.type !== "scripture" || !b.scripture_display_ref) return html``;
  const handoff = routeBibleHandoffUrl(b);
  const ariaRef = b.scripture_translation
    ? `${b.scripture_display_ref} (${b.scripture_translation})`
    : b.scripture_display_ref;
  const titleInner = handoff
    ? html`<a
        class="${styles.refLink}"
        href="${handoff}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="${`Open ${ariaRef} on route.bible`}"
        @click="${() => hapticTrigger()}"
        ><span class="${styles.refLinkText}">${b.scripture_display_ref}</span
        >${b.scripture_translation
          ? html`<span class="${styles.translation}">${b.scripture_translation}</span>`
          : html``}<span class="${styles.refLinkIcon}" aria-hidden="true"
          >${IconArrowSquareUpRight({ size: ICON_PX.compact })}</span
        ></a>`
    : html`${b.scripture_display_ref}`;
  return html`<div class="${styles.refHead}">
    <h2 class="${styles.ref}">${titleInner}</h2>
    ${handoff || !b.scripture_translation
      ? html``
      : html`<span class="${styles.translation}">${b.scripture_translation}</span>`}
  </div>`;
}

function entityRefHead(b: Block): ArrowTemplate {
  if (!b.entity_name) return html``;
  return html`<div class="${styles.refHead}">
    <h2 class="${styles.ref}">${b.entity_name}</h2>
    ${b.entity_type ? html`<span class="${styles.translation}">${b.entity_type}</span>` : html``}
  </div>`;
}

function verseOrContent(b: Block): ArrowTemplate {
  if (b.scripture_verses && b.scripture_verses.length > 0) {
    return html`${() =>
      b.scripture_verses!.map((v) =>
        html`<p class="${styles.verse}">
          <span class="${styles.verseNum}">${v.number}</span>
          <span class="${styles.verseText}">${v.text}</span>
        </p>`,
      )}`;
  }
  return html`<p>${b.content}</p>`;
}

function kindlingConnectionsSection(
  state: { outgoing: Link[]; backlinks: Link[]; linkedBlocks: Record<string, Block> },
  isKindling: boolean,
): ArrowTemplate {
  if (!isKindling || (state.outgoing.length === 0 && state.backlinks.length === 0)) {
    return html``;
  }
  return html`<div class="${styles.connectionsSection}">
    <p class="${styles.connectionsTitle}">
      ${IconLink({ size: ICON_PX.compact })} Connections
    </p>
    <div class="${styles.connections}">
      ${() =>
        state.outgoing.map((link) =>
          html`<span class="${styles.connectionChipStatic}"
            >${linkEndpointLabel(link, "to", state.linkedBlocks)}</span
          >`,
        )}
      ${() =>
        state.backlinks.map((link) =>
          html`<span class="${styles.connectionChipStatic}"
            >${linkEndpointLabel(link, "from", state.linkedBlocks)}</span
          >`,
        )}
    </div>
  </div>`;
}

function passageConnectionsLibrary(
  state: { outgoing: Link[]; backlinks: Link[]; linkedBlocks: Record<string, Block> },
  props: { onNavigate: (id: string) => void },
  isKindling: boolean,
): ArrowTemplate {
  if (isKindling) return html``;
  return html`${libraryOutgoingSection(state, props)}${libraryBacklinksSection(state, props)}`;
}

function libraryOutgoingSection(
  state: { outgoing: Link[]; linkedBlocks: Record<string, Block> },
  props: { onNavigate: (id: string) => void },
): ArrowTemplate {
  if (state.outgoing.length === 0) return html``;
  return html`<div>
    <p class="${styles.sectionTitle}">Connected</p>
    <div class="${styles.connections}">
      ${() =>
        state.outgoing.map((link) =>
          html`<button
            type="button"
            class="${styles.connectionChip}"
            @click="${() => {
              hapticTrigger();
              props.onNavigate(link.to_block);
            }}"
          >
            ${linkEndpointLabel(link, "to", state.linkedBlocks)}
          </button>`,
        )}
    </div>
  </div>`;
}

function libraryBacklinksSection(
  state: { backlinks: Link[]; linkedBlocks: Record<string, Block> },
  props: { onNavigate: (id: string) => void },
): ArrowTemplate {
  if (state.backlinks.length === 0) return html``;
  return html`<div>
    <p class="${styles.sectionTitle}">Referenced by</p>
    <div class="${styles.connections}">
      ${() =>
        state.backlinks.map((link) =>
          html`<button
            type="button"
            class="${styles.connectionChip}"
            @click="${() => {
              hapticTrigger();
              props.onNavigate(link.from_block);
            }}"
          >
            ${linkEndpointLabel(link, "from", state.linkedBlocks)}
          </button>`,
        )}
    </div>
  </div>`;
}

function passageDecisionPanel(
  b: Block,
  state: {
    lifeStage: LifeStageRecord | null;
    reflections: Reflection[];
    showSnooze: boolean;
    snoozeDate: string;
    startTs: number;
  },
  props: {
    passageId: string;
    onKindlingAdvance?: () => void;
    onNote: (opts: PassageNoteAction) => void;
  },
  _isKindling: boolean,
): ArrowTemplate {
  if (!state.lifeStage) return html``;
  return html`<div class="${styles.decisionPanel}">
    ${scriptureReflectionSection(b, state, props)}
    ${() => snoozeSection(state, props)}
    <div class="${styles.decisionPanelActions}">
      <div class="${styles.actions}">
        <button
          type="button"
          class="${`${styles.actionBtn} ${styles.actionBtnSecondary}`}"
          @click="${() => passageAction("deepen", state, props)}"
        >
          ${IconCheckCircle({ size: ICON_PX.decisionStack })} <span>Mastered</span>
        </button>
        <button
          type="button"
          class="${`${styles.actionBtn} ${styles.actionBtnPrimary}`}"
          @click="${() => passageAction("stoke", state, props)}"
        >
          <span class="${styles.decisionArrowsOptical}">
            ${IconArrowsClockwise({ size: ICON_PX.decisionStack })}
          </span>
          <span>Review later</span>
        </button>
      </div>
    </div>
  </div>`;
}

function scriptureReflectionSection(
  b: Block,
  state: {
    reflections: Reflection[];
    lifeStage: LifeStageRecord | null;
  },
  props: {
    passageId: string;
    onNote: (opts: PassageNoteAction) => void;
  },
): ArrowTemplate {
  if (b.type !== "scripture" || !b.scripture_display_ref) return html``;
  return html`<div class="${styles.reflectionAddRow}">
      <button
        type="button"
        class="${styles.tertiaryBtn}"
        @click="${() => {
          hapticTrigger();
          props.onNote({
            passageId: b.id,
            displayRef: b.scripture_display_ref ?? "",
          });
        }}"
      >
        ${IconNotePencil({ size: ICON_PX.decisionPanel })}
        <span class="${styles.tertiaryBtnLabel}">Add reflection</span>
      </button>
    </div>
    ${() => reflectionList(b, state, props)}`;
}

function reflectionList(
  b: Block,
  state: { reflections: Reflection[]; lifeStage: LifeStageRecord | null },
  props: { passageId: string; onNote: (opts: PassageNoteAction) => void },
): ArrowTemplate {
  if (state.reflections.length === 0) return html``;
  return html`<ul class="${styles.reflectionList}">
    ${() =>
      state.reflections.map((ref) =>
        html`<li class="${styles.reflectionCard}">
          <p class="${styles.reflectionMeta}">${formatTimestampMedium(ref.modified_at)}</p>
          <div class="${styles.reflectionActions}">
            <button
              type="button"
              class="${styles.reflectionActionBtn}"
              @click="${() => {
                hapticTrigger();
                props.onNote({
                  passageId: b.id,
                  displayRef: b.scripture_display_ref ?? "",
                  reflectionId: ref.id,
                });
              }}"
            >
              Edit
            </button>
            <button
              type="button"
              class="${styles.reflectionActionBtnDanger}"
              @click="${() => void deleteReflectionAndRefresh(state, props.passageId, ref.id)}"
            >
              Delete
            </button>
          </div>
        </li>`,
      )}
  </ul>`;
}

async function deleteReflectionAndRefresh(
  state: { reflections: Reflection[]; lifeStage: LifeStageRecord | null },
  passageId: string,
  reflectionId: string,
) {
  hapticTrigger();
  if (!confirm("Delete this reflection?")) return;
  await deleteReflection(reflectionId);
  state.reflections = await getReflectionsForBlock(passageId);
  state.lifeStage = await ensureLifeStage(passageId);
}

function snoozeSection(
  state: {
    showSnooze: boolean;
    snoozeDate: string;
    startTs: number;
    lifeStage: LifeStageRecord | null;
  },
  props: { passageId: string; onKindlingAdvance?: () => void },
): ArrowTemplate {
  return html`<div
    class="${() =>
      `${styles.tertiaryRow}${state.showSnooze ? ` ${styles.tertiaryRowSnoozeOpen}` : ""}`}"
  >
    <button
      type="button"
      class="${styles.tertiaryBtn}"
      @click="${() => {
        hapticTrigger();
        state.showSnooze = !state.showSnooze;
      }}"
      aria-expanded="${() => String(state.showSnooze)}"
    >
      ${IconClock({ size: ICON_PX.decisionPanel })}
      <span class="${styles.tertiaryBtnLabel}">Snooze</span>
    </button>
    ${() => (state.showSnooze ? snoozePanel(state, props) : html``)}
  </div>`;
}

function snoozePanel(
  state: {
    snoozeDate: string;
    startTs: number;
    showSnooze: boolean;
    lifeStage: LifeStageRecord | null;
  },
  props: { passageId: string; onKindlingAdvance?: () => void },
): ArrowTemplate {
  const minDate = new Date().toISOString().split("T")[0]!;
  return html`<div class="${styles.snoozePanel}">
    <div class="${styles.snoozePresets}">
      ${[1, 3, 7, 30].map((days) =>
        html`<button
          type="button"
          class="${styles.snoozePreset}"
          @click="${() => void snoozePresetDays(state, props, days)}"
        >
          ${days}d
        </button>`,
      )}
    </div>
    <div class="${styles.snoozeCustom}">
      <input
        type="date"
        class="${styles.snoozeInput}"
        value="${() => state.snoozeDate}"
        min="${minDate}"
        @input="${(e: Event) => {
          state.snoozeDate = (e.target as HTMLInputElement).value;
        }}"
      />
      <button
        type="button"
        class="${styles.snoozePreset}"
        disabled="${() => !state.snoozeDate}"
        @click="${() => void snoozeCustomDate(state, props)}"
      >
        Go
      </button>
    </div>
  </div>`;
}

async function snoozePresetDays(
  state: {
    startTs: number;
    showSnooze: boolean;
    lifeStage: LifeStageRecord | null;
  },
  props: { passageId: string; onKindlingAdvance?: () => void },
  days: number,
) {
  hapticTrigger();
  const lingerSec = (Date.now() - state.startTs) / 1000;
  await recordLinger(props.passageId, lingerSec);
  const until = new Date();
  until.setDate(until.getDate() + days);
  await snoozeBlock(props.passageId, until);
  state.showSnooze = false;
  state.lifeStage = await ensureLifeStage(props.passageId);
  props.onKindlingAdvance?.();
}

async function snoozeCustomDate(
  state: {
    snoozeDate: string;
    startTs: number;
    showSnooze: boolean;
    lifeStage: LifeStageRecord | null;
  },
  props: { passageId: string; onKindlingAdvance?: () => void },
) {
  hapticTrigger();
  const d = state.snoozeDate;
  if (!d) return;
  const lingerSec = (Date.now() - state.startTs) / 1000;
  await recordLinger(props.passageId, lingerSec);
  await snoozeBlock(props.passageId, new Date(`${d}T00:00:00`));
  state.showSnooze = false;
  state.lifeStage = await ensureLifeStage(props.passageId);
  props.onKindlingAdvance?.();
}

async function passageAction(
  action: "stoke" | "deepen",
  state: { startTs: number; lifeStage: LifeStageRecord | null },
  props: { passageId: string; onKindlingAdvance?: () => void },
) {
  hapticTrigger();
  const lingerSec = (Date.now() - state.startTs) / 1000;
  try {
    await recordLinger(props.passageId, lingerSec);
    if (action === "stoke") await stokeBlock(props.passageId);
    else await deepenBlock(props.passageId);
  } catch {
    /* ignore */
  }
  state.lifeStage = await ensureLifeStage(props.passageId);
  props.onKindlingAdvance?.();
}

function passageConfirmDelete(
  state: { confirmDelete: boolean },
  props: { passageId: string; onDeleted: () => void },
): ArrowTemplate {
  if (!state.confirmDelete) return html``;
  return html`<div class="${styles.confirmRow}">
    <span class="${styles.confirmText}">Delete this block?</span>
    <button
      type="button"
      class="${styles.confirmNo}"
      @click="${() => {
        hapticTrigger();
        state.confirmDelete = false;
      }}"
    >
      Cancel
    </button>
    <button
      type="button"
      class="${styles.confirmYes}"
      @click="${() => void confirmDeleteBlock(state, props)}"
    >
      Delete
    </button>
  </div>`;
}

async function confirmDeleteBlock(
  _state: { confirmDelete: boolean },
  props: { passageId: string; onDeleted: () => void },
) {
  hapticTrigger();
  await deleteBlock(props.passageId);
  props.onDeleted();
}
