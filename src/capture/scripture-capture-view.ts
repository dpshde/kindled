import { html, reactive, watch, type ArrowTemplate } from "@arrow-js/core";
import { invalidateClientKindlingIdsCache, saveScripturePassageFromCapture } from "../db";
import { resolvePassage } from "../scripture/RouteBibleClient";
import {
  resolveBookAlias,
  autocompletePassage,
  OSIS_BOOK_CODES,
  OSIS_BOOK_NAMES,
  type OsisBookCode,
} from "grab-bcv";
import {
  IconArrowLeft,
  IconBookOpen,
  IconCaretDown,
  IconCheck,
  IconWarning,
} from "../ui/icons/icons";
import {
  getTopicPassagePicksForBook,
  loadCanonicalTopics,
  searchCanonicalTopics,
  topRefToInput,
  type CanonicalTopic,
} from "../scripture/canonicalTopics";
import {
  filterRedundantBookSuggestions,
  topicPassageQueryFilter,
} from "../scripture/passageAutocomplete";
import { ICON_PX } from "../ui/icon-sizes";
import { pickerLabelForOsisBook } from "../scripture/book-picker-labels";
import shell from "../ui/app-shell.module.css";
import styles from "./ScriptureCapture.module.css";
import { hapticTrigger } from "../haptics";
import {
  buildNumericOptions,
  buildRefString,
  draftFromParsed,
  displayFromParsed,
  normalizePassageTyping,
  parseInputToPassage,
  scriptureBoundedChapter,
  scriptureBook,
  scriptureChapterCount,
  scriptureVerseCount,
  type StructuredDraft,
} from "./scripture-capture-helpers";

const PASSAGE_INPUT_ID = "scripture-passage-input";

type CaptureStatus = "idle" | "resolving" | "preview" | "saving" | "saved" | "error";

export function scriptureCaptureView(props: {
  initialRef?: string;
  onBack: () => void;
  onSaved: () => void;
}): ArrowTemplate {
  const state = reactive({
    input: "",
    draft: {
      book: "",
      chapter: "",
      startVerse: "",
      endVerse: "",
    } as StructuredDraft,
    status: "idle" as CaptureStatus,
    preview: null as { displayRef: string; translation: string; text: string } | null,
    errorMsg: "",
    canonicalTopics: [] as CanonicalTopic[],
    topicsLoadError: null as string | null,
    topicQuery: "",
    activeTopic: null as CanonicalTopic | null,
    topicListCollapsed: false,
  });

  const debounce = { t: undefined as ReturnType<typeof setTimeout> | undefined };

  watch(() => {
    clearTimeout(debounce.t);
    const refFromUrl = props.initialRef?.trim();
    if (refFromUrl) {
      syncDraftFromInput(state, debounce, props, refFromUrl, true);
    } else {
      queueMicrotask(() => document.getElementById(PASSAGE_INPUT_ID)?.focus());
    }
    void loadCanonicalTopics()
      .then((topics) => {
        state.canonicalTopics = topics;
      })
      .catch(() => {
        state.topicsLoadError = "Topic suggestions unavailable (could not load list).";
      });
  });

  return html`<div class="${shell.view}">
    <div class="${shell.shell}">
      <header class="${shell.header}">
        <div class="${shell.headerLeading}">
          <button
            type="button"
            class="${shell.backBtn}"
            @click="${() => {
              hapticTrigger();
              props.onBack();
            }}"
            aria-label="Back"
          >
            ${IconArrowLeft({ size: ICON_PX.header })}
          </button>
        </div>
        <div class="${shell.headerCenter}">
          <h1 class="${shell.headerTitle}">Passage</h1>
        </div>
        <div class="${shell.headerTrailing}" aria-hidden="true"></div>
      </header>
      <div class="${shell.main}">
        <div class="${shell.shellContent}">
          ${scriptureEditorSection(state, debounce, props)}
          ${scriptureTopicSection(state, debounce, props)}
          ${() => scriptureParsedPreview(state)}
          ${() => scriptureIdleResolveBtn(state, debounce, props)}
          ${() => scriptureResolving(state)}
          ${() => scripturePreviewBlock(state, debounce, props)}
          ${() => scriptureSaving(state)}
          ${() => scriptureSaved(state)}
          ${() => scriptureErrorBlock(state)}
        </div>
      </div>
    </div>
  </div>`;
}

