import { createSignal, createMemo } from "solid-js";
import { createBlock } from "../db";
import { resolvePassage } from "../scripture/RouteBibleClient";
import { parseRef } from "../scripture/RefNormalizer";
import {
  isBookCode,
  BOOK_CODES,
  BOOK_NAMES,
  getChapterCount,
  getVerseCount,
  buildNumericOptions,
  buildRefString,
  parseStructured,
  autocompleteBooks,
  type BookCode,
  type StructuredDraft,
} from "../scripture/BibleData";
import { IconArrowLeft, IconBookOpen, IconCheck, IconWarning } from "../ui/Icons";
import styles from "./ScriptureCapture.module.css";

export function ScriptureCapture(props: {
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

  // Derived state from draft
  const book = createMemo(() => {
    const b = draft().book;
    return isBookCode(b) ? b : null;
  });
  const chapterCount = createMemo(() => (book() ? getChapterCount(book()!) : 0));
  const chapterOptions = createMemo(() =>
    book() ? buildNumericOptions(chapterCount()) : [],
  );
  const boundedChapter = createMemo(() => {
    const ch = parseInt(draft().chapter, 10);
    const max = chapterCount();
    return ch > 0 && max > 0 ? String(Math.min(ch, max)) : "";
  });
  const verseCount = createMemo(() =>
    book() && boundedChapter()
      ? (getVerseCount(book()!, parseInt(boundedChapter(), 10)) ?? 0)
      : 0,
  );
  const verseOptions = createMemo(() =>
    verseCount() > 0 ? buildNumericOptions(verseCount()) : [],
  );
  const endVerseOptions = createMemo(() => {
    const sv = parseInt(draft().startVerse, 10);
    return sv > 0 && verseCount() > 0
      ? buildNumericOptions(verseCount(), sv)
      : [];
  });

  // Autocomplete suggestions from text input
  const suggestions = createMemo(() => {
    const q = input().trim();
    if (!q || status() !== "idle") return [];
    return autocompleteBooks(q, 6);
  });

  const parsedPreview = createMemo(() => {
    const val = input().trim();
    if (!val) return null;
    const parsed = parseRef(val);
    if (!parsed) return null;
    return { display: parsed.display, canonical: parsed.canonical };
  });

  // Sync: text input -> structured draft
  const syncDraftFromInput = (val: string) => {
    setInput(val);
    if (status() === "error") setStatus("idle");
    const d = parseStructured(val);
    if (d.book) setDraft(d);
  };

  // Sync: structured draft -> text input
  const syncInputFromDraft = (d: StructuredDraft) => {
    setDraft(d);
    const ref = buildRefString(d);
    if (ref) setInput(ref);
  };

  const handleResolve = async () => {
    const val = input().trim();
    if (!val) return;

    const parsed = parseRef(val);
    if (!parsed) {
      setStatus("error");
      setErrorMsg(`Could not parse "${val}" as a Bible reference.`);
      return;
    }

    setStatus("resolving");
    try {
      const passage = await resolvePassage(val);
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
    const parsed = parseRef(val);
    if (!parsed || !preview()) return;

    setStatus("saving");
    try {
      const passage = await resolvePassage(val);
      await createBlock({
        type: "scripture",
        content: preview()!.text,
        scripture_ref: parsed.canonical,
        scripture_display_ref: preview()!.displayRef,
        scripture_translation: preview()!.translation,
        scripture_verses: passage?.verses ?? [],
        source: "manual",
        tags: [],
      });
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

  return (
    <div class={styles.view}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={props.onBack}>
          <IconArrowLeft size={20} />
        </button>
        <h1 class={styles.title}>Capture Passage</h1>
        <div style={{ width: "20px" }} />
      </div>

      <div class={styles.body}>
        {/* Structured picker */}
        <div class={styles.builder}>
          <p class={styles.builderHint}>
            Pick a book, then chapter and verses as needed.
          </p>
          <div class={styles.pickerGrid}>
            <label class={styles.pickerField}>
              <span class={styles.pickerLabel}>Book</span>
              <select
                value={draft().book}
                onChange={(e) =>
                  syncInputFromDraft({
                    book: (e.target as HTMLSelectElement).value as BookCode | "",
                    chapter: "",
                    startVerse: "",
                    endVerse: "",
                  })
                }
                class={styles.select}
              >
                <option value="">Choose a book</option>
                {BOOK_CODES.map((code) => (
                  <option value={code}>{BOOK_NAMES[code]}</option>
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
        </div>

        {/* Text input synced to picks */}
        <div class={styles.inputGroup}>
          <span class={styles.inputIcon}>
            <IconBookOpen size={16} />
          </span>
          <input
            type="text"
            placeholder="John 3:16, Psalm 23:1-6..."
            value={input()}
            onInput={(e) => syncDraftFromInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            class={styles.input}
            disabled={status() === "resolving" || status() === "saving"}
          />
        </div>

        {/* Autocomplete suggestions */}
        {suggestions().length > 0 && status() === "idle" && (
          <div class={styles.suggestions}>
            {suggestions().map((s) => (
              <button
                type="button"
                class={styles.suggestionItem}
                onClick={() => {
                  setInput(s.name);
                  setDraft({ book: s.code, chapter: "", startVerse: "", endVerse: "" });
                }}
              >
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Parse preview */}
        {parsedPreview() && status() === "idle" && (
          <div class={styles.parsePreview}>
            <span class={styles.parseLabel}>parsed</span>
            <strong>{parsedPreview()!.display}</strong>
            <code>{parsedPreview()!.canonical}</code>
          </div>
        )}

        {status() === "idle" && (
          <button class={styles.resolveBtn} onClick={handleResolve}>
            Resolve Passage
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
              <IconCheck size={16} /> Plant Seed
            </button>
          </div>
        )}

        {status() === "saving" && (
          <p class={styles.status}>Planting...</p>
        )}

        {status() === "saved" && (
          <div class={styles.saved}>
            <IconCheck size={24} />
            <p>Seed planted in your garden.</p>
          </div>
        )}

        {status() === "error" && (
          <div class={styles.error}>
            <IconWarning size={16} />
            <p>{errorMsg()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
