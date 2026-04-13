import { createSignal, createMemo, onMount, onCleanup, Show, For } from "solid-js";
import { invalidateClientKindlingIdsCache, saveScripturePassageFromCapture } from "../db";
import { resolvePassage } from "../scripture/RouteBibleClient";
import {
  tryParsePassage,
  findAnyPassage,
  resolveBookAlias,
  autocompletePassage,
  OSIS_BOOK_CODES,
  OSIS_BOOK_NAMES,
  BOOK_CHAPTER_COUNTS,
  BOOK_VERSE_COUNTS,
  type OsisBookCode,
  type ParsedPassage,
} from "grab-bcv";
import {
  IconArrowLeft,
  IconBookOpen,
  IconCaretDown,
  IconCheck,
  IconWarning,
} from "../ui/Icons";
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

interface StructuredDraft {
  book: OsisBookCode | "";
  chapter: string;
  startVerse: string;
  endVerse: string;
}

function buildNumericOptions(max: number, start = 1): string[] {
  return Array.from({ length: Math.max(max - start + 1, 0) }, (_, i) => String(i + start));
}

function draftFromParsed(p: ParsedPassage): StructuredDraft {
  const start = p.start;
  const end = p.end;
  const startVerse = start.verse != null ? String(start.verse) : "";
  let endVerse = "";
  if (
    start.verse != null &&
    end.verse != null &&
    end.book === start.book &&
    end.chapter === start.chapter &&
    end.verse !== start.verse
  ) {
    endVerse = String(end.verse);
  }
  return {
    book: start.book,
    chapter: String(start.chapter),
    startVerse,
    endVerse,
  };
}

function displayFromParsed(p: ParsedPassage): { display: string; canonical: string } {
  const bookName = OSIS_BOOK_NAMES[p.start.book] ?? p.start.book;
  const hasVerse = p.start.verse != null;
  const display =
    hasVerse && p.end.verse != null && p.start.verse !== p.end.verse
      ? `${bookName} ${p.start.chapter}:${p.start.verse}-${p.end.verse}`
      : hasVerse
        ? `${bookName} ${p.start.chapter}:${p.start.verse}`
        : `${bookName} ${p.start.chapter}`;
  return { display, canonical: p.canonical };
}

/** Strict parse first, then passage embedded in larger text (`findAnyPassage`). */
function parseInputToPassage(val: string): ParsedPassage | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const strict = tryParsePassage(trimmed);
  if (strict.ok) return strict.value;
  return findAnyPassage(trimmed);
}

