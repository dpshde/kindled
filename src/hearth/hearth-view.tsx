import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import {
  findScriptureBlockByCanonicalRef,
  getAllBlocks,
  getLifeStage,
  searchBlocks,
  updateScripturePassageData,
  type Block,
  type LifeStageRecord,
  type Verse,
} from "../db";
import { resolvePassage } from "../scripture/RouteBibleClient";
import { parseInputToPassage } from "../capture/scripture-capture-helpers";
import { nextReviewPresentation } from "../ui/helpers";
import {
  IconArrowSquareUpRight,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileCloud,
  IconFileText,
  IconFire,
  IconFloppyDisk,
  IconMagnifyingGlass,
  IconPencilSimple,
  IconPlus,
  IconX,
} from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import shell from "../ui/app-shell.module.css";
import styles from "./HearthView.module.css";
import { hapticLight, hapticMedium, hapticSave } from "../haptics";
import { hearthTypeIcon } from "./hearth-type-icon";
import { downloadExport, exportAllData, type ExportFormat } from "../db/export";
import { isTauriRuntime } from "../sync/tauri-file-store";
import { getSyncState, onSyncStateChange, type SyncState } from "../sync/file-sync";
import { SyncSettingsView } from "../sync/SyncSettings";
import { ThemeToggle } from "../ui/theme-toggle";


