import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import {
  invalidateClientKindlingIdsCache,
  saveScripturePassageFromCapture,
} from "../db";
import { isWalletAvailable, broadcastScriptureMemo } from "../solana";
import { resolvePassage } from "../scripture/RouteBibleClient";
import {
  resolveBookAlias,
  autocompletePassage,
  OSIS_BOOK_CODES,
  OSIS_BOOK_NAMES,
  type OsisBookCode,
} from "grab-bcv";
import {
  IconBookOpen,
  IconCaretDown,
  IconCheck,
  IconFire,
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
import {
  hapticLight,
  hapticMedium,
  hapticSave,
  hapticSelection,
} from "../haptics";
import {
  buildNumericOptions,
  buildRefString,
  draftFromParsed,
  displayFromParsed,
  normalizePassageTyping,
  parseCapturePassage,
  scriptureBoundedChapter,
  scriptureBook,
  scriptureChapterCount,
  scriptureVerseCount,
  type StructuredDraft,
} from "./scripture-capture-helpers";

const PASSAGE_INPUT_ID = "scripture-passage-input";

type CaptureStatus =
  | "idle"
  | "resolving"
  | "preview"
  | "saving"
  | "saved"
  | "error";

function topicSectionFollowsPreview(status: CaptureStatus): boolean {
  return status === "preview" || status === "saving" || status === "saved";
}

export function ScriptureCaptureView(props: {
  initialRef?: string;
  onBack: () => void;
  onNavigateHome: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [input, setInput] = createSignal("");
  const [draft, setDraft] = createSignal<StructuredDraft>({
    book: "",
    chapter: "",
    startVerse: "",
    endVerse: "",
  });
  const [status, setStatus] = createSignal<CaptureStatus>("idle");
  const [preview, setPreview] = createSignal<{
    displayRef: string;
    translation: string;
    text: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [canonicalTopics, setCanonicalTopics] = createSignal<CanonicalTopic[]>(
    [],
  );
  const [topicsLoadError, setTopicsLoadError] = createSignal<string | null>(
    null,
  );
  const [topicQuery, setTopicQuery] = createSignal("");
  const [activeTopic, setActiveTopic] = createSignal<CanonicalTopic | null>(
    null,
  );
  const [topicListCollapsed, setTopicListCollapsed] = createSignal(false);
  const [topicSectionCollapsed, setTopicSectionCollapsed] = createSignal(false);
  const [storeToChain, setStoreToChain] = createSignal(false);
  const [walletAvailable, setWalletAvailable] =
    createSignal(isWalletAvailable());

  createEffect(() => {
    // Wallet extensions inject asynchronously after page load.
    // Poll briefly until one appears or we give up after ~5s.
    const interval = setInterval(() => {
      if (isWalletAvailable()) {
        setWalletAvailable(true);
        clearInterval(interval);
      }
    }, 400);
    const timeout = setTimeout(() => clearInterval(interval), 5200);
    onCleanup(() => {
      clearInterval(interval);
      clearTimeout(timeout);
    });
  });

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    clearTimeout(debounceTimer);
    const refFromUrl = props.initialRef?.trim();
    if (refFromUrl) {
      syncDraftFromInput(refFromUrl, true);
    } else {
      queueMicrotask(() => document.getElementById(PASSAGE_INPUT_ID)?.focus());
    }
    void loadCanonicalTopics()
      .then((topics) => setCanonicalTopics(topics))
      .catch(() =>
        setTopicsLoadError(
          "Topic suggestions unavailable (could not load list).",
        ),
      );
  });

  function syncDraftFromInput(val: string, instantResolve = false) {
    setInput(val);
    if (status() === "error") setStatus("idle");

    const trimmed = normalizePassageTyping(val);
    if (!trimmed) {
      clearTimeout(debounceTimer);
      setDraft({ book: "", chapter: "", startVerse: "", endVerse: "" });
      return;
    }

    const parsed = parseCapturePassage(trimmed, draft());
    if (parsed) {
      setDraft(draftFromParsed(parsed));
      scheduleResolve(instantResolve);
      return;
    }

    const alias = resolveBookAlias(trimmed);
    if (alias) {
      setDraft({ book: alias, chapter: "", startVerse: "", endVerse: "" });
      scheduleResolve(instantResolve);
      return;
    }

    setDraft({ book: "", chapter: "", startVerse: "", endVerse: "" });
    scheduleResolve(instantResolve);
  }

  function syncInputFromDraft(d: StructuredDraft) {
    clearTimeout(debounceTimer);
    setDraft(d);
    const ref = buildRefString(d);
    if (ref) setInput(ref);
    void tryAutoResolve();
  }

  function scheduleResolve(instant: boolean) {
    clearTimeout(debounceTimer);
    if (instant) {
      void tryAutoResolve();
    } else {
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void tryAutoResolve();
      }, 320);
    }
  }

  async function tryAutoResolve() {
    const s = status();
    const val = input().trim();
    console.log("[Capture] tryAutoResolve:start", {
      status: s,
      input: val,
      draft: draft(),
    });
    if (s === "resolving" || s === "saving" || s === "saved") {
      console.log("[Capture] tryAutoResolve:skip-status", { status: s });
      return;
    }
    if (!val) {
      console.log("[Capture] tryAutoResolve:skip-empty");
      return;
    }
    const parsed = parseCapturePassage(val, draft());
    console.log("[Capture] tryAutoResolve:parsed", parsed);
    if (!parsed || parsed.start.verse == null) {
      console.log("[Capture] tryAutoResolve:skip-unresolved", { parsed });
      return;
    }
    void handleResolve();
  }

  async function handleResolve() {
    const val = input().trim();
    console.log("[Capture] handleResolve:start", {
      input: val,
      draft: draft(),
      status: status(),
    });
    if (!val) {
      console.log("[Capture] handleResolve:skip-empty");
      return;
    }

    hapticMedium();
    const parsed = parseCapturePassage(val, draft());
    console.log("[Capture] handleResolve:parsed", parsed);
    if (!parsed) {
      setStatus("error");
      setErrorMsg(`Could not parse "${val}" as a Bible reference.`);
      console.log("[Capture] handleResolve:error-parse", { input: val });
      return;
    }

    setStatus("resolving");
    try {
      const passage = await resolvePassage(parsed.canonical);
      console.log("[Capture] handleResolve:resolved", passage);
      if (!passage) {
        setStatus("error");
        setErrorMsg("Could not resolve that passage.");
        console.log("[Capture] handleResolve:error-null", {
          canonical: parsed.canonical,
        });
        return;
      }
      if (passage.verses.length === 0) {
        setStatus("error");
        setErrorMsg(
          `No verse text available for ${passage.displayRef}. Check your connection and try again.`,
        );
        console.log("[Capture] handleResolve:error-empty-verses", {
          canonical: parsed.canonical,
          displayRef: passage.displayRef,
        });
        return;
      }
      setPreview({
        displayRef: passage.displayRef,
        translation: passage.translation,
        text: passage.verses.map((v) => v.text).join(" "),
      });
      setStatus("preview");
      setTopicSectionCollapsed(true);
      console.log("[Capture] handleResolve:preview-ready", {
        canonical: parsed.canonical,
        displayRef: passage.displayRef,
        verseCount: passage.verses.length,
      });
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      console.error("[Capture] handleResolve:exception", e);
    }
  }

  async function handleSave() {
    const val = input().trim();
    const parsed = parseCapturePassage(val, draft());
    const pv = preview();
    console.log("[Capture] handleSave:start", {
      input: val,
      parsed,
      hasPreview: !!pv,
    });
    if (!parsed || !pv) {
      console.log("[Capture] handleSave:skip", { parsed, hasPreview: !!pv });
      return;
    }

    hapticSave();
    setStatus("saving");
    try {
      const passage = await resolvePassage(parsed.canonical);
      console.log("[Capture] handleSave:resolved", {
        canonical: parsed.canonical,
        verseCount: passage?.verses.length ?? 0,
      });
      const { alreadyExisted } = await saveScripturePassageFromCapture({
        content: pv.text,
        scripture_ref: parsed.canonical,
        scripture_display_ref: pv.displayRef,
        scripture_translation: pv.translation,
        scripture_verses: passage?.verses ?? [],
        source: "manual",
        tags: [],
      });
      invalidateClientKindlingIdsCache();

      if (storeToChain() && !alreadyExisted) {
        try {
          const signature = await Promise.race([
            broadcastScriptureMemo(parsed.canonical),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error("Wallet confirmation timed out after 30s")),
                30_000,
              ),
            ),
          ]);
          console.log("[Capture] Permanent backup succeeded:", signature);
        } catch (chainErr) {
          console.error("[Capture] Permanent backup failed:", chainErr);
          // Local save is already persisted; show a non-blocking warning.
          setErrorMsg(
            chainErr instanceof Error
              ? `Saved locally, but permanent backup failed: ${chainErr.message}`
              : "Saved locally, but permanent backup failed.",
          );
        }
      } else if (storeToChain() && alreadyExisted) {
        console.log(
          "[Capture] Skipped permanent backup — already saved locally:",
          parsed.canonical,
        );
      }

      setStatus("saved");
      console.log("[Capture] handleSave:saved", {
        canonical: parsed.canonical,
        displayRef: pv.displayRef,
      });
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
      console.error("[Capture] handleSave:exception", e);
    }
  }

  function resetForNextCapture() {
    setInput("");
    setDraft({ book: "", chapter: "", startVerse: "", endVerse: "" });
    setStatus("idle");
    setPreview(null);
    setErrorMsg("");
    setTopicSectionCollapsed(false);
    queueMicrotask(() => document.getElementById(PASSAGE_INPUT_ID)?.focus());
  }

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={shell.header}>
          <div class={shell.headerNav}>
            <button
              type="button"
              class={shell.logoBtn}
              onClick={() => {
                hapticLight();
                props.onNavigateHome();
              }}
              aria-label="Home"
            >
              <IconFire size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <h1 class={shell.headerTitle}>Capture</h1>
          </div>
          <div class={shell.headerActions} />
        </header>
        <div class={shell.main}>
          <div class={shell.shellContent}>
            <div class={styles.captureLayout}>
              <div class={styles.captureStackEditor}>
                <ScriptureEditorSection
                  input={input()}
                  draft={draft()}
                  status={status()}
                  syncDraftFromInput={syncDraftFromInput}
                  syncInputFromDraft={syncInputFromDraft}
                  handleResolve={() => void handleResolve()}
                />
              </div>
              <div
                class={styles.captureStackTopic}
                style={{ order: topicSectionFollowsPreview(status()) ? 3 : 2 }}
              >
                <ScriptureTopicSection
                  status={status()}
                  canonicalTopics={canonicalTopics()}
                  topicsLoadError={topicsLoadError()}
                  topicQuery={topicQuery()}
                  activeTopic={activeTopic()}
                  topicListCollapsed={topicListCollapsed()}
                  topicSectionCollapsed={topicSectionCollapsed()}
                  draft={draft()}
                  setTopicQuery={setTopicQuery}
                  setActiveTopic={setActiveTopic}
                  setTopicListCollapsed={setTopicListCollapsed}
                  setTopicSectionCollapsed={setTopicSectionCollapsed}
                  syncDraftFromInput={syncDraftFromInput}
                />
              </div>
              <div
                class={styles.captureStackFlow}
                style={{ order: topicSectionFollowsPreview(status()) ? 2 : 3 }}
              >
                <ScriptureParsedPreview
                  inputVal={input()}
                  draft={draft()}
                  status={status()}
                />
                <ScriptureIdleResolveBtn
                  status={status()}
                  onResolve={() => void handleResolve()}
                />
                <ScriptureResolving status={status()} />
                <ScripturePreviewBlock
                  status={status()}
                  preview={preview()}
                  onSave={() => void handleSave()}
                  storeToChain={storeToChain()}
                  onStoreToChainChange={setStoreToChain}
                  walletAvailable={walletAvailable()}
                />
                <ScriptureSaving status={status()} />
                <ScriptureSaved
                  status={status()}
                  preview={preview()}
                  onDismiss={resetForNextCapture}
                />
                <ScriptureErrorBlock status={status()} errorMsg={errorMsg()} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editor Section ───────────────────────────────────────────────

