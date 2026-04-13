import { createSignal, onMount, Show } from "solid-js";
import {
  getDailyKindling,
  peekClientKindlingIdsCache,
  setClientKindlingIdsCache,
} from "../db";
import {
  IconSeedling,
  IconBookOpen,
  IconPlus,
} from "../ui/Icons";
import { BeginFireIcon } from "../ui/BeginFireIcon";

import styles from "./Threshold.module.css";

export function Threshold(props: {
  onBegin: (blockIds: string[]) => void;
  onLibrary: () => void;
  onCapture: () => void;
}) {
  const cached = peekClientKindlingIdsCache();
  const [kindlingIds, setKindlingIds] = createSignal<string[]>(cached ?? []);
  const [loading, setLoading] = createSignal(cached === null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const ids = await getDailyKindling(5);
      setClientKindlingIdsCache(ids);
      setKindlingIds(ids);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kindling");
    } finally {
      setLoading(false);
    }
  });

  return (
    <div class={styles.threshold}>
      <h1 class={styles.title}>Kindled</h1>
      <div class={styles.divider} aria-hidden />
      <p class={styles.tagline}>
        Kindle Scripture a few minutes at a time, and tend what grows.
      </p>

      <Show when={!loading()} fallback={<p class={styles.sub}>Preparing your garden...</p>}>
        <Show
          when={kindlingIds().length > 0}
          fallback={
            <div class={styles.empty}>
              <button class={styles.button} onClick={props.onCapture}>
                <IconPlus size={16} /> Capture a Passage
              </button>
            </div>
          }
        >
          <p class={styles.count}>
            <span class={styles.countIcon}>
              <IconSeedling size={14} />
            </span>
            {kindlingIds().length}{" "}
            {kindlingIds().length === 1 ? "seed" : "seeds"} to tend today
          </p>
          <button
            class={styles.primaryButton}
            onClick={() => props.onBegin(kindlingIds())}
          >
            <BeginFireIcon size={18} /> Begin
          </button>
        </Show>
      </Show>

      <Show when={error()}>
        <p class={styles.error}>{error()}</p>
      </Show>

      <Show when={loading() || kindlingIds().length > 0}>
        <div class={styles.actions}>
          <button class={styles.secondaryButton} onClick={props.onCapture}>
            <IconPlus size={14} /> Add
          </button>
          <button class={styles.secondaryButton} onClick={props.onLibrary}>
            <IconBookOpen size={14} /> Garden
          </button>
        </div>
      </Show>
    </div>
  );
}
