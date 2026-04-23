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
  IconGear,
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
  const [signedInSync, setSignedInSync] = createSignal(
    isSignedInSyncState(getSyncState().status),
  );
  const [showSettings, setShowSettings] = createSignal(false);

  const unsubSyncState = onSyncStateChange((sync) => {
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
    if (kindlingIds().length === 0) {
      return `${styles.threshold} ${styles.thresholdEmpty}`;
    }
    return `${styles.threshold} ${styles.thresholdKindling}`;
  };

  return (
    <div class={stateClass()}>
      <ThemeToggle class={styles.themeToggleCorner} />
      <button
        type="button"
        class={styles.settingsGearCorner}
        onClick={() => {
          hapticLight();
          setShowSettings(true);
        }}
        aria-label="Settings"
      >
        <IconGear size={ICON_PX.inline} />
      </button>
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
  if (props.kindlingIds.length === 0) {
    return (
      <div class={styles.ctaColumn}>
        <div class={styles.empty}>
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
        </div>
        <div class={styles.actions} role="group" aria-label="More actions">
          <Show when={props.totalBlocks > 0}>
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
          <Show when={props.showSyncButton}>
            <button
              type="button"
              class={styles.secondaryButton}
              onClick={() => {
                hapticLight();
                props.setShowSync(true);
              }}
            >
              <IconFileCloud size={ICON_PX.inline} /> Sync
            </button>
          </Show>
        </div>
      </div>
    );
  }

  // Kindling state
  return (
    <>
      <p class={styles.count}>
        <span class={styles.countIcon}>
          <IconFire size={ICON_PX.inline} />
        </span>
        {props.kindlingIds.length}{" "}
        {props.kindlingIds.length === 1 ? "spark" : "sparks"} to tend today
      </p>
      <div class={styles.ctaColumn}>
        <div class={styles.kindlingFocus}>
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
        </div>
        <div class={styles.actions} role="group" aria-label="More actions">
        <button
          type="button"
          class={styles.secondaryButton}
          onClick={() => {
            hapticLight();
            props.onCapture();
          }}
        >
          <IconPlus size={ICON_PX.inline} /> Add
        </button>
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
        <Show when={props.showSyncButton}>
          <button
            type="button"
            class={styles.secondaryButton}
            onClick={() => {
              hapticLight();
              props.setShowSync(true);
            }}
          >
            <IconFileCloud size={ICON_PX.inline} /> Sync
          </button>
        </Show>
      </div>
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
