import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import {
  getDailyKindling,
  getTotalBlockCount,
  peekClientKindlingIdsCache,
  setClientKindlingIdsCache,
  getArchivedBlocks,
  restoreBlock,
  type Block,
} from "../db";
import {
  getConnectedAddress,
  connectWallet,
  syncLocalDbWithMemoLog,
  disconnectWallet,
  waitForWallets,
  WALLET_INSTALL_LINKS,
  type WalletInfo,
} from "../solana";
import {
  IconBookOpen,
  IconCheck,
  IconFileCloud,
  IconFire,
  IconMoon,
  IconPlus,
  IconSun,
  IconTrash,
  IconX,
  BeginFireIcon,
} from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import styles from "./Threshold.module.css";
import { hapticLight, hapticMedium } from "../haptics";
import { ThemeToggle } from "../ui/theme-toggle";
import { getCurrentTheme, toggleTheme } from "../ui/theme";

export function ThresholdView(props: {
  onBegin: (blockIds: string[]) => void;
  onLibrary: () => void;
  onCapture: () => void;
}): JSX.Element {
  const [kindlingIds, setKindlingIds] = createSignal<string[]>(
    peekClientKindlingIdsCache() ?? [],
  );
  const [totalBlocks, setTotalBlocks] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [walletAddress, setWalletAddress] = createSignal(getConnectedAddress());
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [connectError, setConnectError] = createSignal<string | null>(null);
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [showTrash, setShowTrash] = createSignal(false);
  const [archivedBlocks, setArchivedBlocks] = createSignal<Block[]>([]);
  const [showWalletPicker, setShowWalletPicker] = createSignal(false);
  const [availableWallets, setAvailableWallets] = createSignal<WalletInfo[]>(
    [],
  );

  createEffect(() => {
    void loadKindling();
  });

  // If a wallet was already trusted/cached, pull on-chain memos on mount.
  if (walletAddress()) {
    void (async () => {
      try {
        setIsSyncing(true);
        const { added } = await syncLocalDbWithMemoLog();
        console.log(
          `[SolanaSync] Cached wallet, restored ${added} passage(s) from on-chain backup`,
        );
        await loadKindling();
      } catch (err) {
        console.error("[SolanaSync] Auto-sync on mount failed:", err);
      } finally {
        setIsSyncing(false);
      }
    })();
  }

  async function loadKindling() {
    try {
      const [ids, total] = await Promise.all([
        getDailyKindling(5),
        getTotalBlockCount(),
      ]);
      setClientKindlingIdsCache(ids);
      setKindlingIds(ids);
      setTotalBlocks(total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kindling");
    } finally {
      setLoading(false);
    }
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
      console.log(
        `[SolanaSync] Connected ${address.slice(0, 4)}…${address.slice(-4)}, restored ${added} passage(s) from on-chain backup`,
      );
      await loadKindling();
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
    void loadKindling();
  }

  const stateClass = () => {
    if (loading()) return styles.threshold;
    return `${styles.threshold} ${styles.thresholdKindling}`;
  };

  return (
    <div class={stateClass()}>
      <ThemeToggle class={styles.themeToggleCorner} />
      <Show when={walletAddress()}>
        <Show
          when={!isSyncing()}
          fallback={<span class={styles.walletStatusCorner}>Syncing…</span>}
        >
          <span class={styles.walletStatusCorner}>
            {walletAddress()!.slice(0, 4)}…{walletAddress()!.slice(-4)}
          </span>
        </Show>
      </Show>
      <h1 class={styles.title}>Kindled</h1>
      <div class={styles.divider} aria-hidden="true" />
      <p class={styles.tagline}>
        Spark scripture into an eternal, internal flame.
      </p>
      {error() && <p class={styles.error}>{error()}</p>}
      <Show
        when={!loading()}
        fallback={<p class={styles.sub}>Stoking your hearth...</p>}
      >
        <ThresholdContent
          kindlingIds={kindlingIds()}
          totalBlocks={totalBlocks()}
          onBegin={props.onBegin}
          onCapture={props.onCapture}
          onLibrary={props.onLibrary}
          walletAddress={walletAddress()}
          isConnecting={isConnecting()}
          connectError={connectError()}
          showWalletPicker={showWalletPicker()}
          availableWallets={availableWallets()}
          onConnectWallet={handleConnectWallet}
          onSelectWallet={(w) => {
            setShowWalletPicker(false);
            void doConnect(w);
          }}
        />
      </Show>
      {showSettings() && (
        <ThresholdSettingsOverlay
          walletAddress={walletAddress()}
          showWalletPicker={showWalletPicker()}
          availableWallets={availableWallets()}
          onConnectWallet={handleConnectWallet}
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
          onClose={() => {
            setShowSettings(false);
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
    </div>
  );
}

function ThresholdContent(props: {
  kindlingIds: string[];
  totalBlocks: number;
  onBegin: (ids: string[]) => void;
  onCapture: () => void;
  onLibrary: () => void;
  walletAddress: string | null;
  isConnecting: boolean;
  connectError: string | null;
  showWalletPicker: boolean;
  availableWallets: WalletInfo[];
  onConnectWallet: () => void;
  onSelectWallet: (wallet: WalletInfo) => void;
}): JSX.Element {
  const hasKindling = () => props.kindlingIds.length > 0;

  return (
    <>
      <div class={styles.ctaColumn}>
        <div class={styles.actions} role="group" aria-label="Actions">
          <Show when={props.totalBlocks > 0 || props.walletAddress}>
            <button
              type="button"
              class={styles.secondaryButton}
              onClick={() => {
                hapticLight();
                props.onLibrary();
              }}
            >
              <IconBookOpen size={ICON_PX.inline} /> Hearth
            </button>
          </Show>
          <Show when={!props.walletAddress}>
            <Show
              when={props.showWalletPicker}
              fallback={
                <button
                  type="button"
                  class={styles.secondaryButton}
                  disabled={props.isConnecting}
                  onClick={() => {
                    hapticLight();
                    props.onConnectWallet();
                  }}
                >
                  <IconFileCloud size={ICON_PX.inline} />
                  {props.isConnecting
                    ? "Looking for wallets…"
                    : "Connect wallet"}
                </button>
              }
            >
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "0.5rem",
                }}
              >
                <Show
                  when={props.availableWallets.length > 0}
                  fallback={
                    <>
                      <span
                        style={{
                          color: "var(--color-text-tertiary)",
                          "font-size": "0.85rem",
                        }}
                      >
                        No wallets detected
                      </span>
                      {WALLET_INSTALL_LINKS.map((w) => (
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class={styles.secondaryButton}
                          style={{
                            display: "flex",
                            "align-items": "center",
                            gap: "0.5rem",
                            "text-decoration": "none",
                          }}
                        >
                          <span>{w.name}</span>
                          <span
                            style={{
                              "margin-left": "auto",
                              "font-size": "0.85rem",
                              color: "var(--color-text-tertiary)",
                            }}
                          >
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
                      class={styles.secondaryButton}
                      onClick={() => props.onSelectWallet(w)}
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "0.5rem",
                      }}
                    >
                      <Show when={w.icon}>
                        <img
                          src={w.icon}
                          alt=""
                          style={{
                            width: "20px",
                            height: "20px",
                            "border-radius": "4px",
                          }}
                        />
                      </Show>
                      <span>{w.name}</span>
                    </button>
                  ))}
                </Show>
              </div>
            </Show>
          </Show>
          <Show when={hasKindling()}>
            <button
              type="button"
              class={styles.secondaryButton}
              onClick={() => {
                hapticLight();
                props.onCapture();
              }}
            >
              <IconPlus size={ICON_PX.inline} /> Capture
            </button>
          </Show>
        </div>
        <Show when={props.connectError}>
          <p class={styles.error} style={{ "margin-top": "0.5rem" }}>
            {props.connectError}
          </p>
        </Show>
        <Show when={hasKindling()}>
          <p class={styles.count}>
            <span class={styles.countIcon}>
              <IconFire size={ICON_PX.inline} />
            </span>
            {props.kindlingIds.length}{" "}
            {props.kindlingIds.length === 1 ? "spark" : "sparks"} to tend today
          </p>
        </Show>
        <Show
          when={hasKindling()}
          fallback={
            <button
              type="button"
              class={styles.primaryButton}
              onClick={() => {
                hapticMedium();
                props.onCapture();
              }}
            >
              <IconPlus size={ICON_PX.inline} /> Capture a Passage
            </button>
          }
        >
          <button
            type="button"
            class={styles.primaryButton}
            onClick={() => {
              hapticMedium();
              props.onBegin(props.kindlingIds);
            }}
          >
            <BeginFireIcon size={ICON_PX.actionPrimary} /> Begin
          </button>
        </Show>
      </div>
    </>
  );
}

function ThresholdSettingsOverlay(props: {
  walletAddress: string | null;
  showWalletPicker: boolean;
  availableWallets: WalletInfo[];
  onConnectWallet: () => void;
  onSelectWallet: (wallet: WalletInfo) => void;
  onDisconnectWallet: () => void;
  onOpenTrash: () => void;
  onClose: () => void;
}): JSX.Element {
  const [theme, setTheme] = createSignal<"light" | "dark">(getCurrentTheme());

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
            onClick={() => {
              hapticLight();
              setTheme(toggleTheme());
            }}
          >
            <span class={styles.settingsRowIcon}>
              <Show
                when={theme() === "dark"}
                fallback={<IconMoon size={ICON_PX.inline} />}
              >
                <IconSun size={ICON_PX.inline} />
              </Show>
            </span>
            <span class={styles.settingsRowLabel}>
              {theme() === "dark" ? "Light mode" : "Dark mode"}
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
                      onClick={() => {
                        hapticLight();
                        props.onConnectWallet();
                      }}
                    >
                      <span class={styles.settingsRowIcon}>
                        <IconFileCloud size={ICON_PX.inline} />
                      </span>
                      <span class={styles.settingsRowLabel}>
                        Connect wallet
                      </span>
                    </button>
                  }
                >
                  <div style={{ padding: "2px 0 2px 1rem" }}>
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
                              style={{
                                width: "24px",
                                height: "24px",
                                "border-radius": "6px",
                                "flex-shrink": 0,
                                "object-fit": "contain",
                              }}
                            />
                          </Show>
                          <span class={styles.settingsRowLabel}>{w.name}</span>
                        </button>
                      ))}
                    </Show>
                  </div>
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
                {props.walletAddress!.slice(0, 4)}…
                {props.walletAddress!.slice(-4)}
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
        </div>
      </div>
    </div>
  );
}
