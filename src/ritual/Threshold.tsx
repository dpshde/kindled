import { createSignal, onMount, Show } from "solid-js";
import { getDailyKindling } from "../db";
import {
  IconSeedling,
  IconPlant,
  IconBookOpen,
  IconPlus,
  IconSparkle,
} from "../ui/Icons";

import styles from "./Threshold.module.css";

export function Threshold(props: {
  onBegin: (blockIds: string[]) => void;
  onLibrary: () => void;
  onCapture: () => void;
}) {
  const [kindlingIds, setKindlingIds] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const ids = await getDailyKindling(5);
      setKindlingIds(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kindling");
    } finally {
      setLoading(false);
    }
  });

  return (
    <div class={styles.threshold}>
      <div class={styles.ember}>
        <IconSparkle size={28} />
      </div>
      <p class={styles.label}>daily practice</p>
      <h1 class={styles.title}>Kindled</h1>
      <div class={styles.divider} />

      <Show when={!loading()} fallback={<p class={styles.sub}>Preparing your garden...</p>}>
        <Show
          when={kindlingIds().length > 0}
          fallback={
            <div class={styles.empty}>
              <div class={styles.emptyIcon}>
                <IconSeedling size={36} />
              </div>
              <p class={styles.sub}>
                Your garden is empty. Plant your first seed.
              </p>
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
            <IconPlant size={18} /> Begin
          </button>
        </Show>
      </Show>

      <Show when={error()}>
        <p class={styles.error}>{error()}</p>
      </Show>

      <div class={styles.actions}>
        <button class={styles.secondaryButton} onClick={props.onCapture}>
          <IconPlus size={14} /> Add
        </button>
        <button class={styles.secondaryButton} onClick={props.onLibrary}>
          <IconBookOpen size={14} /> Garden
        </button>
      </div>
    </div>
  );
}