function scSuggestions(state: {
  input: string;
  status: CaptureStatus;
}): { label: string; insertText: string; canonical: string }[] {
  const q = state.input.trim();
  if (!q || state.status !== "idle") return [];
  const tf = topicPassageQueryFilter(q);
  if (tf) {
    const { book, chapter, versePrefix } = tf;
    return getTopicPassagePicksForBook(book, 6, { chapter, versePrefix }).map((pick) => ({
      label: pick.label,
      insertText: pick.insertText,
      canonical: pick.refOsis,
    }));
  }
  return filterRedundantBookSuggestions(q, autocompletePassage(q, { limit: 6 })).map((s) => ({
    label: s.label,
    insertText: s.insertText,
    canonical: s.canonical,
  }));
}

function scTopicMatches(state: {
  canonicalTopics: CanonicalTopic[];
  topicQuery: string;
}): CanonicalTopic[] {
  return searchCanonicalTopics(state.canonicalTopics, state.topicQuery, 8);
}

function scParsedPreview(state: { input: string }): { display: string; canonical: string } | null {
  const val = state.input.trim();
  if (!val) return null;
  const p = parseInputToPassage(val);
  if (!p) return null;
  return displayFromParsed(p);
}

function queueAutoResolveFromInput(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
) {
  clearTimeout(debounce.t);
  debounce.t = setTimeout(() => {
    debounce.t = undefined;
    void tryAutoResolve(state, debounce, props);
  }, 320);
}

type CaptureStatusAware = {
  input: string;
  status: CaptureStatus;
  draft: StructuredDraft;
  preview: { displayRef: string; translation: string; text: string } | null;
  errorMsg: string;
};

function scheduleResolveAfterDraftSync(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
  instantResolve: boolean,
) {
  if (instantResolve) {
    clearTimeout(debounce.t);
    void tryAutoResolve(state, debounce, props);
  } else {
    queueAutoResolveFromInput(state, debounce, props);
  }
}

function syncDraftFromInput(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
  val: string,
  instantResolve = false,
) {
  state.input = val;
  if (state.status === "error") state.status = "idle";

  const trimmed = normalizePassageTyping(val);
  if (!trimmed) {
    clearTimeout(debounce.t);
    state.draft = { book: "", chapter: "", startVerse: "", endVerse: "" };
    return;
  }

  const parsed = parseInputToPassage(trimmed);
  if (parsed) {
    state.draft = draftFromParsed(parsed);
    scheduleResolveAfterDraftSync(state, debounce, props, instantResolve);
    return;
  }

  const alias = resolveBookAlias(trimmed);
  if (alias) {
    state.draft = {
      book: alias,
      chapter: "",
      startVerse: "",
      endVerse: "",
    };
    scheduleResolveAfterDraftSync(state, debounce, props, instantResolve);
    return;
  }

  state.draft = { book: "", chapter: "", startVerse: "", endVerse: "" };
  scheduleResolveAfterDraftSync(state, debounce, props, instantResolve);
}

function syncInputFromDraft(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
  d: StructuredDraft,
) {
  clearTimeout(debounce.t);
  state.draft = d;
  const ref = buildRefString(d);
  if (ref) state.input = ref;
  void tryAutoResolve(state, debounce, props);
}

function tryAutoResolve(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
) {
  const s = state.status;
  if (s === "resolving" || s === "saving" || s === "saved") return;

  const val = state.input.trim();
  if (!val) return;

  const parsed = parseInputToPassage(val);
  if (!parsed || parsed.start.verse == null) return;

  void handleResolve(state, debounce, props);
}

async function handleResolve(
  state: CaptureStatusAware,
  _debounce: { t: ReturnType<typeof setTimeout> | undefined },
  _props: { onSaved: () => void },
) {
  const val = state.input.trim();
  if (!val) return;

  hapticTrigger();
  const parsed = parseInputToPassage(val);
  if (!parsed) {
    state.status = "error";
    state.errorMsg = `Could not parse "${val}" as a Bible reference.`;
    return;
  }

  state.status = "resolving";
  try {
    const passage = await resolvePassage(parsed.canonical);
    if (!passage) {
      state.status = "error";
      state.errorMsg = "Could not resolve that passage.";
      return;
    }
    state.preview = {
      displayRef: passage.displayRef,
      translation: passage.translation,
      text: passage.verses.map((v) => v.text).join(" "),
    };
    state.status = "preview";
  } catch (e) {
    state.status = "error";
    state.errorMsg = e instanceof Error ? e.message : "Network error";
  }
}

