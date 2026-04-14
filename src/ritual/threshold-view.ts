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

  return html`<div class="${styles.threshold}">
    <h1 class="${styles.title}">Kindled</h1>
    <div class="${styles.divider}" aria-hidden="true"></div>
    <p class="${styles.tagline}">
      Kindle Scripture a few minutes at a time, and grow the fire inside.
    </p>
    ${() => thresholdBody(state, props)}
    ${() => (state.error ? html`<p class="${styles.error}">${state.error}</p>` : html``)}
    ${() => thresholdFooter(state, props)}
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

function thresholdBody(
  state: { loading: boolean; kindlingIds: string[] },
  props: { onBegin: (ids: string[]) => void; onCapture: () => void },
): ArrowTemplate {
  if (state.loading) {
    return html`<p class="${styles.sub}">Stoking your hearth...</p>`;
  }
  if (state.kindlingIds.length === 0) {
    return html`<div class="${styles.empty}">
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
    </div>`;
  }
  return html`<p class="${styles.count}">
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
    </button>`;
}

function thresholdFooter(
  state: { loading: boolean; kindlingIds: string[] },
  props: { onCapture: () => void; onLibrary: () => void },
): ArrowTemplate {
  if (!state.loading && state.kindlingIds.length === 0) {
    return html``;
  }
  return html`<div class="${styles.actions}">
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
  </div>`;
}
