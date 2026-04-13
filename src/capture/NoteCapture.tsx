import { createSignal, createMemo, onMount, Show, For } from "solid-js";
import {
  getBlock,
  getReflection,
  createReflection,
  updateReflection,
  createLink,
  deleteLinksForReflection,
  createBlock,
  getAllEntities,
  type Entity,
} from "../db";
import { parseWikiLinks, getSurroundingContext } from "../links/WikiLinkParser";
import { findOrCreateEntity } from "../links/EntityResolver";
import {
  autocompletePassage,
  findAnyPassage,
  OSIS_BOOK_NAMES,
  type OsisBookCode,
} from "grab-bcv";
import { getTopicPassagePicksForBook, loadCanonicalTopics } from "../scripture/canonicalTopics";
import {
  filterRedundantBookSuggestions,
  topicPassageQueryFilter,
} from "../scripture/passageAutocomplete";
import { resolvePassage } from "../scripture/RouteBibleClient";
import { ICON_PX } from "../ui/icon-sizes";
import { IconArrowLeft, IconCheck, IconBookOpen, IconUser, IconMapPin } from "../ui/Icons";
import shell from "../ui/app-shell.module.css";
import { applyWikiLinkSuggestion } from "./wikiLinkAutocomplete";
import styles from "./NoteCapture.module.css";
import { hapticTrigger } from "../haptics";

interface Suggestion {
  label: string;
  insertText: string;
  type: "passage" | "entity";
  icon: typeof IconBookOpen;
}

function getWikiLinkContext(
  text: string,
  cursorPos: number,
): { query: string; start: number; end: number } | null {
  const before = text.slice(0, cursorPos);
  const openIdx = before.lastIndexOf("[[");
  if (openIdx === -1) return null;

  const afterOpen = text.slice(openIdx + 2);
  const closeIdx = afterOpen.indexOf("]]");
  if (closeIdx !== -1 && openIdx + 2 + closeIdx < cursorPos) return null;

  const query = text.slice(openIdx + 2, cursorPos);
  return { query, start: openIdx, end: cursorPos };
}