async function handleSave(
  state: CaptureStatusAware,
  props: { onSaved: () => void },
) {
  const val = state.input.trim();
  const parsed = parseInputToPassage(val);
  if (!parsed || !state.preview) return;

  hapticTrigger();
  state.status = "saving";
  try {
    const passage = await resolvePassage(parsed.canonical);
    await saveScripturePassageFromCapture({
      content: state.preview.text,
      scripture_ref: parsed.canonical,
      scripture_display_ref: state.preview.displayRef,
      scripture_translation: state.preview.translation,
      scripture_verses: passage?.verses ?? [],
      source: "manual",
      tags: [],
    });
    invalidateClientKindlingIdsCache();
    state.status = "saved";
    setTimeout(() => props.onSaved(), 800);
  } catch (e) {
    state.status = "error";
    state.errorMsg = e instanceof Error ? e.message : "Failed to save";
  }
}

function scriptureEditorSection(
  state: CaptureStatusAware & { draft: StructuredDraft },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void; initialRef?: string },
): ArrowTemplate {
  return html`<div class="${styles.passageEditor}">
    <p class="${styles.builderHint}">
      Choose a book below, or type the reference however you usually write it.
    </p>
    ${() =>
      html`<div class="${styles.pickerGrid}">
        <label class="${styles.pickerField}">
          <span class="${styles.pickerLabel}">Book</span>
          <select
            class="${styles.select}"
            value="${() => state.draft.book as string}"
            @change="${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value as OsisBookCode | "";
              syncInputFromDraft(state, debounce, props, {
                book: v,
                chapter: "",
                startVerse: "",
                endVerse: "",
              });
            }}"
          >
            <option value="">Choose a book</option>
            ${OSIS_BOOK_CODES.map(
              (code) =>
                html`<option value="${code}" title="${OSIS_BOOK_NAMES[code] ?? ""}"
                  >${pickerLabelForOsisBook(code)}</option
                >`,
            )}
          </select>
        </label>
        ${() => scriptureChapterField(state, debounce, props)}
        ${() => scriptureVerseField(state, debounce, props)}
        ${() => scriptureEndVerseField(state, debounce, props)}
      </div>`.key(
        `${state.draft.book}-${state.draft.chapter}-${state.draft.startVerse}-${state.draft.endVerse}`,
      )}
    <div class="${styles.inputGroup}">
      <span class="${styles.inputIcon}">${IconBookOpen({ size: ICON_PX.inline })}</span>
      <input
        id="${PASSAGE_INPUT_ID}"
        type="text"
        placeholder="e.g. John 3:16 · Rev 12 · Ps 23:1–6"
        class="${styles.input}"
        disabled="${() => state.status === "saving"}"
        value="${() => state.input}"
        @input="${(e: Event) =>
          syncDraftFromInput(state, debounce, props, (e.target as HTMLInputElement).value)}"
        @keydown="${(e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === "Enter" && state.status === "idle") {
            void handleResolve(state, debounce, props);
          }
        }}"
      />
    </div>
    ${() => scriptureSuggestionList(state, debounce, props)}
  </div>`;
}

function scriptureChapterField(
  state: CaptureStatusAware & { draft: StructuredDraft },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  const b = scriptureBook(state.draft);
  if (!b) return html``;
  const opts = buildNumericOptions(scriptureChapterCount(state.draft));
  return html`<label class="${styles.pickerField}">
    <span class="${styles.pickerLabel}">Chapter</span>
    <select
      class="${styles.select}"
      value="${() => scriptureBoundedChapter(state.draft)}"
      @change="${(e: Event) => {
        syncInputFromDraft(state, debounce, props, {
          ...state.draft,
          chapter: (e.target as HTMLSelectElement).value,
          startVerse: "",
          endVerse: "",
        });
      }}"
    >
      <option value="">Chapter</option>
      ${opts.map((o) => html`<option value="${o}">${o}</option>`)}
    </select>
  </label>`;
}

