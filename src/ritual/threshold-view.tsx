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
import { getSyncState, onSyncStateChange } from "../sync/file-sync";
import {
  IconBookOpen,
  IconFileCloud,
  IconFire,
  IconPlus,
  BeginFireIcon,
} from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import styles from "./Threshold.module.css";
import { hapticLight, hapticMedium } from "../haptics";
import { SyncSettingsView } from "../sync/SyncSettings";
import { ThemeToggle } from "../ui/theme-toggle";

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
  const [syncAttached, setSyncAttached] = createSignal(
    getSyncState().status === "attached",
  );

  const unsub = onSyncStateChange((s) => {
    setSyncAttached(s.status === "attached");
  });
  onCleanup(() => unsub());

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
      <div class={styles.themeToggle}>
        <ThemeToggle class={styles.themeToggleBtn} />
      </div>
      <h1 class={styles.title}>Kindled</h1>
      <div class={styles.divider} aria-hidden="true" />
      <p class={styles.tagline}>Spark scripture into an eternal, internal flame.</p>
      {error() && <p class={styles.error}>{error()}</p>}
      <Show when={!loading()} fallback={<p class={styles.sub}>Stoking your hearth...</p>}>
        <ThresholdContent
          kindlingIds={kindlingIds()}
          totalBlocks={totalBlocks()}
          syncAttached={syncAttached()}
          onBegin={props.onBegin}
          onCapture={props.onCapture}
          onLibrary={props.onLibrary}
          showSync={showSync()}
          setShowSync={setShowSync}
        />
      </Show>
      {showSync() && (
        <SyncSettingsView
          onClose={() => setShowSync(false)}
          onSynced={() => void loadKindling()}
        />
      )}
    </div>
  );
}

function ThresholdContent(props: {
  kindlingIds: string[];
  totalBlocks: number;
  syncAttached: boolean;
  onBegin: (ids: string[]) => void;
  onCapture: () => void;
  onLibrary: () => void;
  showSync: boolean;
  setShowSync: (v: boolean) => void;
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
        {(props.totalBlocks > 0 || props.syncAttached) ? (
          <div class={styles.actions} role="group" aria-label="More actions">
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
            {!props.syncAttached && (
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
            )}
          </div>
        ) : (
          <div class={styles.actions} role="group" aria-label="More actions">
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
          </div>
        )}
      </div>
    );
  }

  // Kindling state
  return (
    <div class={styles.ctaColumn}>
      <div class={styles.kindlingFocus}>
        <p class={styles.count}>
          <span class={styles.countIcon}>
            <IconFire size={ICON_PX.inline} />
          </span>
          {props.kindlingIds.length}{" "}
          {props.kindlingIds.length === 1 ? "spark" : "sparks"} to tend today
        </p>
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
        {!props.syncAttached && (
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
        )}
      </div>
    </div>
  );
}
