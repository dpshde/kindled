import {
  For,
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
  IconBookOpen,
  IconCopy,
  IconDownload,
  IconFileCloud,
  IconFileText,
  IconFire,
  IconFloppyDisk,
  IconGear,
  IconMagnifyingGlass,
  IconPencilSimple,
  IconPlus,
  IconSun,
  IconMoon,
  IconX,
} from "../ui/icons/icons";
import shell from "../ui/app-shell.module.css";
import styles from "./HearthView.module.css";
import { hapticLight, hapticMedium, hapticSave, hapticSelection } from "../haptics";
import { hearthTypeIcon } from "./hearth-type-icon";
import { downloadExport, exportAllData, type ExportFormat } from "../db/export";
import { getSyncState, onSyncStateChange, onSyncDataApplied, type SyncState } from "../sync/hosted-sync";
import { SyncSettingsView } from "../sync/SyncSettings";
import { toggleTheme, getCurrentTheme } from "../ui/theme";
import { ICON_PX } from "../ui/icon-sizes";



export function HearthView(props: {
  onCapture: () => void;
  onSelect: (blockId: string) => void;
  onNavigateHome: () => void;
}): JSX.Element {
  const [blocks, setBlocks] = createSignal<Block[]>([]);
  const [stages, setStages] = createSignal<Record<string, LifeStageRecord>>({});
  const [query, setQuery] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [showSync, setShowSync] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [showExportSubmenu, setShowExportSubmenu] = createSignal(false);
  const [showBookFilter, setShowBookFilter] = createSignal(false);
  const [selectedBook, setSelectedBook] = createSignal<string | null>(null);
  const [editingPassage, setEditingPassage] = createSignal<Block | null>(null);
  const [syncState, setSyncState] = createSignal<SyncState>(getSyncState());
  const [theme, setTheme] = createSignal<"light" | "dark">(getCurrentTheme());

  const unsub = onSyncStateChange((s) => {
    setSyncState({ ...s });
  });
  const unsubDataApplied = onSyncDataApplied(() => {
    void bootstrapHearth();
  });
  onCleanup(() => {
    unsub();
    unsubDataApplied();
  });

  const uniqueBooks = () => {
    const bookSet = new Set<string>();
    for (const b of blocks()) {
      if (b.scripture_display_ref) {
        // Extract book name (everything before the last number)
        const match = b.scripture_display_ref.match(/^(.+?)\s*\d/);
        if (match) bookSet.add(match[1]!.trim());
      }
    }
    return [...bookSet].sort();
  };

  const displayBlocks = () => {
    const allBlocks = blocks();
    const book = selectedBook();
    if (!book) return allBlocks;
    return allBlocks.filter((b) => {
      if (!b.scripture_display_ref) return false;
      return b.scripture_display_ref.startsWith(book);
    });
  };

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

  let bookFilterRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!showBookFilter()) return;
    const onClickOutside = (e: MouseEvent) => {
      if (bookFilterRef && !bookFilterRef.contains(e.target as Node)) {
        setShowBookFilter(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBookFilter(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    });
  });

  async function handleExportFormat(format: ExportFormat) {
    setShowSettings(false);
    setShowExportSubmenu(false);
    try {
      const payload = await exportAllData();
      await downloadExport(payload, format);
    } catch {
      // cancelled or unsupported
    }
  }

  async function handleExportCopyText() {
    setShowSettings(false);
    setShowExportSubmenu(false);
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
    } catch {
      /* clipboard not available */
    }
  }

  const listContent = (): JSX.Element => {
    if (loading()) {
      return <p class={styles.empty}>Loading...</p>;
    }
    const currentBlocks = displayBlocks();
    if (currentBlocks.length === 0) {
      return (
        <div class={styles.empty}>
          <span class={styles.emptyIcon}>
            <IconFire size={ICON_PX.hero} />
          </span>
          <p>
            {query() || selectedBook()
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
            <button
              type="button"
              class={shell.headerBtn}
              onClick={() => {
                hapticLight();
                setShowSettings(true);
              }}
              aria-label="Settings"
            >
              <IconGear size={ICON_PX.header} />
            </button>
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
            <div class={styles.searchRow}>
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
              <Show when={uniqueBooks().length > 1}>
                <div class={styles.bookFilterWrap} ref={(el) => { bookFilterRef = el; }}>
                  <button
                    type="button"
                    class={`${styles.bookFilterBtn}${selectedBook() ? ` ${styles.bookFilterBtnActive}` : ""}`}
                    onClick={() => {
                      hapticLight();
                      if (selectedBook()) {
                        setSelectedBook(null);
                      } else {
                        setShowBookFilter((v) => !v);
                      }
                    }}
                    aria-label="Filter by book"
                    aria-expanded={showBookFilter()}
                  >
                    <IconBookOpen size={ICON_PX.inline} />
                  </button>
                  <Show when={showBookFilter()}>
                    <div class={styles.bookFilterMenu} role="menu">
                      <button
                        type="button"
                        class={styles.bookFilterItem}
                        role="menuitem"
                        onClick={() => {
                          hapticLight();
                          setSelectedBook(null);
                          setShowBookFilter(false);
                        }}
                      >
                        All books
                      </button>
                      <For each={uniqueBooks()}>
                        {(book) => (
                          <button
                            type="button"
                            class={`${styles.bookFilterItem}${selectedBook() === book ? ` ${styles.bookFilterItemActive}` : ""}`}
                            role="menuitem"
                            onClick={() => {
                              hapticSelection();
                              setSelectedBook(book);
                              setShowBookFilter(false);
                            }}
                          >
                            {book}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
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
      {showSettings() && (
        <HearthSettingsOverlay
          theme={theme()}
          syncStatus={syncState().status}
          showExportSubmenu={showExportSubmenu()}
          onToggleTheme={() => {
            hapticLight();
            setTheme(toggleTheme());
          }}
          onOpenSync={() => {
            setShowSettings(false);
            setShowSync(true);
          }}
          onToggleExport={() => setShowExportSubmenu((v) => !v)}
          onExport={(fmt) => void handleExportFormat(fmt)}
          onCopyAllText={() => void handleExportCopyText()}
          onClose={() => {
            setShowSettings(false);
            setShowExportSubmenu(false);
          }}
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

function HearthSettingsOverlay(props: {
  theme: "light" | "dark";
  syncStatus: SyncState["status"];
  showExportSubmenu: boolean;
  onToggleTheme: () => void;
  onOpenSync: () => void;
  onToggleExport: () => void;
  onExport: (fmt: ExportFormat) => void;
  onCopyAllText: () => void;
  onClose: () => void;
}): JSX.Element {
  createEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  return (
    <div class={styles.settingsOverlay} onClick={props.onClose}>
      <div class={styles.settingsPanel} onClick={(e) => e.stopPropagation()}>
        <header class={styles.settingsHeader}>
          <h2 class={styles.settingsTitle}>Settings</h2>
          <button
            type="button"
            class={styles.settingsCloseBtn}
            onClick={props.onClose}
            aria-label="Close"
          >
            <IconX size={ICON_PX.inline} />
          </button>
        </header>
        <div class={styles.settingsBody}>
          <button
            type="button"
            class={styles.settingsRow}
            onClick={props.onToggleTheme}
          >
            <span class={styles.settingsRowIcon}>
              <Show when={props.theme === "dark"} fallback={<IconMoon size={ICON_PX.inline} />}>
                <IconSun size={ICON_PX.inline} />
              </Show>
            </span>
            <span class={styles.settingsRowLabel}>
              {props.theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          <button
            type="button"
            class={styles.settingsRow}
            onClick={props.onOpenSync}
          >
            <span class={styles.settingsRowIcon}>
              <IconFileCloud size={ICON_PX.inline} />
            </span>
            <span class={styles.settingsRowLabel}>Sync</span>
            <Show when={props.syncStatus === "connected"}>
              <span class={styles.settingsRowHint}>Connected</span>
            </Show>
            <Show when={props.syncStatus === "syncing" || props.syncStatus === "provisioning"}>
              <span class={styles.settingsRowHint}>Syncing</span>
            </Show>
            <Show when={props.syncStatus === "offline-pending"}>
              <span class={styles.settingsRowHint}>Changes waiting</span>
            </Show>
            <Show when={props.syncStatus === "awaiting-code"}>
              <span class={styles.settingsRowHint}>Check email</span>
            </Show>
            <Show when={props.syncStatus === "error"}>
              <span class={styles.settingsRowHint}>Needs attention</span>
            </Show>
          </button>
          <button
            type="button"
            class={styles.settingsRow}
            onClick={props.onToggleExport}
          >
            <span class={styles.settingsRowIcon}>
              <IconArrowSquareUpRight size={ICON_PX.inline} />
            </span>
            <span class={styles.settingsRowLabel}>Export</span>
            <span class={styles.settingsRowChevron}>
              {props.showExportSubmenu ? "▴" : "▾"}
            </span>
          </button>
          <Show when={props.showExportSubmenu}>
            <div class={styles.settingsSubmenu}>
              <button type="button" class={styles.settingsRow} onClick={() => props.onExport("json")}>
                <span class={styles.settingsRowIcon}><IconFileText size={ICON_PX.inline} /></span>
                <span class={styles.settingsRowLabel}>JSON</span>
                <span class={styles.settingsRowHint}>Full data</span>
              </button>
              <button type="button" class={styles.settingsRow} onClick={() => props.onExport("csv")}>
                <span class={styles.settingsRowIcon}><IconDownload size={ICON_PX.inline} /></span>
                <span class={styles.settingsRowLabel}>CSV</span>
                <span class={styles.settingsRowHint}>Spreadsheet</span>
              </button>
              <button type="button" class={styles.settingsRow} onClick={() => props.onExport("markdown")}>
                <span class={styles.settingsRowIcon}><IconFileText size={ICON_PX.inline} /></span>
                <span class={styles.settingsRowLabel}>Markdown</span>
                <span class={styles.settingsRowHint}>Readable</span>
              </button>
              <button type="button" class={styles.settingsRow} onClick={() => props.onExport("text")}>
                <span class={styles.settingsRowIcon}><IconDownload size={ICON_PX.inline} /></span>
                <span class={styles.settingsRowLabel}>Plain text</span>
                <span class={styles.settingsRowHint}>Simple list</span>
              </button>
              <div class={styles.settingsDivider} />
              <button type="button" class={styles.settingsRow} onClick={props.onCopyAllText}>
                <span class={styles.settingsRowIcon}><IconCopy size={ICON_PX.inline} /></span>
                <span class={styles.settingsRowLabel}>Copy all text</span>
                <span class={styles.settingsRowHint}>Clipboard</span>
              </button>
            </div>
          </Show>
        </div>
      </div>
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