function scriptureVerseField(
  state: CaptureStatusAware & { draft: StructuredDraft },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  const b = scriptureBook(state.draft);
  const bc = scriptureBoundedChapter(state.draft);
  if (!b || !bc) return html``;
  const vc = scriptureVerseCount(state.draft);
  const opts = vc > 0 ? buildNumericOptions(vc) : [];
  return html`<label class="${styles.pickerField}">
    <span class="${styles.pickerLabel}">Verse</span>
    <select
      class="${styles.select}"
      value="${() => state.draft.startVerse}"
      @change="${(e: Event) => {
        syncInputFromDraft(state, debounce, props, {
          ...state.draft,
          startVerse: (e.target as HTMLSelectElement).value,
          endVerse: "",
        });
      }}"
    >
      <option value="">Verse</option>
      ${opts.map((o) => html`<option value="${o}">${o}</option>`)}
    </select>
  </label>`;
}

function scriptureEndVerseField(
  state: CaptureStatusAware & { draft: StructuredDraft },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  const b = scriptureBook(state.draft);
  const bc = scriptureBoundedChapter(state.draft);
  if (!b || !bc || !state.draft.startVerse) return html``;
  const vc = scriptureVerseCount(state.draft);
  const sv = parseInt(state.draft.startVerse, 10);
  const opts = sv > 0 && vc > 0 ? buildNumericOptions(vc, sv) : [];
  return html`<label class="${styles.pickerField}">
    <span class="${styles.pickerLabel}">End</span>
    <select
      class="${styles.select}"
      value="${() => state.draft.endVerse}"
      @change="${(e: Event) => {
        syncInputFromDraft(state, debounce, props, {
          ...state.draft,
          endVerse: (e.target as HTMLSelectElement).value,
        });
      }}"
    >
      <option value="">Optional</option>
      ${opts.map((o) => html`<option value="${o}">${o}</option>`)}
    </select>
  </label>`;
}

function scriptureSuggestionList(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  return html`${() => {
    const sugs = scSuggestions(state);
    if (sugs.length === 0 || state.status !== "idle") return html``;
    return html`<div class="${styles.suggestions}">
      ${sugs.map(
        (s) =>
          html`<button
            type="button"
            class="${styles.suggestionItem}"
            @click="${() => {
              hapticTrigger();
              syncDraftFromInput(state, debounce, props, s.insertText, true);
            }}"
          >
            <span>${s.label}</span>
          </button>`,
      )}
    </div>`;
  }}`;
}

function scriptureTopicSection(
  state: CaptureStatusAware & {
    topicsLoadError: string | null;
    canonicalTopics: CanonicalTopic[];
    topicQuery: string;
    topicListCollapsed: boolean;
    activeTopic: CanonicalTopic | null;
    draft: StructuredDraft;
  },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  return html`<div class="${styles.topicSection}">
    <label class="${styles.topicLabel}" for="topic-search">Topic</label>
    <p class="${styles.topicHint}">
      Search a theme; pick a passage suggestion to fill the reference above.
    </p>
    ${() =>
      state.topicsLoadError
        ? html`<p class="${styles.topicError}">${state.topicsLoadError}</p>`
        : html``}
    <div class="${styles.topicField}">
      <input
        id="topic-search"
        type="text"
        class="${styles.topicInput}"
        placeholder="e.g. anxiety, marriage, forgiveness"
        value="${() => state.topicQuery}"
        disabled="${() =>
          !!state.topicsLoadError || state.canonicalTopics.length === 0}"
        autocomplete="off"
        @input="${(e: Event) => {
          state.topicQuery = (e.target as HTMLInputElement).value;
          state.activeTopic = null;
          state.topicListCollapsed = false;
        }}"
      />
      ${() => scriptureTopicMatchesList(state)}
      ${() => scriptureTopicExpandRow(state)}
      ${() => scriptureTopicRefs(state, debounce, props)}
    </div>
  </div>`;
}

function scriptureTopicMatchesList(state: {
  topicQuery: string;
  topicListCollapsed: boolean;
  canonicalTopics: CanonicalTopic[];
  activeTopic: CanonicalTopic | null;
}): ArrowTemplate {
  const q = state.topicQuery.trim();
  const matches = scTopicMatches(state);
  if (!q || matches.length === 0 || state.topicListCollapsed) return html``;
  return html`<div class="${styles.topicMatches}" role="listbox">
    ${matches.map(
      (t) =>
        html`<button
          type="button"
          role="option"
          class="${styles.topicMatchBtn}"
          @click="${() => selectTopic(state, t)}"
        >
          ${t.label}
        </button>`,
    )}
  </div>`;
}