export function ScriptureCapture(props: {
  /** From URL deep link (`?ref=…`) — prefill input and resolve preview when possible */
  initialRef?: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = createSignal("");
  const [draft, setDraft] = createSignal<StructuredDraft>({
    book: "",
    chapter: "",
    startVerse: "",
    endVerse: "",
  });
  const [status, setStatus] = createSignal<
    "idle" | "resolving" | "preview" | "saving" | "saved" | "error"
  >("idle");
  const [preview, setPreview] = createSignal<{
    displayRef: string;
    translation: string;
    text: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [canonicalTopics, setCanonicalTopics] = createSignal<CanonicalTopic[]>([]);
  const [topicsLoadError, setTopicsLoadError] = createSignal<string | null>(null);
  const [topicQuery, setTopicQuery] = createSignal("");
  const [activeTopic, setActiveTopic] = createSignal<CanonicalTopic | null>(null);
  /** After picking a topic, hide the match list until user expands or edits the query. */
  const [topicListCollapsed, setTopicListCollapsed] = createSignal(false);

  let autoResolveDebounce: ReturnType<typeof setTimeout> | undefined;
  let passageInputRef: HTMLInputElement | undefined;

  onMount(() => {
    const refFromUrl = props.initialRef?.trim();
    if (refFromUrl) {
      syncDraftFromInput(refFromUrl, true);
    } else {
      queueMicrotask(() => passageInputRef?.focus());
    }

    void loadCanonicalTopics()
      .then(setCanonicalTopics)
      .catch(() =>
        setTopicsLoadError("Topic suggestions unavailable (could not load list)."),
      );
  });

  onCleanup(() => clearTimeout(autoResolveDebounce));

  const book = createMemo(() => {
    const b = draft().book;
    return b || null;
  });
  const chapterCount = createMemo(() =>
    book() ? BOOK_CHAPTER_COUNTS[book()!] : 0,
  );
  const chapterOptions = createMemo(() =>
    book() ? buildNumericOptions(chapterCount()) : [],
  );
  const boundedChapter = createMemo(() => {
    const ch = parseInt(draft().chapter, 10);
    const max = chapterCount();
    return ch > 0 && max > 0 ? String(Math.min(ch, max)) : "";
  });
  const verseCount = createMemo(() => {
    if (!book() || !boundedChapter()) return 0;
    return BOOK_VERSE_COUNTS[book()!]?.[parseInt(boundedChapter(), 10)] ?? 0;
  });
  const verseOptions = createMemo(() =>
    verseCount() > 0 ? buildNumericOptions(verseCount()) : [],
  );
  const endVerseOptions = createMemo(() => {
    const sv = parseInt(draft().startVerse, 10);
    return sv > 0 && verseCount() > 0 ? buildNumericOptions(verseCount(), sv) : [];
  });

  const suggestions = createMemo(() => {
    const q = input().trim();
    if (!q || status() !== "idle") return [];
    const tf = topicPassageQueryFilter(q);
    if (tf) {
      const { book, chapter, versePrefix } = tf;
      return getTopicPassagePicksForBook(book, 6, { chapter, versePrefix }).map((pick) => ({
        label: pick.label,
        insertText: pick.insertText,
        canonical: pick.refOsis,
        kind: "verse" as const,
      }));
    }
    return filterRedundantBookSuggestions(q, autocompletePassage(q, { limit: 6 }));
  });

  const topicMatches = createMemo(() =>
    searchCanonicalTopics(canonicalTopics(), topicQuery(), 8),
  );

  const parsedPreview = createMemo(() => {
    const val = input().trim();
    if (!val) return null;
    const p = parseInputToPassage(val);
    if (!p) return null;
    return displayFromParsed(p);
  });

  const buildRefString = (d: StructuredDraft): string => {
    if (!d.book) return "";
    const name = OSIS_BOOK_NAMES[d.book];
    if (!d.chapter) return name;
    if (!d.startVerse) return `${name} ${d.chapter}`;
    return d.endVerse
      ? `${name} ${d.chapter}:${d.startVerse}-${d.endVerse}`
      : `${name} ${d.chapter}:${d.startVerse}`;
  };

  const queueAutoResolveFromInput = () => {
    clearTimeout(autoResolveDebounce);
    autoResolveDebounce = setTimeout(() => {
      autoResolveDebounce = undefined;
      void tryAutoResolve();
    }, 320);
  };

  const scheduleResolveAfterDraftSync = (instantResolve: boolean) => {
    if (instantResolve) {
      clearTimeout(autoResolveDebounce);
      void tryAutoResolve();
    } else {
      queueAutoResolveFromInput();
    }
  };

  const syncDraftFromInput = (val: string, instantResolve = false) => {
    setInput(val);
    if (status() === "error") setStatus("idle");

    const trimmed = val.trim();
    if (!trimmed) {
      clearTimeout(autoResolveDebounce);
      setDraft({ book: "", chapter: "", startVerse: "", endVerse: "" });
      return;
    }

    const strict = tryParsePassage(trimmed);
    if (strict.ok) {
      setDraft(draftFromParsed(strict.value));
      scheduleResolveAfterDraftSync(instantResolve);
      return;
    }

    const found = findAnyPassage(trimmed);
    if (found) {
      setDraft(draftFromParsed(found));
      scheduleResolveAfterDraftSync(instantResolve);
      return;
    }

    const alias = resolveBookAlias(trimmed);
    if (alias) {
      setDraft({
        book: alias,
        chapter: "",
        startVerse: "",
        endVerse: "",
      });
      scheduleResolveAfterDraftSync(instantResolve);
      return;
    }

    setDraft({ book: "", chapter: "", startVerse: "", endVerse: "" });
    scheduleResolveAfterDraftSync(instantResolve);
  };

  const syncInputFromDraft = (d: StructuredDraft) => {
    clearTimeout(autoResolveDebounce);
    setDraft(d);
    const ref = buildRefString(d);
    if (ref) setInput(ref);
    void tryAutoResolve();
  };

  const tryAutoResolve = () => {
    const s = status();
    if (s === "resolving" || s === "saving" || s === "saved") return;

    const val = input().trim();
    if (!val) return;

    const parsed = parseInputToPassage(val);
    if (!parsed || parsed.start.verse == null) return;

    void handleResolve();
  };

  const handleResolve = async () => {
    const val = input().trim();
    if (!val) return;

    const parsed = parseInputToPassage(val);
    if (!parsed) {
      setStatus("error");
      setErrorMsg(`Could not parse "${val}" as a Bible reference.`);
      return;
    }

    setStatus("resolving");
    try {
      const passage = await resolvePassage(parsed.canonical);
      if (!passage) {
        setStatus("error");
        setErrorMsg("Could not resolve that passage.");
        return;
      }
      setPreview({
        displayRef: passage.displayRef,
        translation: passage.translation,
        text: passage.verses.map((v) => v.text).join(" "),
      });
      setStatus("preview");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Network error");
    }
  };

  const handleSave = async () => {
    const val = input().trim();
    const parsed = parseInputToPassage(val);
    if (!parsed || !preview()) return;

    setStatus("saving");
    try {
      const passage = await resolvePassage(parsed.canonical);
      await saveScripturePassageFromCapture({
        content: preview()!.text,
        scripture_ref: parsed.canonical,
        scripture_display_ref: preview()!.displayRef,
        scripture_translation: preview()!.translation,
        scripture_verses: passage?.verses ?? [],
        source: "manual",
        tags: [],
      });
      invalidateClientKindlingIdsCache();
      setStatus("saved");
      setTimeout(() => props.onSaved(), 800);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && status() === "idle") {
      handleResolve();
    }
  };

  const applyTopicRef = (ref: string) => {
    const human = topRefToInput(ref);
    syncDraftFromInput(human, true);
  };

  const selectTopic = (t: CanonicalTopic) => {
    setTopicQuery(t.label);
    setActiveTopic(t);
    setTopicListCollapsed(true);
  };

  const showTopicMatchList = () => setTopicListCollapsed(false);

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={shell.header}>
          <div class={shell.headerLeading}>
            <button type="button" class={shell.backBtn} onClick={props.onBack} aria-label="Back">
              <IconArrowLeft size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <h1 class={shell.headerTitle}>Passage</h1>
          </div>
          <div class={shell.headerTrailing} aria-hidden="true" />
        </header>

        <div class={shell.main}>
        <div class={shell.shellContent}>
        <div class={styles.passageEditor}>
          <p class={styles.builderHint}>
            Choose a book below, or type the reference however you usually write it.
          </p>
          <div class={styles.pickerGrid}>
            <label class={styles.pickerField}>
              <span class={styles.pickerLabel}>Book</span>
              <select
                value={draft().book}
                onChange={(e) =>
                  syncInputFromDraft({
                    book: (e.target as HTMLSelectElement).value as OsisBookCode | "",
                    chapter: "",
                    startVerse: "",
                    endVerse: "",
                  })
                }
                class={styles.select}
              >
                <option value="">Choose a book</option>
                {OSIS_BOOK_CODES.map((code) => (
                  <option value={code} title={OSIS_BOOK_NAMES[code]}>
                    {pickerLabelForOsisBook(code)}
                  </option>
                ))}
              </select>
            </label>

            {book() && (
              <label class={styles.pickerField}>
                <span class={styles.pickerLabel}>Chapter</span>
                <select
                  value={boundedChapter()}
                  onChange={(e) =>
                    syncInputFromDraft({
                      ...draft(),
                      chapter: (e.target as HTMLSelectElement).value,
                      startVerse: "",
                      endVerse: "",
                    })
                  }
                  class={styles.select}
                >
                  <option value="">Chapter</option>
                  {chapterOptions().map((o) => (
                    <option value={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}

            {book() && boundedChapter() && (
              <label class={styles.pickerField}>
                <span class={styles.pickerLabel}>Verse</span>
                <select
                  value={draft().startVerse}
                  onChange={(e) =>
                    syncInputFromDraft({
                      ...draft(),
                      startVerse: (e.target as HTMLSelectElement).value,
                      endVerse: "",
                    })
                  }
                  class={styles.select}
                >
                  <option value="">Verse</option>
                  {verseOptions().map((o) => (
                    <option value={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}

            {book() && boundedChapter() && draft().startVerse && (
              <label class={styles.pickerField}>
                <span class={styles.pickerLabel}>End</span>
                <select
                  value={draft().endVerse}
                  onChange={(e) =>
                    syncInputFromDraft({
                      ...draft(),
                      endVerse: (e.target as HTMLSelectElement).value,
                    })
                  }
                  class={styles.select}
                >
                  <option value="">Optional</option>
                  {endVerseOptions().map((o) => (
                    <option value={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div class={styles.inputGroup}>
            <span class={styles.inputIcon}>
              <IconBookOpen size={ICON_PX.inline} />
            </span>
            <input
              ref={(el) => {
                passageInputRef = el;
              }}
              type="text"
              placeholder="e.g. John 3:16 · Rev 12 · Ps 23:1–6"
              value={input()}
              onInput={(e) => syncDraftFromInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              class={styles.input}
              disabled={status() === "saving"}
            />
          </div>

          {suggestions().length > 0 && status() === "idle" && (
            <div class={styles.suggestions}>
              {suggestions().map((s) => (
                <button
                  type="button"
                  class={styles.suggestionItem}
                  onClick={() => syncDraftFromInput(s.insertText, true)}
                >
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div class={styles.topicSection}>
          <label class={styles.topicLabel} for="topic-search">
            Topic
          </label>
          <p class={styles.topicHint}>
            Search a theme; pick a passage suggestion to fill the reference above.
          </p>
          <Show when={topicsLoadError()}>
            <p class={styles.topicError}>{topicsLoadError()}</p>
          </Show>
          <div class={styles.topicField}>
            <input
              id="topic-search"
              type="text"
              class={styles.topicInput}
              placeholder="e.g. anxiety, marriage, forgiveness"
              value={topicQuery()}
              onInput={(e) => {
                setTopicQuery(e.currentTarget.value);
                setActiveTopic(null);
                setTopicListCollapsed(false);
              }}
              disabled={!!topicsLoadError() || canonicalTopics().length === 0}
              autocomplete="off"
            />
            <Show
              when={
                topicQuery().trim() &&
                topicMatches().length > 0 &&
                !topicListCollapsed()
              }
            >
              <div class={styles.topicMatches} role="listbox">
                <For each={topicMatches()}>
                  {(t) => (
                    <button
                      type="button"
                      role="option"
                      class={styles.topicMatchBtn}
                      onClick={() => selectTopic(t)}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <Show
              when={
                topicListCollapsed() &&
                topicQuery().trim() &&
                topicMatches().length > 0
              }
            >
              <div class={styles.topicExpandRow}>
                <button
                  type="button"
                  class={styles.topicExpandBtn}
                  onClick={showTopicMatchList}
                  aria-label="Show topic suggestions"
                  title="Show topic suggestions"
                >
                  <IconCaretDown size={ICON_PX.inline} color="currentColor" />
                </button>
              </div>
            </Show>
            <Show when={activeTopic()}>
              {(topic) => (
                <div class={styles.topicRefs}>
                  <span class={styles.topicRefsLabel}>Suggested passages</span>
                  <div class={styles.topicRefChips}>
                    <For each={topic().topRefs.slice(0, 8)}>
                      {(ref) => (
                        <button
                          type="button"
                          class={styles.topicRefChip}
                          onClick={() => applyTopicRef(ref)}
                        >
                          {topRefToInput(ref)}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>

        {parsedPreview() && status() === "idle" && (
          <div class={styles.parsePreview} role="status">
            <strong>{parsedPreview()!.display}</strong>
            <code>{parsedPreview()!.canonical}</code>
          </div>
        )}

        {status() === "idle" && (
          <button class={styles.resolveBtn} onClick={handleResolve}>
            Look up
          </button>
        )}

        {status() === "resolving" && (
          <p class={styles.status}>Resolving...</p>
        )}

        {status() === "preview" && preview() && (
          <div class={styles.preview}>
            <h3 class={styles.previewRef}>{preview()!.displayRef}</h3>
            <span class={styles.previewTrans}>{preview()!.translation}</span>
            <p class={styles.previewText}>
              {preview()!.text.slice(0, 300)}
              {preview()!.text.length > 300 ? "..." : ""}
            </p>
            <button class={styles.saveBtn} onClick={handleSave}>
              <IconCheck size={ICON_PX.inline} /> Kindle
            </button>
          </div>
        )}

        {status() === "saving" && (
          <p class={styles.status}>Saving...</p>
        )}

        {status() === "saved" && (
          <div class={styles.saved}>
            <IconCheck size={ICON_PX.emphasis} />
            <p>Kindled—your flame has something new to grow on.</p>
          </div>
        )}

        {status() === "error" && (
          <div class={styles.error}>
            <IconWarning size={ICON_PX.inline} />
            <p>{errorMsg()}</p>
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