export function HearthView(props: {
  onCapture: () => void;
  onSelect: (blockId: string) => void;
  onNavigateHome: () => void;
}): JSX.Element {
  const [blocks, setBlocks] = createSignal<Block[]>([]);
  const [stages, setStages] = createSignal<Record<string, LifeStageRecord>>({});
  const [query, setQuery] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [exporting, setExporting] = createSignal(false);
  const [showExportMenu, setShowExportMenu] = createSignal(false);
  const [copiedExport, setCopiedExport] = createSignal(false);
  const [showSync, setShowSync] = createSignal(false);
  const [editingPassage, setEditingPassage] = createSignal<Block | null>(null);
  const [syncState, setSyncState] = createSignal<SyncState>(getSyncState());

  const unsub = onSyncStateChange((s) => {
    setSyncState({ ...s });
  });
  onCleanup(() => unsub());

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    void bootstrapHearth();
  });

  async function refreshVisibleBlocks(search = query().trim()) {
    const nextBlocks = search ? await searchBlocks(search) : await getAllBlocks();
    setBlocks(nextBlocks);
    setStages(await loadStageMap(nextBlocks));
  }

  async function bootstrapHearth() {
    try {
      await refreshVisibleBlocks();
    } finally {
      setLoading(false);
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

  function handleSearch(val: string) {
    setQuery(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!val.trim()) {
      debounceTimer = undefined;
      void refreshVisibleBlocks("");
      return;
    }
    debounceTimer = setTimeout(async () => {
      await refreshVisibleBlocks(val.trim());
    }, 200);
  }

  let exportMenuRef: HTMLDivElement | undefined;

  function closeExportMenu() {
    setShowExportMenu(false);
  }

  createEffect(() => {
    if (!showExportMenu()) return;
    const onClickOutside = (e: MouseEvent) => {
      if (exportMenuRef && !exportMenuRef.contains(e.target as Node)) {
        closeExportMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExportMenu();
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    });
  });

  async function handleExportFormat(format: ExportFormat) {
    setExporting(true);
    closeExportMenu();
    setCopiedExport(false);
    try {
      const payload = await exportAllData();
      if (isTauriRuntime()) {
        try {
          await downloadExport(payload, format);
          return;
        } catch {
          // cancelled or unsupported
        }
      }
      await downloadExport(payload, format);
    } finally {
      setTimeout(() => setExporting(false), 1200);
    }
  }

  async function handleExportCopyText() {
    closeExportMenu();
    try {
      const payload = await exportAllData();
      const text = payload.data.blocks
        .map((b) => {
          const title = b.scripture_display_ref ?? b.entity_name ?? "Note";
          const ref = b.scripture_ref ? ` (${b.scripture_ref})` : "";
          return `${title}${ref}\n${b.content}`;
        })
        .join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 1400);
    } catch {
      /* clipboard not available */
    }
  }

  const syncToneClass = () => {
    const sync = syncState();
    if (sync.syncing) return styles.syncBtnSyncing;
    if (sync.status === "attached") return styles.syncBtnAttached;
    if (sync.status === "needs-permission") return styles.syncBtnNeedsPermission;
    return styles.syncBtnIdle;
  };

  const syncLabel = () => {
    const sync = syncState();
    if (sync.syncing) return "Sync settings (syncing)";
    if (sync.status === "attached") return `Sync settings (connected${sync.fileName ? `: ${sync.fileName}` : ""})`;
    if (sync.status === "needs-permission") return "Sync settings (permission needed)";
    if (sync.status === "unsupported") return "Sync settings (unsupported here)";
    return "Sync settings (not connected)";
  };

  const listContent = (): JSX.Element => {
    if (loading()) {
      return <p class={styles.empty}>Loading...</p>;
    }
    const currentBlocks = blocks();
    if (currentBlocks.length === 0) {
      return (
        <div class={styles.empty}>
          <span class={styles.emptyIcon}>
            <IconFire size={ICON_PX.hero} />
          </span>
          <p>
            {query()
              ? "No results found."
              : "Your hearth is empty—capture a passage to kindle a flame."}
          </p>
        </div>
      );
    }
    const currentStages = stages();
    return (
      <>
        {currentBlocks.map((block) => (
          <HearthCard
            block={block}
            stage={currentStages[block.id]}
            onSelect={props.onSelect}
            onEdit={(editable) => setEditingPassage(editable)}
          />
        ))}
      </>
    );
  };

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={`${shell.header} ${styles.hearthHeader}`}>
          <div class={shell.headerNav}>
            <button
              type="button"
              class={shell.logoBtn}
              onClick={() => {
                hapticLight();
                props.onNavigateHome();
              }}
              aria-label="Home"
            >
              <IconFire size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <h1 class={shell.headerTitle}>Hearth</h1>
            <Show when={!loading() && blocks().length > 0}>
              <span class={styles.hearthCount}>
                {blocks().length} {blocks().length === 1 ? "passage" : "passages"}
              </span>
            </Show>
          </div>
          <div class={shell.headerActions}>
            <ThemeToggle class={shell.headerBtn} />
            <button
              type="button"
              class={`${shell.headerBtn} ${syncToneClass()}`}
              onClick={() => {
                hapticLight();
                setShowSync(true);
              }}
              aria-label={syncLabel()}
              title={syncLabel()}
            >
              <IconFileCloud size={ICON_PX.header} />
            </button>
            <div class={styles.exportWrap} ref={exportMenuRef}>
              <button
                type="button"
                class={shell.headerBtn}
                disabled={exporting()}
                onClick={() => {
                  hapticLight();
                  setShowExportMenu((v) => !v);
                }}
                aria-label="Export"
                aria-expanded={showExportMenu()}
              >
                <Show when={copiedExport()} fallback={<IconArrowSquareUpRight size={ICON_PX.header} />}>
                  <IconCheck size={ICON_PX.header} />
                </Show>
              </button>
              <Show when={showExportMenu()}>
                <div class={styles.exportMenu} role="menu">
                  <button
                    type="button"
                    class={styles.exportMenuItem}
                    role="menuitem"
                    onClick={() => {
                      hapticLight();
                      void handleExportFormat("json");
                    }}
                  >
                    <span class={styles.exportMenuIcon}><IconFileText size={ICON_PX.inline} /></span>
                    <span class={styles.exportMenuLabel}>JSON</span>
                    <span class={styles.exportMenuHint}>Full data</span>
                  </button>
                  <button
                    type="button"
                    class={styles.exportMenuItem}
                    role="menuitem"
                    onClick={() => {
                      hapticLight();
                      void handleExportFormat("csv");
                    }}
                  >
                    <span class={styles.exportMenuIcon}><IconDownload size={ICON_PX.inline} /></span>
                    <span class={styles.exportMenuLabel}>CSV</span>
                    <span class={styles.exportMenuHint}>Spreadsheet</span>
                  </button>
                  <button
                    type="button"
                    class={styles.exportMenuItem}
                    role="menuitem"
                    onClick={() => {
                      hapticLight();
                      void handleExportFormat("markdown");
                    }}
                  >
                    <span class={styles.exportMenuIcon}><IconFileText size={ICON_PX.inline} /></span>
                    <span class={styles.exportMenuLabel}>Markdown</span>
                    <span class={styles.exportMenuHint}>Readable</span>
                  </button>
                  <button
                    type="button"
                    class={styles.exportMenuItem}
                    role="menuitem"
                    onClick={() => {
                      hapticLight();
                      void handleExportFormat("text");
                    }}
                  >
                    <span class={styles.exportMenuIcon}><IconDownload size={ICON_PX.inline} /></span>
                    <span class={styles.exportMenuLabel}>Plain text</span>
                    <span class={styles.exportMenuHint}>Simple list</span>
                  </button>
                  <div class={styles.exportMenuDivider} />
                  <button
                    type="button"
                    class={styles.exportMenuItem}
                    role="menuitem"
                    onClick={() => {
                      hapticLight();
                      void handleExportCopyText();
                    }}
                  >
                    <span class={styles.exportMenuIcon}><IconCopy size={ICON_PX.inline} /></span>
                    <span class={styles.exportMenuLabel}>Copy text</span>
                    <span class={styles.exportMenuHint}>Clipboard</span>
                  </button>
                </div>
              </Show>
            </div>
            <button
              type="button"
              class={shell.headerBtnPrimary}
              onClick={() => {
                hapticMedium();
                props.onCapture();
              }}
              aria-label="Add passage"
            >
              <IconPlus size={ICON_PX.header} />
            </button>
          </div>
        </header>
        <div class={shell.main}>
          <div class={`${shell.shellContent} ${styles.hearthContent}`}>
            <div class={styles.search}>
              <span class={styles.searchIcon}>
                <IconMagnifyingGlass size={ICON_PX.inline} />
              </span>
              <input
                type="text"
                placeholder="Search what you've kindled..."
                class={styles.searchInput}
                value={query()}
                onInput={(e) => handleSearch(e.currentTarget.value)}
              />
            </div>
            <div class={styles.list}>{listContent()}</div>
          </div>
        </div>
      </div>
      {showSync() && (
        <SyncSettingsView
          onClose={() => setShowSync(false)}
          onSynced={() => void bootstrapHearth()}
        />
      )}
      {editingPassage() && (
        <HearthPassageEditModal
          block={editingPassage()!}
          onClose={() => {
            hapticLight();
            setEditingPassage(null);
          }}
          onSaved={async () => {
            await refreshVisibleBlocks();
            setEditingPassage(null);
          }}
        />
      )}
    </div>
  );
}