function selectTopic(
  state: {
    topicQuery: string;
    activeTopic: CanonicalTopic | null;
    topicListCollapsed: boolean;
  },
  t: CanonicalTopic,
) {
  hapticTrigger();
  state.topicQuery = t.label;
  state.activeTopic = t;
  state.topicListCollapsed = true;
}

function scriptureTopicExpandRow(state: {
  topicQuery: string;
  topicListCollapsed: boolean;
  canonicalTopics: CanonicalTopic[];
}): ArrowTemplate {
  const q = state.topicQuery.trim();
  const matches = scTopicMatches(state);
  if (!state.topicListCollapsed || !q || matches.length === 0) return html``;
  return html`<div class="${styles.topicExpandRow}">
    <button
      type="button"
      class="${styles.topicExpandBtn}"
      @click="${() => {
        hapticTrigger();
        state.topicListCollapsed = false;
      }}"
      aria-label="Show topic suggestions"
      title="Show topic suggestions"
    >
      ${IconCaretDown({ size: ICON_PX.inline, color: "currentColor" })}
    </button>
  </div>`;
}

function scriptureTopicRefs(
  state: CaptureStatusAware & {
    draft: StructuredDraft;
    activeTopic: CanonicalTopic | null;
  },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  const topic = state.activeTopic;
  if (!topic) return html``;
  return html`<div class="${styles.topicRefs}">
    <span class="${styles.topicRefsLabel}">Suggested passages</span>
    <div class="${styles.topicRefChips}">
      ${topic.topRefs.slice(0, 8).map(
        (ref) =>
          html`<button
            type="button"
            class="${styles.topicRefChip}"
            @click="${() => applyTopicRef(state, debounce, props, ref)}"
          >
            ${topRefToInput(ref)}
          </button>`,
      )}
    </div>
  </div>`;
}

function applyTopicRef(
  state: CaptureStatusAware & { draft: StructuredDraft },
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
  ref: string,
) {
  hapticTrigger();
  const human = topRefToInput(ref);
  syncDraftFromInput(state, debounce, props, human, true);
}

function scriptureParsedPreview(state: { input: string; status: CaptureStatus }): ArrowTemplate {
  const prev = scParsedPreview(state);
  if (!prev || state.status !== "idle") return html``;
  return html`<div class="${styles.parsePreview}" role="status">
    <strong>${prev.display}</strong>
    <code>${prev.canonical}</code>
  </div>`;
}

function scriptureIdleResolveBtn(
  state: CaptureStatusAware,
  debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  if (state.status !== "idle") return html``;
  return html`<button    class="${styles.resolveBtn}"
    @click="${() => void handleResolve(state, debounce, props)}"
  >
    Look up
  </button>`;
}

function scriptureResolving(state: { status: CaptureStatus }): ArrowTemplate {
  if (state.status !== "resolving") return html``;
  return html`<p class="${styles.status}">Resolving...</p>`;
}

function scripturePreviewBlock(
  state: CaptureStatusAware,
  _debounce: { t: ReturnType<typeof setTimeout> | undefined },
  props: { onSaved: () => void },
): ArrowTemplate {
  if (state.status !== "preview" || !state.preview) return html``;
  const pv = state.preview;
  return html`<div class="${styles.preview}">
    <h3 class="${styles.previewRef}">${pv.displayRef}</h3>
    <span class="${styles.previewTrans}">${pv.translation}</span>
    <p class="${styles.previewText}">
      ${pv.text.slice(0, 300)}${pv.text.length > 300 ? "..." : ""}
    </p>
    <button class="${styles.saveBtn}" @click="${() => void handleSave(state, props)}">
      ${IconCheck({ size: ICON_PX.inline })} Kindle
    </button>
  </div>`;
}

function scriptureSaving(state: { status: CaptureStatus }): ArrowTemplate {
  if (state.status !== "saving") return html``;
  return html`<p class="${styles.status}">Saving...</p>`;
}

function scriptureSaved(state: { status: CaptureStatus }): ArrowTemplate {
  if (state.status !== "saved") return html``;
  return html`<div class="${styles.saved}">
    ${IconCheck({ size: ICON_PX.emphasis })}
    <p>Kindled—your flame has something new to grow on.</p>
  </div>`;
}

function scriptureErrorBlock(state: { status: CaptureStatus; errorMsg: string }): ArrowTemplate {
  if (state.status !== "error") return html``;
  return html`<div class="${styles.error}">
    ${IconWarning({ size: ICON_PX.inline })}
    <p>${state.errorMsg}</p>
  </div>`;
}
