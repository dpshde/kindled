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
  getArchivedBlocks,
  restoreBlock,
  archiveBlock,
  type Block,
  type LifeStageRecord,
  type Verse,
} from "../db";
import {
  fetchAvailableTranslations,
  resolvePassageFromHelloAO,
  formatTranslationId,
  type TranslationInfo,
} from "../scripture/HelloAOBibleClient";
import { parseInputToPassage } from "../capture/scripture-capture-helpers";
import { nextReviewPresentation } from "../ui/helpers";
import {
  IconArrowSquareUpRight,
  IconBookOpen,
  IconCheck,
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
  IconTrash,
  IconX,
} from "../ui/icons/icons";
import shell from "../ui/app-shell.module.css";
import styles from "./HearthView.module.css";
import {
  hapticLight,
  hapticMedium,
  hapticSave,
  hapticSelection,
  hapticWarning,
} from "../haptics";
import { hearthTypeIcon } from "./hearth-type-icon";
import { downloadExport, exportAllData, type ExportFormat } from "../db/export";
import {
  getConnectedAddress,
  connectWallet,
  syncLocalDbWithMemoLog,
  disconnectWallet,
  waitForWallets,
  WALLET_INSTALL_LINKS,
  type WalletInfo,
} from "../solana";
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
  const [showSettings, setShowSettings] = createSignal(false);
  const [showExportSubmenu, setShowExportSubmenu] = createSignal(false);
  const [showBookFilter, setShowBookFilter] = createSignal(false);
  const [selectedBook, setSelectedBook] = createSignal<string | null>(null);
  const [editingPassage, setEditingPassage] = createSignal<Block | null>(null);
  const [walletAddress, setWalletAddress] = createSignal(getConnectedAddress());
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [connectError, setConnectError] = createSignal<string | null>(null);
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [showWalletPicker, setShowWalletPicker] = createSignal(false);
  const [availableWallets, setAvailableWallets] = createSignal<WalletInfo[]>(
    [],
  );
  const [showTrash, setShowTrash] = createSignal(false);
  const [archivedBlocks, setArchivedBlocks] = createSignal<Block[]>([]);
  const [theme, setTheme] = createSignal<"light" | "dark">(getCurrentTheme());
  const [shiftHeld, setShiftHeld] = createSignal(false);

  // If a wallet was already trusted/cached, pull on-chain memos on mount.
  if (walletAddress()) {
    void (async () => {
      try {
        setIsSyncing(true);
        const { added } = await syncLocalDbWithMemoLog();
        if (added > 0) {
          console.log(
            `[SolanaSync] Restored ${added} passage(s) from on-chain backup`,
          );
        }
        await bootstrapHearth();
      } catch (err) {
        console.error("[SolanaSync] Auto-sync on mount failed:", err);
      } finally {
        setIsSyncing(false);
      }
    })();
  }

  async function handleConnectWallet() {
    setConnectError(null);
    setIsConnecting(true);
    const wallets = await waitForWallets(2500);
    setIsConnecting(false);
    if (wallets.length === 0) {
      setAvailableWallets([]);
      setShowWalletPicker(true);
      return;
    }
    if (wallets.length === 1) {
      await doConnect(wallets[0]);
      return;
    }
    setAvailableWallets(wallets);
    setShowWalletPicker(true);
  }

  async function doConnect(wallet: WalletInfo) {
    setIsConnecting(true);
    try {
      const address = await connectWallet(wallet.provider);
      setWalletAddress(address);
      setIsSyncing(true);
      const { added } = await syncLocalDbWithMemoLog();
      if (added > 0) {
        console.log(
          `[SolanaSync] Restored ${added} passage(s) from on-chain backup`,
        );
      }
      await bootstrapHearth();
      setShowSettings(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Wallet connection failed";
      setConnectError(msg);
      console.error("[SolanaSync] Wallet connect failed:", err);
    } finally {
      setIsConnecting(false);
      setIsSyncing(false);
      setShowWalletPicker(false);
    }
  }

  async function handleDisconnectWallet() {
    setConnectError(null);
    try {
      await disconnectWallet();
      setWalletAddress(null);
      setShowSettings(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Disconnect failed";
      setConnectError(msg);
      console.error("[SolanaSync] Disconnect failed:", err);
    }
  }

  async function loadArchivedBlocks() {
    const blocks = await getArchivedBlocks();
    setArchivedBlocks(blocks);
  }

  async function handleRestore(id: string) {
    await restoreBlock(id);
    setArchivedBlocks((prev) => prev.filter((b) => b.id !== id));
    void bootstrapHearth();
  }

  async function handleArchive(id: string) {
    hapticWarning();
    await archiveBlock(id);
    void bootstrapHearth();
  }

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

  const chaptersForBook = (book: string): number[] => {
    const chapters = new Set<number>();
    for (const b of blocks()) {
      if (!b.scripture_display_ref || !b.scripture_display_ref.startsWith(book))
        continue;
      const rest = b.scripture_display_ref.slice(book.length).trim();
      const m = rest.match(/^(\d+)/);
      if (m) chapters.add(parseInt(m[1]!, 10));
    }
    return [...chapters].sort((a, b) => a - b);
  };

  const [expandedBook, setExpandedBook] = createSignal<string | null>(null);

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

  createEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    onCleanup(() => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    });
  });

  async function refreshVisibleBlocks(search = query().trim()) {
    const nextBlocks = search
      ? await searchBlocks(search)
      : await getAllBlocks();
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

  async function loadStageMap(
    bs: Block[],
  ): Promise<Record<string, LifeStageRecord>> {
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

  createEffect(() => {
    if (!showBookFilter()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBookFilter(false);
        setExpandedBook(null);
      }
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
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
      const isEmptyState = !query() && !selectedBook();
      return (
        <div class={isEmptyState ? styles.emptyState : styles.empty}>
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
            shiftHeld={shiftHeld}
            onArchive={handleArchive}
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
          <div class={styles.headerSpacer} />
          <div class={shell.headerActions}>
            <button
              type="button"
              class={styles.headerBtnSecondary}
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
              class={styles.headerBtnPrimary}
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
            <Show
              when={
                !loading() &&
                blocks().length === 0 &&
                !query() &&
                !selectedBook()
              }
            >
              <button
                type="button"
                class={styles.emptyStateCta}
                onClick={() => {
                  hapticMedium();
                  props.onCapture();
                }}
              >
                <IconPlus size={ICON_PX.inline} />
                Capture a passage
              </button>
            </Show>
            <Show when={blocks().length > 0 || query() || selectedBook()}>
              <div class={styles.searchRow}>
                <div class={styles.search}>
                  <span class={styles.searchIcon}>
                    <IconMagnifyingGlass size={ICON_PX.inline} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search passages..."
                    class={styles.searchInput}
                    value={query()}
                    onInput={(e) => handleSearch(e.currentTarget.value)}
                  />
                </div>
                <Show when={uniqueBooks().length > 1}>
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
                  >
                    <IconBookOpen size={ICON_PX.inline} />
                  </button>
                </Show>
              </div>
            </Show>
            <div class={styles.list}>{listContent()}</div>
          </div>
        </div>
      </div>
      {showBookFilter() && (
        <BookFilterSheet
          books={uniqueBooks()}
          selectedBook={selectedBook()}
          expandedBook={expandedBook()}
          chaptersForBook={chaptersForBook}
          onSelectBook={(book) => {
            hapticSelection();
            setSelectedBook(book);
            setShowBookFilter(false);
            setExpandedBook(null);
          }}
          onSelectChapter={(book, _chapter) => {
            hapticSelection();
            setSelectedBook(book);
            setShowBookFilter(false);
            setExpandedBook(null);
          }}
          onToggleExpand={(book) => {
            hapticLight();
            setExpandedBook((prev) => (prev === book ? null : book));
          }}
          onClearFilter={() => {
            hapticLight();
            setSelectedBook(null);
            setShowBookFilter(false);
            setExpandedBook(null);
          }}
          onClose={() => {
            setShowBookFilter(false);
            setExpandedBook(null);
          }}
        />
      )}
      {showSettings() && (
        <HearthSettingsOverlay
          theme={theme()}
          walletAddress={walletAddress()}
          isConnecting={isConnecting()}
          connectError={connectError()}
          isSyncing={isSyncing()}
          showExportSubmenu={showExportSubmenu()}
          availableWallets={availableWallets()}
          showWalletPicker={showWalletPicker()}
          onToggleTheme={() => {
            hapticLight();
            setTheme(toggleTheme());
          }}
          onConnectWallet={() => void handleConnectWallet()}
          onSelectWallet={(w) => {
            setShowWalletPicker(false);
            void doConnect(w);
          }}
          onDisconnectWallet={() => void handleDisconnectWallet()}
          onOpenTrash={() => {
            setShowSettings(false);
            setShowTrash(true);
            void loadArchivedBlocks();
          }}
          onToggleExport={() => setShowExportSubmenu((v) => !v)}
          onExport={(fmt) => void handleExportFormat(fmt)}
          onCopyAllText={() => void handleExportCopyText()}
          onClose={() => {
            setShowSettings(false);
            setShowExportSubmenu(false);
            setShowWalletPicker(false);
          }}
        />
      )}
      {showTrash() && (
        <div class={styles.settingsOverlay} onClick={() => setShowTrash(false)}>
          <div
            class={styles.settingsPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <header class={styles.settingsHeader}>
              <h2 class={styles.settingsTitle}>Trash</h2>
              <button
                type="button"
                class={styles.settingsCloseBtn}
                onClick={() => setShowTrash(false)}
                aria-label="Close"
              >
                <IconX size={ICON_PX.inline} />
              </button>
            </header>
            <div class={styles.settingsBody}>
              <Show
                when={archivedBlocks().length > 0}
                fallback={
                  <div class={styles.settingsRow}>
                    <span class={styles.settingsRowLabel}>Trash is empty</span>
                  </div>
                }
              >
                <For each={archivedBlocks()}>
                  {(block) => (
                    <div
                      class={styles.settingsRow}
                      style={{
                        display: "flex",
                        "justify-content": "space-between",
                        "align-items": "center",
                      }}
                    >
                      <span class={styles.settingsRowLabel}>
                        {block.scripture_display_ref ??
                          block.entity_name ??
                          "Note"}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          "flex-shrink": 0,
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            padding: "0.25rem 0.5rem",
                            "font-size": "0.85rem",
                          }}
                          onClick={() => void handleRestore(block.id)}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </div>
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

function BookFilterSheet(props: {
  books: string[];
  selectedBook: string | null;
  expandedBook: string | null;
  chaptersForBook: (book: string) => number[];
  onSelectBook: (book: string) => void;
  onSelectChapter: (book: string, chapter: number) => void;
  onToggleExpand: (book: string) => void;
  onClearFilter: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div class={styles.bookSheetOverlay} onClick={props.onClose}>
      <div class={styles.bookSheet} onClick={(e) => e.stopPropagation()}>
        <header class={styles.bookSheetHeader}>
          <h2 class={styles.bookSheetTitle}>Filter by book</h2>
          <button
            type="button"
            class={styles.bookSheetClose}
            onClick={props.onClose}
            aria-label="Close"
          >
            <IconX size={ICON_PX.inline} />
          </button>
        </header>
        <div class={styles.bookSheetBody}>
          <button
            type="button"
            class={`${styles.bookSheetItem}${!props.selectedBook ? ` ${styles.bookSheetItemActive}` : ""}`}
            onClick={props.onClearFilter}
          >
            All books
          </button>
          <For each={props.books}>
            {(book) => {
              const isExpanded = () => props.expandedBook === book;
              const chapters = () => props.chaptersForBook(book);
              const hasChapters = () => chapters().length > 1;
              return (
                <div class={styles.bookSheetGroup}>
                  <div class={styles.bookSheetBookRow}>
                    <button
                      type="button"
                      class={`${styles.bookSheetItem}${props.selectedBook === book ? ` ${styles.bookSheetItemActive}` : ""}`}
                      onClick={() => {
                        if (hasChapters()) {
                          props.onToggleExpand(book);
                        } else {
                          props.onSelectBook(book);
                        }
                      }}
                    >
                      {book}
                    </button>
                    {hasChapters() && (
                      <button
                        type="button"
                        class={styles.bookSheetExpandBtn}
                        onClick={() => props.onToggleExpand(book)}
                        aria-label={
                          isExpanded() ? `Collapse ${book}` : `Expand ${book}`
                        }
                        aria-expanded={isExpanded()}
                      >
                        <span
                          class={`${styles.bookSheetChevron}${isExpanded() ? ` ${styles.bookSheetChevronOpen}` : ""}`}
                        >
                          ›
                        </span>
                      </button>
                    )}
                  </div>
                  <Show when={isExpanded() && hasChapters()}>
                    <div class={styles.bookSheetChapters}>
                      <For each={chapters()}>
                        {(ch) => (
                          <button
                            type="button"
                            class={styles.bookSheetChapter}
                            onClick={() => props.onSelectChapter(book, ch)}
                          >
                            {ch}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}

function HearthCard(props: {
  block: Block;
  stage?: LifeStageRecord;
  onSelect: (id: string) => void;
  onEdit: (block: Block) => void;
  shiftHeld: () => boolean;
  onArchive: (id: string) => void;
}): JSX.Element {
  const ls = () => props.stage;
  const rhythm = () =>
    ls() ? nextReviewPresentation(ls()!.next_review_at) : null;
  const TypeIcon = hearthTypeIcon(props.block.type);
  const title =
    props.block.scripture_display_ref ?? props.block.entity_name ?? "Note";

  const previewText = () => {
    const verses = props.block.scripture_verses;
    if (verses && verses.length > 0) {
      return verses.map((v) => v.text).join(" ");
    }
    return props.block.content;
  };

  const editable = props.block.type === "scripture";

  /** Rhythm pill color based on life stage. */
  const rhythmClass = (): string => {
    const r = rhythm();
    if (!r) return "";
    if (r.pastSuggested) return styles.cardRhythmReady;
    const s = ls()?.stage;
    if (s === "steady" || s === "ember") return styles.cardRhythmMature;
    return styles.cardRhythmGrowing;
  };

  return (
    <div
      class={`${styles.cardWrap}${editable ? ` ${styles.cardWrapEditable}` : ""}`}
    >
      <button
        type="button"
        class={`${styles.card}${editable ? ` ${styles.cardEditable}` : ""}`}
        onClick={() => {
          hapticLight();
          props.onSelect(props.block.id);
        }}
      >
        <div class={styles.cardIcon}>{TypeIcon({ size: ICON_PX.inline })}</div>
        <div class={styles.cardContent}>
          <span class={styles.cardTitle}>{title}</span>
          {rhythm() && (
            <span class={`${styles.cardRhythm} ${rhythmClass()}`}>
              {rhythm()!.dateMedium}
            </span>
          )}
          <span class={styles.cardSub}>{previewText()}</span>
        </div>
      </button>
      {editable && (
        <>
          {props.shiftHeld() ? (
            <button
              type="button"
              class={styles.cardArchiveBtn}
              aria-label={`Archive ${title}`}
              title="Archive passage"
              onClick={(e) => {
                e.stopPropagation();
                hapticWarning();
                props.onArchive(props.block.id);
              }}
            >
              <IconTrash size={ICON_PX.inline} />
            </button>
          ) : (
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
        </>
      )}
    </div>
  );
}

function HearthSettingsOverlay(props: {
  theme: "light" | "dark";
  walletAddress: string | null;
  isConnecting: boolean;
  connectError: string | null;
  isSyncing: boolean;
  showExportSubmenu: boolean;
  availableWallets: WalletInfo[];
  showWalletPicker: boolean;
  onToggleTheme: () => void;
  onConnectWallet: () => void;
  onSelectWallet: (wallet: WalletInfo) => void;
  onDisconnectWallet: () => void;
  onOpenTrash: () => void;
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
              <Show
                when={props.theme === "dark"}
                fallback={<IconMoon size={ICON_PX.inline} />}
              >
                <IconSun size={ICON_PX.inline} />
              </Show>
            </span>
            <span class={styles.settingsRowLabel}>
              {props.theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          <Show
            when={props.walletAddress}
            fallback={
              <>
                <Show
                  when={props.showWalletPicker}
                  fallback={
                    <button
                      type="button"
                      class={styles.settingsRow}
                      disabled={props.isConnecting}
                      onClick={props.onConnectWallet}
                    >
                      <span class={styles.settingsRowIcon}>
                        <IconFileCloud size={ICON_PX.inline} />
                      </span>
                      <span class={styles.settingsRowLabel}>
                        {props.isConnecting
                          ? "Looking for wallets…"
                          : "Connect wallet"}
                      </span>
                    </button>
                  }
                >
                  <div class={styles.settingsSubmenu}>
                    <Show
                      when={props.availableWallets.length > 0}
                      fallback={
                        <>
                          <div class={styles.settingsRow}>
                            <span
                              class={styles.settingsRowLabel}
                              style={{ color: "var(--color-text-tertiary)" }}
                            >
                              No wallets detected
                            </span>
                          </div>
                          {WALLET_INSTALL_LINKS.map((w) => (
                            <a
                              href={w.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              class={styles.settingsRow}
                            >
                              <span class={styles.settingsRowLabel}>
                                {w.name}
                              </span>
                              <span class={styles.settingsRowHint}>
                                Install →
                              </span>
                            </a>
                          ))}
                        </>
                      }
                    >
                      {props.availableWallets.map((w) => (
                        <button
                          type="button"
                          class={styles.settingsRow}
                          onClick={() => props.onSelectWallet(w)}
                        >
                          <Show when={w.icon}>
                            <img
                              src={w.icon}
                              alt=""
                              class={styles.walletIcon}
                            />
                          </Show>
                          <span class={styles.settingsRowLabel}>{w.name}</span>
                        </button>
                      ))}
                    </Show>
                  </div>
                </Show>
                <Show when={props.connectError}>
                  <p
                    class={styles.settingsRowLabel}
                    style={{
                      color: "var(--color-fire)",
                      "padding-left": "2.25rem",
                    }}
                  >
                    {props.connectError}
                  </p>
                </Show>
              </>
            }
          >
            <button
              type="button"
              class={styles.settingsRow}
              onClick={props.onDisconnectWallet}
            >
              <span class={styles.settingsRowIcon}>
                <IconCheck size={ICON_PX.inline} />
              </span>
              <span class={styles.settingsRowLabel}>
                {props.isSyncing
                  ? "Syncing…"
                  : `Wallet: ${props.walletAddress!.slice(0, 4)}...${props.walletAddress!.slice(-4)}`}
              </span>
              <span class={styles.settingsRowHint}>Disconnect</span>
            </button>
          </Show>
          <button
            type="button"
            class={styles.settingsRow}
            onClick={() => {
              hapticLight();
              props.onOpenTrash();
            }}
          >
            <span class={styles.settingsRowIcon}>
              <IconTrash size={ICON_PX.inline} />
            </span>
            <span class={styles.settingsRowLabel}>Trash</span>
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
              <button
                type="button"
                class={styles.settingsRow}
                onClick={() => props.onExport("json")}
              >
                <span class={styles.settingsRowIcon}>
                  <IconFileText size={ICON_PX.inline} />
                </span>
                <span class={styles.settingsRowLabel}>JSON</span>
                <span class={styles.settingsRowHint}>Full data</span>
              </button>
              <button
                type="button"
                class={styles.settingsRow}
                onClick={() => props.onExport("csv")}
              >
                <span class={styles.settingsRowIcon}>
                  <IconDownload size={ICON_PX.inline} />
                </span>
                <span class={styles.settingsRowLabel}>CSV</span>
                <span class={styles.settingsRowHint}>Spreadsheet</span>
              </button>
              <button
                type="button"
                class={styles.settingsRow}
                onClick={() => props.onExport("markdown")}
              >
                <span class={styles.settingsRowIcon}>
                  <IconFileText size={ICON_PX.inline} />
                </span>
                <span class={styles.settingsRowLabel}>Markdown</span>
                <span class={styles.settingsRowHint}>Readable</span>
              </button>
              <button
                type="button"
                class={styles.settingsRow}
                onClick={() => props.onExport("text")}
              >
                <span class={styles.settingsRowIcon}>
                  <IconDownload size={ICON_PX.inline} />
                </span>
                <span class={styles.settingsRowLabel}>Plain text</span>
                <span class={styles.settingsRowHint}>Simple list</span>
              </button>
              <div class={styles.settingsDivider} />
              <button
                type="button"
                class={styles.settingsRow}
                onClick={props.onCopyAllText}
              >
                <span class={styles.settingsRowIcon}>
                  <IconCopy size={ICON_PX.inline} />
                </span>
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

function HearthPassageEditModal(props: {
  block: Block;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const initialVerses = props.block.scripture_verses ?? [];
  const initialTranslation = props.block.scripture_translation || "BSB";
  const [canonicalRef, setCanonicalRef] = createSignal(
    props.block.scripture_ref ?? "",
  );
  const [displayRef, setDisplayRef] = createSignal(
    props.block.scripture_display_ref ?? props.block.scripture_ref ?? "",
  );
  const [translation, setTranslation] = createSignal(initialTranslation);
  const [verses, setVerses] = createSignal<Verse[]>(initialVerses);
  const [availableTranslations, setAvailableTranslations] = createSignal<
    TranslationInfo[]
  >([]);
  const [saving, setSaving] = createSignal(false);
  const [resolvingReference, setResolvingReference] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastResolvedKey, setLastResolvedKey] = createSignal(
    props.block.scripture_ref
      ? `${props.block.scripture_ref}|${initialTranslation}`
      : "",
  );

  function applyResolvedPassage(
    resolved: {
      ref: string;
      displayRef: string;
      translation: string;
      verses: Verse[];
    } | null,
  ) {
    if (!resolved) return;
    setCanonicalRef(resolved.ref);
    setDisplayRef(resolved.displayRef);
    setTranslation(resolved.translation);
    setVerses(resolved.verses);
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
    void fetchAvailableTranslations().then(setAvailableTranslations);
  });

  createEffect(() => {
    const typedRef = displayRef().trim();
    const tr = translation().trim() || "BSB";
    const parsed = parseInputToPassage(typedRef);
    if (!typedRef || !parsed) return;

    const key = `${parsed.canonical}|${tr}`;
    if (key === lastResolvedKey()) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setResolvingReference(true);
      const resolved = await resolvePassageFromHelloAO(parsed.canonical, tr);
      if (cancelled) return;
      setResolvingReference(false);
      if (!resolved) {
        setError("Couldn't resolve that passage reference.");
        return;
      }
      setLastResolvedKey(key);
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
      let nextDisplayRef =
        displayRef().trim() || props.block.scripture_ref || "Passage";
      let nextTranslation = translation().trim();
      let nextVerses = verses();

      const currentKey = `${parsed.canonical}|${nextTranslation || "BSB"}`;
      if (
        parsed.canonical !== nextCanonical ||
        currentKey !== lastResolvedKey()
      ) {
        setResolvingReference(true);
        const resolved = await resolvePassageFromHelloAO(
          parsed.canonical,
          nextTranslation || "BSB",
        );
        setResolvingReference(false);
        if (!resolved) {
          setError("Couldn't resolve that passage reference.");
          return;
        }
        applyResolvedPassage(resolved);
        nextCanonical = resolved.ref;
        nextDisplayRef = resolved.displayRef;
        nextTranslation = resolved.translation;
        nextVerses = resolved.verses;
        setLastResolvedKey(currentKey);
      }

      const duplicate = await findScriptureBlockByCanonicalRef(nextCanonical);
      if (duplicate && duplicate.id !== props.block.id) {
        setError("That passage already exists in your hearth.");
        return;
      }

      const nextContent = nextVerses.length
        ? nextVerses
            .map((verse) => verse.text)
            .filter(Boolean)
            .join(" ")
        : "";

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
    <div
      class={styles.editOverlay}
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
    >
      <div class={styles.editPanel} onClick={(e) => e.stopPropagation()}>
        <header class={styles.editHeader}>
          <div>
            <p class={styles.editEyebrow}>Passage editor</p>
            <h2 class={styles.editTitle}>
              {displayRef().trim() || "Edit passage"}
            </h2>
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
            Change the reference or translation and Kindled will pull fresh
            passage text automatically before you save.
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
              <select
                value={translation()}
                onChange={(e) => setTranslation(e.currentTarget.value)}
                class={styles.editSelect}
              >
                <option value={translation()}>
                  {(() => {
                    const found = availableTranslations().find(
                      (t) => t.id === translation(),
                    );
                    return found
                      ? formatTranslationId(found.id)
                      : `${formatTranslationId(translation())} (loading…)`;
                  })()}
                </option>
                <For
                  each={availableTranslations().filter(
                    (t) => t.id !== translation(),
                  )}
                >
                  {(t) => (
                    <option value={t.id}>
                      {formatTranslationId(t.id)} ({t.englishName})
                    </option>
                  )}
                </For>
              </select>
            </label>
          </div>

          {resolvingReference() && (
            <p class={styles.editStatus}>Pulling the matching passage text…</p>
          )}

          {verses().length > 0 ? (
            <div class={styles.editPassagePreview}>
              {verses().map((verse) => (
                <p class={styles.editPreviewVerse}>
                  <sup class={styles.editPreviewNumber}>{verse.number}</sup>{" "}
                  {verse.text}
                </p>
              ))}
            </div>
          ) : (
            <p class={styles.editStatus}>
              {resolvingReference()
                ? "Loading passage text..."
                : "Enter a reference to see passage text."}
            </p>
          )}

          {error() && <p class={styles.editError}>{error()}</p>}
        </div>

        <footer class={styles.editFooter}>
          <button
            type="button"
            class={styles.editSecondaryBtn}
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            class={styles.editPrimaryBtn}
            disabled={saving() || resolvingReference()}
            onClick={() => void handleSave()}
          >
            <IconFloppyDisk size={ICON_PX.inline} />
            {saving()
              ? "Saving..."
              : resolvingReference()
                ? "Updating..."
                : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
