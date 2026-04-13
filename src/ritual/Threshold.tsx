import { createSignal, onMount, Show } from "solid-js";
import {
  getDailyKindling,
  peekClientKindlingIdsCache,
  setClientKindlingIdsCache,
} from "../db";
import {
  IconFire,
  IconBookOpen,
  IconPlus,
} from "../ui/Icons";
import { BeginFireIcon } from "../ui/BeginFireIcon";
import { ICON_PX } from "../ui/icon-sizes";

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
        Kindle Scripture a few minutes at a time, and grow the fire inside.
      </p>

      <Show when={!loading()} fallback={<p class={styles.sub}>Stoking your hearth...</p>}>
        <Show
          when={kindlingIds().length > 0}
          fallback={
            <div class={styles.empty}>
              <button class={styles.button} onClick={props.onCapture}>
                <IconPlus size={ICON_PX.inline} /> Capture a Passage
              </button>
            </div>
          }
        >
          <p class={styles.count}>
            <span class={styles.countIcon}>
              <IconFire size={ICON_PX.inline} />
            </span>
            {kindlingIds().length}{" "}
            {kindlingIds().length === 1 ? "spark" : "sparks"} to tend today
          </p>
          <button
            class={styles.primaryButton}
            onClick={() => props.onBegin(kindlingIds())}
          >
            <BeginFireIcon size={ICON_PX.actionPrimary} /> Begin
          </button>
        </Show>
      </Show>

      <Show when={error()}>
        <p class={styles.error}>{error()}</p>
      </Show>

      <Show when={loading() || kindlingIds().length > 0}>
        <div class={styles.actions}>
          <button class={styles.secondaryButton} onClick={props.onCapture}>
            <IconPlus size={ICON_PX.inline} /> Add
          </button>
          <button class={styles.secondaryButton} onClick={props.onLibrary}>
            <IconBookOpen size={ICON_PX.inline} /> Hearth
          </button>
        </div>
      </Show>
    </div>
  );
}