function ScriptureEditorSection(props: {
  input: string;
  draft: StructuredDraft;
  status: CaptureStatus;
  syncDraftFromInput: (val: string, instant?: boolean) => void;
  syncInputFromDraft: (d: StructuredDraft) => void;
  handleResolve: () => void;
}): JSX.Element {
  const d = () => props.draft;

  const suggestions = () => {
    const q = props.input.trim();
    if (!q || props.status !== "idle")
      return [] as { label: string; insertText: string; canonical: string }[];
    const tf = topicPassageQueryFilter(q);
    if (tf) {
      const { book, chapter, versePrefix } = tf;
      return getTopicPassagePicksForBook(book, 6, { chapter, versePrefix }).map(
        (pick) => ({
          label: pick.label,
          insertText: pick.insertText,
          canonical: pick.refOsis,
        }),
      );
    }
    return filterRedundantBookSuggestions(
      q,
      autocompletePassage(q, { limit: 6 }),
    ).map((s) => ({
      label: s.label,
      insertText: s.insertText,
      canonical: s.canonical,
    }));
  };

  return (
    <div class={styles.passageEditor}>
      <p class={styles.builderHint}>
        Choose a book below, or type the reference however you usually write it.
      </p>
      <div class={styles.pickerGrid}>
        <label class={styles.pickerField}>
          <span class={styles.pickerLabel}>Book</span>
          <select
            class={styles.select}
            value={d().book}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value as
                | OsisBookCode
                | "";
              props.syncInputFromDraft({
                book: v,
                chapter: "",
                startVerse: "",
                endVerse: "",
              });
            }}
          >
            <option value="">Choose a book</option>
            {OSIS_BOOK_CODES.map((code) => (
              <option value={code} title={OSIS_BOOK_NAMES[code] ?? ""}>
                {pickerLabelForOsisBook(code)}
              </option>
            ))}
          </select>
        </label>
        <ScriptureChapterField
          draft={d()}
          syncInputFromDraft={props.syncInputFromDraft}
        />
        <ScriptureVerseField
          draft={d()}
          syncInputFromDraft={props.syncInputFromDraft}
        />
        <ScriptureEndVerseField
          draft={d()}
          syncInputFromDraft={props.syncInputFromDraft}
        />
      </div>
      <div class={styles.inputGroup}>
        <span class={styles.inputIcon}>
          <IconBookOpen size={ICON_PX.inline} />
        </span>
        <input
          id={PASSAGE_INPUT_ID}
          type="text"
          placeholder="e.g. John 3:16 · Rev 12 · Ps 23:1–6"
          class={styles.input}
          disabled={props.status === "saving"}
          value={props.input}
          onInput={(e) =>
            props.syncDraftFromInput((e.target as HTMLInputElement).value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && props.status === "idle") {
              props.handleResolve();
            }
          }}
        />
      </div>
      {suggestions().length > 0 && props.status === "idle" && (
        <div class={styles.suggestions}>
          {suggestions().map((s) => (
            <button
              type="button"
              class={styles.suggestionItem}
              onClick={() => {
                hapticLight();
                props.syncDraftFromInput(s.insertText, true);
              }}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptureChapterField(props: {
  draft: StructuredDraft;
  syncInputFromDraft: (d: StructuredDraft) => void;
}): JSX.Element {
  const hasBook = () => !!scriptureBook(props.draft);
  const opts = () => buildNumericOptions(scriptureChapterCount(props.draft));
  return (
    <Show when={hasBook()}>
      <label class={styles.pickerField}>
        <span class={styles.pickerLabel}>Chapter</span>
        <select
          class={styles.select}
          value={scriptureBoundedChapter(props.draft)}
          onChange={(e) => {
            props.syncInputFromDraft({
              ...props.draft,
              chapter: (e.target as HTMLSelectElement).value,
              startVerse: "",
              endVerse: "",
            });
          }}
        >
          <option value="">Chapter</option>
          {opts().map((o) => (
            <option value={o}>{o}</option>
          ))}
        </select>
      </label>
    </Show>
  );
}

function ScriptureVerseField(props: {
  draft: StructuredDraft;
  syncInputFromDraft: (d: StructuredDraft) => void;
}): JSX.Element {
  const ready = () =>
    !!scriptureBook(props.draft) && !!scriptureBoundedChapter(props.draft);
  const opts = () => {
    const vc = scriptureVerseCount(props.draft);
    return vc > 0 ? buildNumericOptions(vc) : [];
  };
  return (
    <Show when={ready()}>
      <label class={styles.pickerField}>
        <span class={styles.pickerLabel}>Verse</span>
        <select
          class={styles.select}
          value={props.draft.startVerse}
          onChange={(e) => {
            props.syncInputFromDraft({
              ...props.draft,
              startVerse: (e.target as HTMLSelectElement).value,
              endVerse: "",
            });
          }}
        >
          <option value="">Verse</option>
          {opts().map((o) => (
            <option value={o}>{o}</option>
          ))}
        </select>
      </label>
    </Show>
  );
}

function ScriptureEndVerseField(props: {
  draft: StructuredDraft;
  syncInputFromDraft: (d: StructuredDraft) => void;
}): JSX.Element {
  const ready = () =>
    !!scriptureBook(props.draft) &&
    !!scriptureBoundedChapter(props.draft) &&
    !!props.draft.startVerse;
  const opts = () => {
    const vc = scriptureVerseCount(props.draft);
    const sv = parseInt(props.draft.startVerse, 10);
    return sv > 0 && vc > 0 ? buildNumericOptions(vc, sv) : [];
  };
  return (
    <Show when={ready()}>
      <label class={styles.pickerField}>
        <span class={styles.pickerLabel}>End</span>
        <select
          class={styles.select}
          value={props.draft.endVerse}
          onChange={(e) => {
            props.syncInputFromDraft({
              ...props.draft,
              endVerse: (e.target as HTMLSelectElement).value,
            });
          }}
        >
          <option value="">Optional</option>
          {opts().map((o) => (
            <option value={o}>{o}</option>
          ))}
        </select>
      </label>
    </Show>
  );
}

// ─── Topic Section ────────────────────────────────────────────────

function ScriptureTopicSection(props: {
  status: CaptureStatus;
  canonicalTopics: CanonicalTopic[];
  topicsLoadError: string | null;
  topicQuery: string;
  activeTopic: CanonicalTopic | null;
  topicListCollapsed: boolean;
  topicSectionCollapsed: boolean;
  draft: StructuredDraft;
  setTopicQuery: (v: string) => void;
  setActiveTopic: (v: CanonicalTopic | null) => void;
  setTopicListCollapsed: (v: boolean) => void;
  setTopicSectionCollapsed: (v: boolean) => void;
  syncDraftFromInput: (val: string, instant?: boolean) => void;
}): JSX.Element {
  const collapsed = () => props.topicSectionCollapsed;
  const summary = () =>
    props.activeTopic
      ? props.activeTopic.label
      : props.topicQuery.trim() || "Choose a topic…";
  const matches = () =>
    searchCanonicalTopics(props.canonicalTopics, props.topicQuery, 8);

  return (
    <Show
      when={!collapsed()}
      fallback={
        <div class={styles.topicSection}>
          <button
            type="button"
            class={styles.topicCollapsedBtn}
            onClick={() => props.setTopicSectionCollapsed(false)}
            aria-label="Expand topic search"
          >
            <span class={styles.topicCollapsedSummary}>{summary()}</span>
            <IconCaretDown size={ICON_PX.inline} color="currentColor" />
          </button>
        </div>
      }
    >
      <div class={styles.topicSection}>
        <button
          type="button"
          class={styles.topicExpandedHeader}
          onClick={() => props.setTopicSectionCollapsed(true)}
          aria-label="Collapse topic search"
        >
          <span class={styles.topicLabel}>Topic</span>
          <IconCaretDown size={ICON_PX.inline} color="currentColor" />
        </button>
        <p class={styles.topicHint}>
          Search a theme; pick a passage suggestion to fill the reference above.
        </p>
        {props.topicsLoadError && (
          <p class={styles.topicError}>{props.topicsLoadError}</p>
        )}
        <div class={styles.topicField}>
          <input
            id="topic-search"
            type="text"
            class={styles.topicInput}
            placeholder="e.g. anxiety, marriage, forgiveness"
            value={props.topicQuery}
            disabled={
              !!props.topicsLoadError || props.canonicalTopics.length === 0
            }
            autocomplete="off"
            onInput={(e) => {
              props.setTopicQuery((e.target as HTMLInputElement).value);
              props.setActiveTopic(null);
              props.setTopicListCollapsed(false);
            }}
          />
          {props.topicQuery.trim() &&
            matches().length > 0 &&
            !props.topicListCollapsed && (
              <div class={styles.topicMatches} role="listbox">
                {matches().map((t) => (
                  <button
                    type="button"
                    role="option"
                    class={styles.topicMatchBtn}
                    onClick={() => {
                      hapticSelection();
                      props.setTopicQuery(t.label);
                      props.setActiveTopic(t);
                      props.setTopicListCollapsed(true);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          {props.topicListCollapsed &&
            props.topicQuery.trim() &&
            matches().length > 0 && (
              <div class={styles.topicExpandRow}>
                <button
                  type="button"
                  class={styles.topicExpandBtn}
                  onClick={() => props.setTopicListCollapsed(false)}
                  aria-label="Show topic suggestions"
                  title="Show topic suggestions"
                >
                  <IconCaretDown size={ICON_PX.inline} color="currentColor" />
                </button>
              </div>
            )}
          {props.activeTopic && (
            <div class={styles.topicRefs}>
              <span class={styles.topicRefsLabel}>Suggested passages</span>
              <div class={styles.topicRefChips}>
                {props.activeTopic.topRefs.slice(0, 8).map((ref) => (
                  <button
                    type="button"
                    class={styles.topicRefChip}
                    onClick={() => {
                      hapticLight();
                      props.syncDraftFromInput(topRefToInput(ref), true);
                    }}
                  >
                    {topRefToInput(ref)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Show>
  );
}

// ─── Status blocks ────────────────────────────────────────────────

function ScriptureParsedPreview(props: {
  inputVal: string;
  draft: StructuredDraft;
  status: CaptureStatus;
}): JSX.Element {
  const parsed = () => parseCapturePassage(props.inputVal.trim(), props.draft);
  const display = () => {
    const p = parsed();
    return p ? displayFromParsed(p) : null;
  };
  return (
    <Show
      when={props.status === "idle" && !!props.inputVal.trim() && !!display()}
    >
      <div class={styles.parsePreview} role="status">
        <strong>{display()!.display}</strong>
        <code>{display()!.canonical}</code>
      </div>
    </Show>
  );
}

function ScriptureIdleResolveBtn(props: {
  status: CaptureStatus;
  onResolve: () => void;
}): JSX.Element {
  return (
    <Show when={props.status === "idle"}>
      <button class={styles.resolveBtn} onClick={props.onResolve}>
        Look up
      </button>
    </Show>
  );
}

function ScriptureResolving(props: { status: CaptureStatus }): JSX.Element {
  return (
    <Show when={props.status === "resolving"}>
      <p class={styles.status}>Resolving...</p>
    </Show>
  );
}

function ScripturePreviewBlock(props: {
  status: CaptureStatus;
  preview: { displayRef: string; translation: string; text: string } | null;
  onSave: () => void;
  storeToChain: boolean;
  onStoreToChainChange: (v: boolean) => void;
  walletAvailable: boolean;
}): JSX.Element {
  return (
    <Show when={props.status === "preview" && !!props.preview}>
      <div class={styles.preview}>
        <h3 class={styles.previewRef}>{props.preview!.displayRef}</h3>
        <span class={styles.previewTrans}>{props.preview!.translation}</span>
        <p class={styles.previewText}>
          {props.preview!.text.slice(0, 300)}
          {props.preview!.text.length > 300 ? "..." : ""}
        </p>
        <label class={styles.chainToggle}>
          <input
            type="checkbox"
            checked={props.storeToChain}
            disabled={!props.walletAvailable}
            onChange={(e) =>
              props.onStoreToChainChange(e.currentTarget.checked)
            }
          />
          <span>Save permanently</span>
          {!props.walletAvailable && (
            <span class={styles.chainHint}>
              Install a Solana wallet to enable permanent backup
            </span>
          )}
        </label>
        <button class={styles.saveBtn} onClick={props.onSave}>
          <IconCheck size={ICON_PX.inline} /> Kindle
        </button>
      </div>
    </Show>
  );
}

function ScriptureSaving(props: { status: CaptureStatus }): JSX.Element {
  return (
    <Show when={props.status === "saving"}>
      <p class={styles.status}>Saving...</p>
    </Show>
  );
}

function ScriptureSaved(props: {
  status: CaptureStatus;
  preview: { displayRef: string; translation: string; text: string } | null;
  onDismiss: () => void;
}): JSX.Element {
  const dismiss = () => {
    hapticLight();
    props.onDismiss();
  };

  return (
    <Show when={props.status === "saved"}>
      <div
        class={styles.savedOverlay}
        role="button"
        tabindex={0}
        aria-label="Passage kindled. Tap or press any key to continue."
        onClick={dismiss}
        onKeyDown={(e) => {
          e.preventDefault();
          dismiss();
        }}
      >
        <div class={styles.savedCard} onClick={dismiss}>
          <div class={styles.savedCheck}>
            <IconCheck size={ICON_PX.celebration} />
          </div>
          <h2 class={styles.savedTitle}>Kindled</h2>
          <p class={styles.savedRef}>
            {props.preview?.displayRef ?? "Passage"}
          </p>
          <p class={styles.savedText}>
            {(props.preview?.text ?? "").slice(0, 120)}
            {(props.preview?.text ?? "").length > 120 ? "…" : ""}
          </p>
          <span class={styles.savedDismiss}>tap to continue</span>
        </div>
      </div>
    </Show>
  );
}

function ScriptureErrorBlock(props: {
  status: CaptureStatus;
  errorMsg: string;
}): JSX.Element {
  return (
    <Show when={props.status === "error"}>
      <div class={styles.error}>
        <IconWarning size={ICON_PX.inline} />
        <p>{props.errorMsg}</p>
      </div>
    </Show>
  );
}
