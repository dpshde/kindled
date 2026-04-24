import {
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
} from "../db";
import { getSyncState, onSyncDataApplied, onSyncStateChange, type SyncState } from "../sync/hosted-sync";
import {
  IconBookOpen,
  IconFileCloud,
  IconFire,
  IconMoon,
  IconPlus,
  IconSun,
  IconX,
  BeginFireIcon,
} from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import styles from "./Threshold.module.css";
import { hapticLight, hapticMedium } from "../haptics";
import { SyncSettingsView } from "../sync/SyncSettings";
import { ThemeToggle } from "../ui/theme-toggle";
import { getCurrentTheme, toggleTheme } from "../ui/theme";

function isSignedInSyncState(status: SyncState["status"]): boolean {
  return (
    status === "provisioning" ||
    status === "syncing" ||
    status === "connected" ||
    status === "offline-pending" ||
    status === "error"
  );
}

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
  const [showSync, setShowSync] = createSignal(false);
  const [syncState, setSyncState] = createSignal<SyncState>(getSyncState());
  const [signedInSync, setSignedInSync] = createSignal(
    isSignedInSyncState(getSyncState().status),
  );
  const [showSettings, setShowSettings] = createSignal(false);

  const unsubSyncState = onSyncStateChange((sync) => {
    setSyncState(sync);
    setSignedInSync(isSignedInSyncState(sync.status));
  });
  const unsubDataApplied = onSyncDataApplied(() => {
    void loadKindling();
  });
  onCleanup(() => {
    unsubSyncState();
    unsubDataApplied();
  });

  createEffect(() => {
    void loadKindling();
  });

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

  const stateClass = () => {
    if (loading()) return styles.threshold;
    return `${styles.threshold} ${styles.thresholdKindling}`;
  };

  return (
    <div class={stateClass()}>
      <ThemeToggle class={styles.themeToggleCorner} />
      <Show when={syncState().status === "syncing" || syncState().status === "provisioning"}>
        <div class={styles.syncIndicator} aria-label="Syncing">
          <div class={styles.syncDot} />
        </div>
      </Show>
      <h1 class={styles.title}>Kindled</h1>
      <div class={styles.divider} aria-hidden="true" />
      <p class={styles.tagline}>Spark scripture into an eternal, internal flame.</p>
      {error() && <p class={styles.error}>{error()}</p>}
      <Show when={!loading()} fallback={<p class={styles.sub}>Stoking your hearth...</p>}>
        <ThresholdContent
          kindlingIds={kindlingIds()}
          totalBlocks={totalBlocks()}
          onBegin={props.onBegin}
          onCapture={props.onCapture}
          onLibrary={props.onLibrary}
          setShowSync={setShowSync}
          showSyncButton={!signedInSync()}
        />
      </Show>
      {showSync() && (
        <SyncSettingsView
          onClose={() => setShowSync(false)}
          onSynced={() => void loadKindling()}
        />
      )}
      {showSettings() && (
        <ThresholdSettingsOverlay
          signedInSync={signedInSync()}
          onOpenSync={() => {
            setShowSettings(false);
            setShowSync(true);
          }}
          onClose={() => setShowSettings(false)}
        />
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
  setShowSync: (v: boolean) => void;
  showSyncButton: boolean;
}): JSX.Element {
  const hasKindling = () => props.kindlingIds.length > 0;

  return (
    <>
      <Show when={hasKindling()}>
        <p class={styles.count}>
          <span class={styles.countIcon}>
            <IconFire size={ICON_PX.inline} />
          </span>
          {props.kindlingIds.length}{" "}
          {props.kindlingIds.length === 1 ? "spark" : "sparks"} to tend today
        </p>
      </Show>
      <div class={styles.ctaColumn}>
        <div class={styles.actions} role="group" aria-label="Actions">
          <Show
            when={!props.showSyncButton || props.totalBlocks > 0}
            fallback={
              <button
                type="button"
                class={styles.secondaryButton}
                onClick={() => {
                  hapticLight();
                  props.setShowSync(true);
                }}
              >
                <IconFileCloud size={ICON_PX.inline} /> Sign in
              </button>
            }
          >
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
        <Show when={hasKindling()} fallback={
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
        }>
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
  signedInSync: boolean;
  onOpenSync: () => void;
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
              <Show when={theme() === "dark"} fallback={<IconMoon size={ICON_PX.inline} />}>
                <IconSun size={ICON_PX.inline} />
              </Show>
            </span>
            <span class={styles.settingsRowLabel}>
              {theme() === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          <Show when={!props.signedInSync}>
            <button
              type="button"
              class={styles.settingsRow}
              onClick={() => {
                hapticLight();
                props.onOpenSync();
              }}
            >
              <span class={styles.settingsRowIcon}>
                <IconFileCloud size={ICON_PX.inline} />
              </span>
              <span class={styles.settingsRowLabel}>Sync</span>
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