function HearthCard(props: {
  block: Block;
  stage?: LifeStageRecord;
  onSelect: (id: string) => void;
  onEdit: (block: Block) => void;
}): JSX.Element {
  const ls = () => props.stage;
  const rhythm = () => (ls() ? nextReviewPresentation(ls()!.next_review_at) : null);
  const TypeIcon = hearthTypeIcon(props.block.type);
  const title = props.block.scripture_display_ref ?? props.block.entity_name ?? "Note";
  const sub =
    props.block.content.slice(0, 80) +
    (props.block.content.length > 80 ? "..." : "");

  const editable = props.block.type === "scripture";

  return (
    <div class={`${styles.cardWrap}${editable ? ` ${styles.cardWrapEditable}` : ""}`}>
      <button
        type="button"
        class={`${styles.card}${editable ? ` ${styles.cardEditable}` : ""}`}
        onClick={() => {
          hapticLight();
          props.onSelect(props.block.id);
        }}
      >
        <div class={styles.cardIcon}>
          {TypeIcon({ size: ICON_PX.inline })}
        </div>
        <div class={styles.cardContent}>
          <span class={styles.cardTitle}>{title}</span>
          {rhythm() && (
            <span class={styles.cardRhythm}>
              {rhythm()!.dateMedium}
            </span>
          )}
          <span class={styles.cardSub}>{sub}</span>
        </div>
      </button>
      {editable && (
        <button
          type="button"
          class={styles.cardEditBtn}
          aria-label={`Edit ${title}`}
          title="Edit passage"
          onClick={(e) => {
            e.stopPropagation();
            hapticLight();
            props.onEdit(props.block);
          }}
        >
          <IconPencilSimple size={ICON_PX.inline} />
        </button>
      )}
    </div>
  );
}

