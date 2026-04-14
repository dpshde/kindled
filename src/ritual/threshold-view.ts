import { html, reactive, watch, type ArrowTemplate } from "@arrow-js/core";
import {
  getDailyKindling,
  peekClientKindlingIdsCache,
  setClientKindlingIdsCache,
} from "../db";
import { IconBookOpen, IconFire, IconPlus, BeginFireIcon } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import styles from "./Threshold.module.css";
import { hapticTrigger } from "../haptics";

export function thresholdView(props: {
  onBegin: (blockIds: string[]) => void;
  onLibrary: () => void;
  onCapture: () => void;
}): ArrowTemplate {
  const state = reactive({
    kindlingIds: peekClientKindlingIdsCache() ?? [],
    loading: true,
    error: null as string | null,
  });

  watch(() => {
    void loadKindling(state);
  });

  return html`<div
    class="${() => {
      if (state.loading) return styles.threshold;
      if (state.kindlingIds.length === 0) {
        return `${styles.threshold} ${styles.thresholdEmpty}`;
      }
      return `${styles.threshold} ${styles.thresholdKindling}`;
    }}"
  >
    <h1 class="${styles.title}">Kindled</h1>
    <div class="${styles.divider}" aria-hidden="true"></div>
    <p class="${styles.tagline}">
      Kindle Scripture a few minutes at a time, and grow the fire inside.
    </p>
    ${() => (state.error ? html`<p class="${styles.error}">${state.error}</p>` : html``)}
    ${() => thresholdContent(state, props)}
  </div>`;
}

async function loadKindling(state: {
  kindlingIds: string[];
  loading: boolean;
  error: string | null;
}) {
  try {
    const ids = await getDailyKindling(5);
    setClientKindlingIdsCache(ids);
    state.kindlingIds = ids;
    state.error = null;
  } catch (e) {
    state.error = e instanceof Error ? e.message : "Failed to load kindling";
  } finally {
    state.loading = false;
  }
}

function thresholdContent(
  state: { loading: boolean; kindlingIds: string[] },
  props: {
    onBegin: (ids: string[]) => void;
    onCapture: () => void;
    onLibrary: () => void;
  },
): ArrowTemplate {
  if (state.loading) {
    return html`<p class="${styles.sub}">Stoking your hearth...</p>`;
  }
  if (state.kindlingIds.length === 0) {
    return html`<div class="${styles.ctaColumn}">
      <div class="${styles.empty}">
        <button
          type="button"
          class="${styles.button}"
          @click="${() => {
            hapticTrigger();
            props.onCapture();
          }}"
        >
          ${IconPlus({ size: ICON_PX.inline })} Capture a Passage
        </button>
      </div>
    </div>`;
  }
  return html`<div class="${styles.ctaColumn}">
    <div class="${styles.kindlingFocus}">
      <p class="${styles.count}">
        <span class="${styles.countIcon}">${IconFire({ size: ICON_PX.inline })}</span>
        ${() => state.kindlingIds.length}
        ${() => (state.kindlingIds.length === 1 ? "spark" : "sparks")} to tend today
      </p>
      <button
        type="button"
        class="${styles.primaryButton}"
        @click="${() => {
          hapticTrigger();
          props.onBegin(state.kindlingIds);
        }}"
      >
        ${BeginFireIcon({ size: ICON_PX.actionPrimary })} Begin
      </button>
    </div>
    <div class="${styles.actions}" role="group" aria-label="More actions">
      <button
        type="button"
        class="${styles.secondaryButton}"
        @click="${() => {
          hapticTrigger();
          props.onCapture();
        }}"
      >
        ${IconPlus({ size: ICON_PX.inline })} Add
      </button>
      <button
        type="button"
        class="${styles.secondaryButton}"
        @click="${() => {
          hapticTrigger();
          props.onLibrary();
        }}"
      >
        ${IconBookOpen({ size: ICON_PX.inline })} Hearth
      </button>
    </div>
  </div>`;
}
