import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import {
  deleteBlock,
  deepenBlock,
  ensureLifeStage,
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
  nextReviewPresentation,
} from "../ui/helpers";
import {
  IconArrowSquareUpRight,
  IconArrowsClockwise,
  IconCheckCircle,
  IconClock,
  IconFire,
  IconInfo,
  IconLink,
  IconNotePencil,
  IconTrash,
} from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import shell from "../ui/app-shell.module.css";
import styles from "./PassageView.module.css";
import { hapticLight, hapticMedium, hapticHeavy, hapticSelection, hapticWarning } from "../haptics";
import { isTauriRuntime } from "../sync/tauri-file-store";
import { fetchPassageBundle } from "./passage-data-load";
import { linkEndpointLabel } from "./passage-link-title";
import { PassageReviewDetailsModal } from "./passage-view-modal";
import { routeBibleHandoffUrl } from "../scripture/RouteBibleClient";

export function PassageView(props: {
  app: AppRootModel;
  passageId: string;
  kindlingProgress?: { index: number; total: number };
  onKindlingAdvance?: () => void;
  onBack: () => void;
  onNavigate: (passageId: string) => void;
  onNavigateHome: () => void;
  onDeleted: () => void;
  onNote: (opts: PassageNoteAction) => void;
}): JSX.Element {
  const isKindling = props.onKindlingAdvance != null;

  const [block, setBlock] = createSignal<Block | null>(null);
  const [lifeStage, setLifeStage] = createSignal<LifeStageRecord | null>(null);
  const [outgoing, setOutgoing] = createSignal<Link[]>([]);
  const [backlinks, setBacklinks] = createSignal<Link[]>([]);
  const [linkedBlocks, setLinkedBlocks] = createSignal<Record<string, Block>>({});
  const [loading, setLoading] = createSignal(true);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [startTs, setStartTs] = createSignal(Date.now());
  const [showSnooze, setShowSnooze] = createSignal(false);
  const [snoozeDate, setSnoozeDate] = createSignal("");
  const [showReviewDetails, setShowReviewDetails] = createSignal(false);
  const [showReadingFocus, setShowReadingFocus] = createSignal(false);
  const [reflections, setReflections] = createSignal<Reflection[]>([]);

  let passageLoadSeq = 0;

  function passageLoadReset() {
    setStartTs(Date.now());
    setShowSnooze(false);
    setSnoozeDate("");
    setConfirmDelete(false);
    setShowReviewDetails(false);
    setShowReadingFocus(false);
  }

  createEffect(() => {
    void props.app.passageReloadTick();
    const id = props.passageId;
    passageLoadReset();
    const seq = ++passageLoadSeq;
    setLoading(true);
    void (async () => {
      const data = await fetchPassageBundle(id, () => seq !== passageLoadSeq);
      if (seq !== passageLoadSeq || data === null) return;
      setBlock(data.block);
      setLifeStage(data.lifeStage);
      setOutgoing(data.outgoing);
      setBacklinks(data.backlinks);
      setLinkedBlocks(data.linkedBlocks);
      setReflections(data.reflections);
      setLoading(false);
    })();
  });

  // Escape key for review details modal
  createEffect(() => {
    if (!showReviewDetails()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowReviewDetails(false);
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <Show when={!showReadingFocus()}>
          <PassageHeader
            loading={loading()}
            block={block()}
            lifeStage={lifeStage()}
            kindlingProgress={props.kindlingProgress}
            onBack={props.onBack}
            onHome={props.onNavigateHome}
            onInfo={() => {
              hapticLight();
              setShowReviewDetails(true);
            }}
            onDelete={() => {
              hapticWarning();
              setConfirmDelete(true);
            }}
          />
        </Show>
        <div class={shell.main}>
          <Show
            when={!loading() && block()}
            fallback={
              <p style={{ padding: "40px 0", color: "var(--color-text-tertiary)" }}>
                {loading() ? "Loading..." : "Block not found"}
              </p>
            }
          >
            <PassageMain
              block={block()!}
              lifeStage={lifeStage()}
              outgoing={outgoing()}
              backlinks={backlinks()}
              linkedBlocks={linkedBlocks()}
              confirmDelete={confirmDelete()}
              showSnooze={showSnooze()}
              snoozeDate={snoozeDate()}
              reflections={reflections()}
              startTs={startTs()}
              passageId={props.passageId}
              isKindling={isKindling}
              kindlingProgress={props.kindlingProgress}
              showReadingFocus={showReadingFocus()}
              onToggleReadingFocus={(next) => setShowReadingFocus(next)}
              onKindlingAdvance={props.onKindlingAdvance}
              onNavigate={props.onNavigate}
              onDeleted={props.onDeleted}
              onNote={props.onNote}
              setLifeStage={setLifeStage}
              setConfirmDelete={setConfirmDelete}
              setShowSnooze={setShowSnooze}
              setSnoozeDate={setSnoozeDate}
              setReflections={setReflections}
            />
          </Show>
        </div>
      </div>
      <Show when={showReviewDetails() && block()}>
        <PassageReviewDetailsModal
          block={block()!}
          lifeStage={lifeStage()}
          onClose={() => setShowReviewDetails(false)}
        />
      </Show>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────

function PassageHeader(props: {
  loading: boolean;
  block: Block | null;
  lifeStage: LifeStageRecord | null;
  kindlingProgress?: { index: number; total: number };
  onBack: () => void;
  onHome: () => void;
  onInfo: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <header class={shell.header}>
      <div class={shell.headerNav}>
        <button
          type="button"
          class={shell.logoBtn}
          onClick={() => {
            hapticLight();
            props.onHome();
          }}
          aria-label="Home"
        >
          <IconFire size={ICON_PX.header} />
        </button>
      </div>
      <div class={shell.headerCenter}>
        <PassageHeaderMeta
          block={props.block}
          lifeStage={props.lifeStage}
          kindlingProgress={props.kindlingProgress}
        />
      </div>
      <div class={shell.headerActions}>
        <button
          type="button"
          class={shell.headerBtn}
          disabled={props.loading || !props.block}
          onClick={props.onInfo}
          aria-label="Review details"
          title="Review details"
        >
          <IconInfo size={ICON_PX.header} />
        </button>
        <button
          type="button"
          class={`${shell.headerBtn} ${shell.headerBtnDanger}`}
          onClick={props.onDelete}
          aria-label="Delete"
        >
          <IconTrash size={ICON_PX.header} />
        </button>
      </div>
    </header>
  );
}

function PassageHeaderMeta(props: {
  block: Block | null;
  lifeStage: LifeStageRecord | null;
  kindlingProgress?: { index: number; total: number };
}): JSX.Element {
  return (
    <Show when={props.block && (props.lifeStage || props.kindlingProgress)}>
      <p class={styles.headerMetaRow}>
        {props.lifeStage && (
          <span class={styles.rhythmDate}>
            {nextReviewPresentation(props.lifeStage.next_review_at).dateMedium}
          </span>
        )}
        {props.lifeStage && props.kindlingProgress && (
          <span class={styles.headerMetaSep} aria-hidden="true">
            ·
          </span>
        )}
        {props.kindlingProgress && (
          <span class={styles.kindlingStep}>
            {props.kindlingProgress.index + 1} of {props.kindlingProgress.total}
          </span>
        )}
      </p>
    </Show>
  );
}

// ─── Main content ─────────────────────────────────────────────────

function PassageMain(props: {
  block: Block;
  lifeStage: LifeStageRecord | null;
  outgoing: Link[];
  backlinks: Link[];
  linkedBlocks: Record<string, Block>;
  confirmDelete: boolean;
  showSnooze: boolean;
  snoozeDate: string;
  reflections: Reflection[];
  startTs: number;
  passageId: string;
  isKindling: boolean;
  kindlingProgress?: { index: number; total: number };
  showReadingFocus: boolean;
  onToggleReadingFocus: (next: boolean) => void;
  onKindlingAdvance?: () => void;
  onNavigate: (id: string) => void;
  onDeleted: () => void;
  onNote: (opts: PassageNoteAction) => void;
  setLifeStage: (v: LifeStageRecord | null) => void;
  setConfirmDelete: (v: boolean) => void;
  setShowSnooze: (v: boolean) => void;
  setSnoozeDate: (v: string) => void;
  setReflections: (v: Reflection[]) => void;
}): JSX.Element {
  const b = props.block;
  const canToggleReadingFocus = () => b.type === "scripture";

  function handleContentTap(e: MouseEvent) {
    if (!canToggleReadingFocus()) return;

    if (props.showReadingFocus) {
      e.preventDefault();
      e.stopPropagation();
      props.onToggleReadingFocus(false);
      return;
    }

    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }

    props.onToggleReadingFocus(true);
  }

  return (
    <div
      class={`${shell.shellContent} ${styles.passageContent}${props.showReadingFocus ? ` ${styles.passageContentFocus}` : ""}`}
      onClick={handleContentTap}
    >
      <PassageReadingStack
        block={b}
        outgoing={props.outgoing}
        backlinks={props.backlinks}
        linkedBlocks={props.linkedBlocks}
        isKindling={props.isKindling}
        showReadingFocus={props.showReadingFocus}
      />
      <Show when={!props.showReadingFocus}>
        <PassageConnectionsLibrary
          outgoing={props.outgoing}
          backlinks={props.backlinks}
          linkedBlocks={props.linkedBlocks}
          isKindling={props.isKindling}
          onNavigate={props.onNavigate}
        />
      </Show>
      <Show when={props.lifeStage && !props.showReadingFocus}>
        <PassageDecisionPanel
          block={b}
          lifeStage={props.lifeStage!}
          reflections={props.reflections}
          showSnooze={props.showSnooze}
          snoozeDate={props.snoozeDate}
          startTs={props.startTs}
          passageId={props.passageId}
          isKindling={props.isKindling}
          onKindlingAdvance={props.onKindlingAdvance}
          onNote={props.onNote}
          setLifeStage={props.setLifeStage}
          setShowSnooze={props.setShowSnooze}
          setSnoozeDate={props.setSnoozeDate}
          setReflections={props.setReflections}
        />
      </Show>
      {props.confirmDelete && (
        <PassageConfirmDelete
          passageId={props.passageId}
          onDeleted={props.onDeleted}
          onCancel={() => {
            hapticLight();
            props.setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Reading stack ────────────────────────────────────────────────

function PassageReadingStack(props: {
  block: Block;
  outgoing: Link[];
  backlinks: Link[];
  linkedBlocks: Record<string, Block>;
  isKindling: boolean;
  showReadingFocus: boolean;
}): JSX.Element {
  const b = props.block;
  return (
    <div class={styles.readingStack}>
      <ScriptureRefHead block={b} />
      <EntityRefHead block={b} />
      {b.type === "note" && (
        <h2 class={styles.ref}>Your Reflection</h2>
      )}
      <div class={styles.textBlock}>
        <VerseOrContent block={b} />
      </div>
      <Show when={!props.showReadingFocus}>
        <KindlingConnectionsSection
          outgoing={props.outgoing}
          backlinks={props.backlinks}
          linkedBlocks={props.linkedBlocks}
          isKindling={props.isKindling}
        />
      </Show>
    </div>
  );
}

function ScriptureRefHead(props: { block: Block }): JSX.Element {
  const b = props.block;
  if (b.type !== "scripture" || !b.scripture_display_ref) return <></>;
  const handoff = routeBibleHandoffUrl(b);
  const ariaRef = b.scripture_translation
    ? `${b.scripture_display_ref} (${b.scripture_translation})`
    : b.scripture_display_ref;
  async function openRouteBible(url: string) {
    hapticLight();
    if (isTauriRuntime()) {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  const titleInner = handoff ? (
    <button
      type="button"
      class={styles.refLink}
      aria-label={`Open ${ariaRef} on route.bible`}
      onClick={() => void openRouteBible(handoff)}
    >
      <span class={styles.refLinkText}>{b.scripture_display_ref}</span>
      {b.scripture_translation && (
        <span class={styles.translation}>{b.scripture_translation}</span>
      )}
      <span class={styles.refLinkIcon} aria-hidden="true">
        <IconArrowSquareUpRight size={ICON_PX.compact} />
      </span>
    </button>
  ) : (
    <>{b.scripture_display_ref}</>
  );
  return (
    <div class={styles.refHead}>
      <h2 class={styles.ref}>{titleInner}</h2>
      {!handoff && b.scripture_translation && (
        <span class={styles.translation}>{b.scripture_translation}</span>
      )}
    </div>
  );
}

function EntityRefHead(props: { block: Block }): JSX.Element {
  const b = props.block;
  if (!b.entity_name) return <></>;
  return (
    <div class={styles.refHead}>
      <h2 class={styles.ref}>{b.entity_name}</h2>
      {b.entity_type && (
        <span class={styles.translation}>{b.entity_type}</span>
      )}
    </div>
  );
}

function VerseOrContent(props: { block: Block }): JSX.Element {
  const b = props.block;
  if (b.scripture_verses && b.scripture_verses.length > 0) {
    return (
      <>
        {b.scripture_verses.map((v) => (
          <p class={styles.verse}>
            <span class={styles.verseNum}>{v.number}</span>
            <span class={styles.verseText}>{v.text}</span>
          </p>
        ))}
      </>
    );
  }
  return <p>{b.content}</p>;
}

function KindlingConnectionsSection(props: {
  outgoing: Link[];
  backlinks: Link[];
  linkedBlocks: Record<string, Block>;
  isKindling: boolean;
}): JSX.Element {
  if (
    !props.isKindling ||
    (props.outgoing.length === 0 && props.backlinks.length === 0)
  ) {
    return <></>;
  }
  return (
    <div class={styles.connectionsSection}>
      <p class={styles.connectionsTitle}>
        <IconLink size={ICON_PX.compact} /> Connections
      </p>
      <div class={styles.connections}>
        {props.outgoing.map((link) => (
          <span class={styles.connectionChipStatic}>
            {linkEndpointLabel(link, "to", props.linkedBlocks)}
          </span>
        ))}
        {props.backlinks.map((link) => (
          <span class={styles.connectionChipStatic}>
            {linkEndpointLabel(link, "from", props.linkedBlocks)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Connections library ──────────────────────────────────────────

function PassageConnectionsLibrary(props: {
  outgoing: Link[];
  backlinks: Link[];
  linkedBlocks: Record<string, Block>;
  isKindling: boolean;
  onNavigate: (id: string) => void;
}): JSX.Element {
  if (props.isKindling) return <></>;
  return (
    <>
      <LibraryOutgoingSection
        outgoing={props.outgoing}
        linkedBlocks={props.linkedBlocks}
        onNavigate={props.onNavigate}
      />
      <LibraryBacklinksSection
        backlinks={props.backlinks}
        linkedBlocks={props.linkedBlocks}
        onNavigate={props.onNavigate}
      />
    </>
  );
}

function LibraryOutgoingSection(props: {
  outgoing: Link[];
  linkedBlocks: Record<string, Block>;
  onNavigate: (id: string) => void;
}): JSX.Element {
  if (props.outgoing.length === 0) return <></>;
  return (
    <div>
      <p class={styles.sectionTitle}>Connected</p>
      <div class={styles.connections}>
        {props.outgoing.map((link) => (
          <button
            type="button"
            class={styles.connectionChip}
            onClick={() => {
              hapticSelection();
              props.onNavigate(link.to_block);
            }}
          >
            {linkEndpointLabel(link, "to", props.linkedBlocks)}
          </button>
        ))}
      </div>
    </div>
  );
}

function LibraryBacklinksSection(props: {
  backlinks: Link[];
  linkedBlocks: Record<string, Block>;
  onNavigate: (id: string) => void;
}): JSX.Element {
  if (props.backlinks.length === 0) return <></>;
  return (
    <div>
      <p class={styles.sectionTitle}>Referenced by</p>
      <div class={styles.connections}>
        {props.backlinks.map((link) => (
          <button
            type="button"
            class={styles.connectionChip}
            onClick={() => {
              hapticSelection();
              props.onNavigate(link.from_block);
            }}
          >
            {linkEndpointLabel(link, "from", props.linkedBlocks)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Decision panel ───────────────────────────────────────────────

function PassageDecisionPanel(props: {
  block: Block;
  lifeStage: LifeStageRecord | null;
  reflections: Reflection[];
  showSnooze: boolean;
  snoozeDate: string;
  startTs: number;
  passageId: string;
  isKindling: boolean;
  onKindlingAdvance?: () => void;
  onNote: (opts: PassageNoteAction) => void;
  setLifeStage: (v: LifeStageRecord | null) => void;
  setShowSnooze: (v: boolean) => void;
  setSnoozeDate: (v: string) => void;
  setReflections: (v: Reflection[]) => void;
}): JSX.Element {
  async function doAction(action: "stoke" | "deepen") {
    hapticMedium();
    const lingerSec = (Date.now() - props.startTs) / 1000;
    try {
      await recordLinger(props.passageId, lingerSec);
      if (action === "stoke") await stokeBlock(props.passageId);
      else await deepenBlock(props.passageId);
    } catch {
      /* ignore */
    }
    props.setLifeStage(await ensureLifeStage(props.passageId));
    props.onKindlingAdvance?.();
  }

  return (
    <div class={styles.decisionPanel}>
      <ScriptureReflectionSection
        block={props.block}
        reflections={props.reflections}
        passageId={props.passageId}
        onNote={props.onNote}
        setReflections={props.setReflections}
      />
      <SnoozeSection
        showSnooze={props.showSnooze}
        snoozeDate={props.snoozeDate}
        startTs={props.startTs}
        lifeStage={props.lifeStage}
        passageId={props.passageId}
        onKindlingAdvance={props.onKindlingAdvance}
        setLifeStage={props.setLifeStage}
        setShowSnooze={props.setShowSnooze}
        setSnoozeDate={props.setSnoozeDate}
      />
      <div class={styles.decisionPanelActions}>
        <div class={styles.actions}>
          <button
            type="button"
            class={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            onClick={() => void doAction("deepen")}
          >
            <IconCheckCircle size={ICON_PX.decisionStack} /> <span>Mastered</span>
          </button>
          <button
            type="button"
            class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => void doAction("stoke")}
          >
            <span class={styles.decisionArrowsOptical}>
              <IconArrowsClockwise size={ICON_PX.decisionStack} />
            </span>
            <span>Review later</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reflection section ───────────────────────────────────────────

function ScriptureReflectionSection(props: {
  block: Block;
  reflections: Reflection[];
  passageId: string;
  onNote: (opts: PassageNoteAction) => void;
  setReflections: (v: Reflection[]) => void;
}): JSX.Element {
  const b = props.block;
  if (b.type !== "scripture" || !b.scripture_display_ref) return <></>;

  return (
    <div class={styles.reflectionAddRow}>
      <button
        type="button"
        class={styles.tertiaryBtn}
        onClick={() => {
          hapticLight();
          props.onNote({
            passageId: b.id,
            displayRef: b.scripture_display_ref ?? "",
          });
        }}
      >
        <IconNotePencil size={ICON_PX.decisionPanel} />
        <span class={styles.tertiaryBtnLabel}>Add reflection</span>
      </button>
    </div>
  );
}

// ─── Snooze section ───────────────────────────────────────────────

function SnoozeSection(props: {
  showSnooze: boolean;
  snoozeDate: string;
  startTs: number;
  lifeStage: LifeStageRecord | null;
  passageId: string;
  onKindlingAdvance?: () => void;
  setLifeStage: (v: LifeStageRecord | null) => void;
  setShowSnooze: (v: boolean) => void;
  setSnoozeDate: (v: string) => void;
}): JSX.Element {
  async function snoozePresetDays(days: number) {
    hapticMedium();
    const lingerSec = (Date.now() - props.startTs) / 1000;
    await recordLinger(props.passageId, lingerSec);
    const until = new Date();
    until.setDate(until.getDate() + days);
    await snoozeBlock(props.passageId, until);
    props.setShowSnooze(false);
    props.setLifeStage(await ensureLifeStage(props.passageId));
    props.onKindlingAdvance?.();
  }

  async function snoozeCustomDate() {
    const d = props.snoozeDate;
    if (!d) return;
    hapticMedium();
    const lingerSec = (Date.now() - props.startTs) / 1000;
    await recordLinger(props.passageId, lingerSec);
    await snoozeBlock(props.passageId, new Date(`${d}T00:00:00`));
    props.setShowSnooze(false);
    props.setLifeStage(await ensureLifeStage(props.passageId));
    props.onKindlingAdvance?.();
  }

  const minDate = new Date().toISOString().split("T")[0]!;

  return (
    <div
      class={`${styles.tertiaryRow}${props.showSnooze ? ` ${styles.tertiaryRowSnoozeOpen}` : ""}`}
    >
      <button
        type="button"
        class={styles.tertiaryBtn}
        onClick={() => {
          hapticLight();
          props.setShowSnooze(!props.showSnooze);
        }}
        aria-expanded={props.showSnooze}
      >
        <IconClock size={ICON_PX.decisionPanel} />
        <span class={styles.tertiaryBtnLabel}>Snooze</span>
      </button>
      {props.showSnooze && (
        <div class={styles.snoozePanel}>
          <div class={styles.snoozePresets}>
            {[1, 3, 7, 30].map((days) => (
              <button
                type="button"
                class={styles.snoozePreset}
                onClick={() => void snoozePresetDays(days)}
              >
                {days}d
              </button>
            ))}
          </div>
          <div class={styles.snoozeCustom}>
            <input
              type="date"
              class={styles.snoozeInput}
              value={props.snoozeDate}
              min={minDate}
              onInput={(e) => props.setSnoozeDate(e.currentTarget.value)}
            />
            <button
              type="button"
              class={styles.snoozePreset}
              disabled={!props.snoozeDate}
              onClick={() => void snoozeCustomDate()}
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirm delete ───────────────────────────────────────────────

function PassageConfirmDelete(props: {
  passageId: string;
  onDeleted: () => void;
  onCancel: () => void;
}): JSX.Element {
  async function doDelete() {
    hapticHeavy();
    await deleteBlock(props.passageId);
    props.onDeleted();
  }
  return (
    <div class={styles.deleteOverlay} onClick={props.onCancel}>
      <div class={styles.deleteCard} onClick={(e) => e.stopPropagation()}>
        <h2 class={styles.deleteTitle}>Delete this passage?</h2>
        <p class={styles.deleteBody}>This can't be undone.</p>
        <div class={styles.deleteActions}>
          <button
            type="button"
            class={styles.deleteBtnNo}
            onClick={props.onCancel}
          >
            No, keep it
          </button>
          <button
            type="button"
            class={styles.deleteBtnYes}
            onClick={() => void doDelete()}
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}