function normalizePassageEditorText(text: string): string {
  return text.trim().replace(/\s*\n+\s*/g, " ");
}

function HearthPassageEditModal(props: {
  block: Block;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const initialVerses = props.block.scripture_verses ?? [];
  const [canonicalRef, setCanonicalRef] = createSignal(props.block.scripture_ref ?? "");
  const [displayRef, setDisplayRef] = createSignal(
    props.block.scripture_display_ref ?? props.block.scripture_ref ?? "",
  );
  const [translation, setTranslation] = createSignal(props.block.scripture_translation ?? "");
  const [verses, setVerses] = createSignal<Verse[]>(initialVerses);
  const [verseDrafts, setVerseDrafts] = createSignal(initialVerses.map((verse) => verse.text));
  const [contentDraft, setContentDraft] = createSignal(props.block.content);
  const [saving, setSaving] = createSignal(false);
  const [resolvingReference, setResolvingReference] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  function applyResolvedPassage(
    resolved: { ref: string; displayRef: string; translation: string; verses: Verse[] } | null,
  ) {
    if (!resolved) return;
    const nextDrafts = resolved.verses.map((verse: Verse) => verse.text);
    setCanonicalRef(resolved.ref);
    setDisplayRef(resolved.displayRef);
    setTranslation(resolved.translation);
    setVerses(resolved.verses);
    setVerseDrafts(nextDrafts);
    setContentDraft(nextDrafts.join(" "));
  }

  createEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    const typedRef = displayRef().trim();
    const parsed = parseInputToPassage(typedRef);
    if (!typedRef || !parsed || parsed.canonical === canonicalRef()) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setResolvingReference(true);
      const resolved = await resolvePassage(parsed.canonical);
      if (cancelled) return;
      setResolvingReference(false);
      if (!resolved) {
        setError("Couldn't resolve that passage reference.");
        return;
      }
      applyResolvedPassage(resolved);
      setError(null);
    }, 320);

    onCleanup(() => {
      cancelled = true;
      window.clearTimeout(timer);
    });
  });

  async function handleSave() {
    const parsed = parseInputToPassage(displayRef());
    if (!parsed) {
      setError("Enter a valid passage reference.");
      return;
    }

    setSaving(true);
    setError(null);
    hapticSave();

    try {
      let nextCanonical = canonicalRef();
      let nextDisplayRef = displayRef().trim() || props.block.scripture_ref || "Passage";
      let nextTranslation = translation().trim();
      let nextVersesSource = verses();
      let nextVerseDrafts = verseDrafts();

      if (parsed.canonical !== canonicalRef()) {
        setResolvingReference(true);
        const resolved = await resolvePassage(parsed.canonical);
        setResolvingReference(false);
        if (!resolved) {
          setError("Couldn't resolve that passage reference.");
          return;
        }
        applyResolvedPassage(resolved);
        nextCanonical = resolved.ref;
        nextDisplayRef = resolved.displayRef;
        nextTranslation = resolved.translation;
        nextVersesSource = resolved.verses;
        nextVerseDrafts = resolved.verses.map((verse: Verse) => verse.text);
      }

      const duplicate = await findScriptureBlockByCanonicalRef(nextCanonical);
      if (duplicate && duplicate.id !== props.block.id) {
        setError("That passage already exists in your hearth.");
        return;
      }

      const nextVerses: Verse[] = nextVersesSource.length
        ? nextVersesSource.map((verse, index) => ({
            ...verse,
            text: normalizePassageEditorText(nextVerseDrafts[index] ?? ""),
          }))
        : [];
      const nextContent = nextVerses.length
        ? nextVerses.map((verse) => verse.text).filter(Boolean).join(" ")
        : normalizePassageEditorText(contentDraft());

      if (!nextContent) {
        setError("Passage text can't be empty.");
        return;
      }

      await updateScripturePassageData(props.block.id, {
        content: nextContent,
        scripture_ref: nextCanonical,
        scripture_display_ref: nextDisplayRef,
        scripture_translation: nextTranslation,
        scripture_verses: nextVerses,
      });
      await props.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save passage");
    } finally {
      setSaving(false);
      setResolvingReference(false);
    }
  }

  return (
    <div class={styles.editOverlay} onClick={props.onClose} role="dialog" aria-modal="true">
      <div class={styles.editPanel} onClick={(e) => e.stopPropagation()}>
        <header class={styles.editHeader}>
          <div>
            <p class={styles.editEyebrow}>Passage editor</p>
            <h2 class={styles.editTitle}>{displayRef().trim() || "Edit passage"}</h2>
          </div>
          <button
            type="button"
            class={styles.editCloseBtn}
            onClick={props.onClose}
            aria-label="Close editor"
          >
            <IconX size={ICON_PX.inline} />
          </button>
        </header>

        <div class={styles.editBody}>
          <p class={styles.editHint}>
            Change the reference and Kindled will pull fresh passage text automatically before
            you save.
          </p>

          <div class={styles.editMetaGrid}>
            <label class={styles.editField}>
              <span class={styles.editLabel}>Reference</span>
              <input
                type="text"
                value={displayRef()}
                onInput={(e) => {
                  setDisplayRef(e.currentTarget.value);
                  setError(null);
                }}
                placeholder="2 Corinthians 12:9"
              />
            </label>
            <label class={styles.editField}>
              <span class={styles.editLabel}>Translation</span>
              <input
                type="text"
                value={translation()}
                onInput={(e) => setTranslation(e.currentTarget.value)}
                placeholder="BSB"
              />
            </label>
          </div>

          {resolvingReference() && (
            <p class={styles.editStatus}>Pulling the matching passage text…</p>
          )}

          {verses().length > 0 ? (
            <div class={styles.editVerseList}>
              {verses().map((verse, index) => (
                <label class={styles.editVerseRow}>
                  <span class={styles.editVerseNumber}>Verse {verse.number}</span>
                  <textarea
                    class={styles.editTextarea}
                    rows={3}
                    value={verseDrafts()[index] ?? ""}
                    onInput={(e) => {
                      const next = [...verseDrafts()];
                      next[index] = e.currentTarget.value;
                      setVerseDrafts(next);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : (
            <label class={styles.editField}>
              <span class={styles.editLabel}>Passage text</span>
              <textarea
                class={styles.editTextarea}
                rows={8}
                value={contentDraft()}
                onInput={(e) => setContentDraft(e.currentTarget.value)}
              />
            </label>
          )}

          {error() && <p class={styles.editError}>{error()}</p>}
        </div>

        <footer class={styles.editFooter}>
          <button type="button" class={styles.editSecondaryBtn} onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            class={styles.editPrimaryBtn}
            disabled={saving() || resolvingReference()}
            onClick={() => void handleSave()}
          >
            <IconFloppyDisk size={ICON_PX.inline} />
            {saving() ? "Saving..." : resolvingReference() ? "Updating..." : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