export function NoteCapture(props: {
  passageId: string;
  displayRef: string;
  /** When set, save updates this reflection instead of creating a new one. */
  reflectionId?: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [entities, setEntities] = createSignal<Entity[]>([]);
  const [cursorPos, setCursorPos] = createSignal(0);
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  let textareaRef: HTMLTextAreaElement | undefined;

  onMount(async () => {
    const [all, , existing] = await Promise.all([
      getAllEntities(),
      loadCanonicalTopics(),
      props.reflectionId ? getReflection(props.reflectionId) : Promise.resolve(null),
    ]);
    setEntities(all);
    if (existing) setText(existing.body);
  });

  const linkCtx = createMemo(() => {
    const t = text();
    const pos = cursorPos();
    return getWikiLinkContext(t, pos);
  });

  const suggestions = createMemo(() => {
    const ctx = linkCtx();
    if (!ctx) return [];

    const q = ctx.query.trim();
    const results: Suggestion[] = [];

    // Bible passage suggestions: topic picks once a book is fixed; else grab-bcv
    if (q.length >= 1) {
      const tf = topicPassageQueryFilter(q);
      if (tf) {
        const { book, chapter, versePrefix } = tf;
        for (const pick of getTopicPassagePicksForBook(book, 6, { chapter, versePrefix })) {
          results.push({
            label: pick.label,
            insertText: pick.insertText,
            type: "passage",
            icon: IconBookOpen,
          });
        }
      } else {
        const passages = filterRedundantBookSuggestions(q, autocompletePassage(q, { limit: 4 }));
        for (const p of passages) {
          results.push({
            label: p.label,
            insertText: p.insertText,
            type: "passage",
            icon: IconBookOpen,
          });
        }
      }
    }

    // Entity suggestions (people, places, themes, events)
    const ql = q.toLowerCase();
    const matched = entities().filter((e) => {
      if (ql.length === 0) return true;
      return (
        e.name.toLowerCase().includes(ql) ||
        e.aliases.some((a) => a.toLowerCase().includes(ql))
      );
    });
    for (const e of matched.slice(0, 4)) {
      results.push({
        label: e.name,
        insertText: e.name,
        type: "entity",
        icon:
          e.type === "person"
            ? IconUser
            : e.type === "place"
              ? IconMapPin
              : IconBookOpen,
      });
    }

    return results.slice(0, 8);
  });

  const applySuggestion = (s: Suggestion) => {
    const ctx = linkCtx();
    if (!ctx || !textareaRef) return;

    hapticTrigger();
    const { text: newText, cursor: newCursor } = applyWikiLinkSuggestion(
      text(),
      ctx.start,
      ctx.end,
      s.insertText,
    );
    setText(newText);

    /* Cursor after insertText, before any existing `]]` — keeps typing inside the link */
    requestAnimationFrame(() => {
      textareaRef!.selectionStart = newCursor;
      textareaRef!.selectionEnd = newCursor;
      textareaRef!.focus();
    });
    setCursorPos(newCursor);
  };

  const handleInput = (e: Event) => {
    const ta = e.currentTarget as HTMLTextAreaElement;
    setText(ta.value);
    setCursorPos(ta.selectionStart);
    setSelectedIdx(0);
  };

  const handleKey = (e: KeyboardEvent) => {
    const sugs = suggestions();
    if (sugs.length > 0 && linkCtx()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, sugs.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(sugs[selectedIdx()]);
        return;
      }
      if (e.key === "Escape") {
        setCursorPos(-1);
        return;
      }
    }
  };

  const handleSave = async () => {
    hapticTrigger();
    if (!text().trim()) {
      props.onBack();
      return;
    }
    setSaving(true);
    try {
      const block = await getBlock(props.passageId);
      if (!block) {
        setSaving(false);
        return;
      }
      const noteText = text().trim();
      let reflectionId = props.reflectionId;

      if (reflectionId) {
        await deleteLinksForReflection(reflectionId);
        await updateReflection(reflectionId, noteText);
      } else {
        reflectionId = await createReflection(block.id, noteText);
      }

      const parsed = parseWikiLinks(noteText);
      for (const link of parsed) {
        await processLink(block.id, reflectionId, link.text, noteText);
      }

      await autoLinkPassages(block.id, reflectionId, noteText);
      await autoLinkEntities(block.id, reflectionId, noteText);

      props.onSaved();
    } catch {
      setSaving(false);
    }
  };

  const processLink = async (
    blockId: string,
    reflectionId: string,
    linkText: string,
    fullText: string,
  ) => {
    // Try as Bible passage first
    const passageResult = await resolvePassage(linkText);
    if (passageResult && passageResult.verses.length > 0) {
      const existingId = await findScriptureBlockByRef(passageResult.ref);
      const targetId =
        existingId ??
        (await createBlock({
          type: "scripture",
          content: passageResult.verses.map((v) => v.text).join(" "),
          scripture_ref: passageResult.ref,
          scripture_display_ref: passageResult.displayRef,
          scripture_translation: passageResult.translation,
          scripture_verses: passageResult.verses,
          source: "auto",
          tags: [],
        }));

      const context = getSurroundingContext(fullText, linkText);
      await createLink({
        from_block: blockId,
        to_block: targetId,
        link_text: linkText,
        context,
        is_entity_link: false,
        reflection_id: reflectionId,
      });
      return;
    }

    // Otherwise treat as entity/topic
    const entity = await findOrCreateEntity(linkText);
    const entityBlockId = `ent_blk_${entity.id}`;
    const existingBlock = await getBlock(entityBlockId);
    if (!existingBlock) {
      await createBlock({
        id: entityBlockId,
        type:
          entity.type === "person"
            ? "person"
            : entity.type === "place"
              ? "place"
              : entity.type === "event"
                ? "event"
                : "theme",
        content: entity.description || entity.name,
        entity_type: entity.type,
        entity_id: entity.id,
        entity_name: entity.name,
        entity_aliases: entity.aliases,
        source: "auto",
        tags: [],
      });
    }
    const context = getSurroundingContext(fullText, linkText);
    await createLink({
      from_block: blockId,
      to_block: entityBlockId,
      link_text: linkText,
      context,
      is_entity_link: true,
      reflection_id: reflectionId,
    });
  };

  const autoLinkPassages = async (
    blockId: string,
    reflectionId: string,
    fullText: string,
  ) => {
    const bracketRanges = getBracketRanges(fullText);
    const isInBracket = (idx: number) =>
      bracketRanges.some(([s, e]) => idx >= s && idx < e);

    try {
      const passages = findAnyPassage(fullText, { multiple: true });
      if (!Array.isArray(passages)) return;

      for (const p of passages) {
        const bookName =
          OSIS_BOOK_NAMES[p.start.book as OsisBookCode] ?? p.start.book;
        const searchPatterns = [
          p.input,
          `${bookName} ${p.start.chapter}:${p.start.verse}`,
          `${bookName} ${p.start.chapter}`,
        ];

        let foundIdx = -1;
        let foundText = "";
        for (const pattern of searchPatterns) {
          const idx = fullText.indexOf(pattern);
          if (idx !== -1 && !isInBracket(idx)) {
            foundIdx = idx;
            foundText = pattern;
            break;
          }
        }

        if (foundIdx === -1) continue;

        const resolved = await resolvePassage(p.input);
        if (!resolved || resolved.verses.length === 0) continue;

        const existingId = await findScriptureBlockByRef(resolved.ref);
        const targetId =
          existingId ??
          (await createBlock({
            type: "scripture",
            content: resolved.verses.map((v) => v.text).join(" "),
            scripture_ref: resolved.ref,
            scripture_display_ref: resolved.displayRef,
            scripture_translation: resolved.translation,
            scripture_verses: resolved.verses,
            source: "auto",
            tags: [],
          }));

        await createLink({
          from_block: blockId,
          to_block: targetId,
          link_text: foundText,
          context: getSurroundingContext(fullText, foundText),
          is_entity_link: false,
          reflection_id: reflectionId,
        });
      }
    } catch {
      // findAnyPassage can throw on invalid input
    }
  };

  const autoLinkEntities = async (
    blockId: string,
    reflectionId: string,
    fullText: string,
  ) => {
    const bracketRanges = getBracketRanges(fullText);
    const isInBracket = (idx: number) =>
      bracketRanges.some(([s, e]) => idx >= s && idx < e);

    for (const entity of entities()) {
      const names = [entity.name, ...entity.aliases.filter((a) => a.length >= 3)];
      for (const name of names) {
        const lower = fullText.toLowerCase();
        const nameLower = name.toLowerCase();
        let searchFrom = 0;
        while (true) {
          const idx = lower.indexOf(nameLower, searchFrom);
          if (idx === -1) break;
          searchFrom = idx + name.length;

          if (isInBracket(idx)) continue;

          await processLink(blockId, reflectionId, name, fullText);
          break;
        }
      }
    }
  };

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={shell.header}>
          <div class={shell.headerLeading}>
            <button
              type="button"
              class={shell.backBtn}
              onClick={() => {
                hapticTrigger();
                props.onBack();
              }}
              aria-label="Back"
            >
              <IconArrowLeft size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <h1 class={`${shell.headerTitle} ${shell.headerTitleEllipsis}`}>
              {props.reflectionId ? "Edit reflection" : `Reflection on ${props.displayRef}`}
            </h1>
          </div>
          <div class={shell.headerTrailing} aria-hidden="true" />
        </header>

        <div class={shell.main}>
        <div class={shell.shellContent}>
          <div class={styles.editorWrap}>
            <textarea
              ref={textareaRef}
              placeholder="What is the Lord showing you in this passage?"
              value={text()}
              onInput={handleInput}
              onKeyUp={(e) =>
                setCursorPos(
                  (e.currentTarget as HTMLTextAreaElement).selectionStart,
                )
              }
              onClick={(e) =>
                setCursorPos(
                  (e.currentTarget as HTMLTextAreaElement).selectionStart,
                )
              }
              onKeyDown={handleKey}
              class={styles.textarea}
              rows={6}
            />
            <Show when={suggestions().length > 0}>
              <div class={styles.autocomplete}>
                <For each={suggestions()}>
                  {(s, i) => (
                    <button
                      class={styles.suggestionItem}
                      data-active={i() === selectedIdx() ? "true" : undefined}
                      onClick={() => applySuggestion(s)}
                    >
                      <span class={styles.suggestionIcon}>
                        <s.icon size={ICON_PX.compact} />
                      </span>
                      <span class={styles.suggestionLabel}>{s.label}</span>
                      <span class={styles.suggestionType}>
                        {s.type === "passage" ? "passage" : "topic"}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <p class={styles.hint}>
            Type [[ to reference a passage or topic. Bible references and known
            topics are auto-linked.
          </p>
          <button
            class={styles.saveBtn}
            onClick={handleSave}
            disabled={saving()}
          >
            <IconCheck size={ICON_PX.inline} />{" "}
            {saving() ? "Saving..." : "Save Reflection"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function getBracketRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const re = /\[\[[^\]]+\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

async function findScriptureBlockByRef(
  ref: string,
): Promise<string | null> {
  const { getDb } = await import("../db/connection");
  const db = await getDb();
  const safeRef = ref.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT id FROM blocks WHERE scripture_ref = '${safeRef}' LIMIT 1`,
  );
  return rows.length > 0 ? rows[0].id : null;
}
