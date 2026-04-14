import { html, reactive, watch, type ArrowTemplate } from "@arrow-js/core";
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
import {
  IconArrowLeft,
  IconBookOpen,
  IconCheck,
  IconMapPin,
  IconUser,
  type IconProps,
} from "../ui/icons/icons";
import shell from "../ui/app-shell.module.css";
import { applyWikiLinkSuggestion } from "./wikiLinkAutocomplete";
import styles from "./NoteCapture.module.css";
import { hapticTrigger } from "../haptics";
import { findScriptureBlockByRef } from "./note-capture-db";
import { getBracketRanges, getWikiLinkContext } from "./note-capture-wiki";

const TEXTAREA_ID = "note-capture-textarea";

interface Suggestion {
  label: string;
  insertText: string;
  type: "passage" | "entity";
  icon: (p?: IconProps) => ArrowTemplate;
}

export function noteCaptureView(props: {
  passageId: string;
  displayRef: string;
  reflectionId?: string;
  onBack: () => void;
  onSaved: () => void;
}): ArrowTemplate {
  const state = reactive({
    text: "",
    saving: false,
    entities: [] as Entity[],
    cursorPos: 0,
    selectedIdx: 0,
  });

  watch(() => {
    void noteBootstrap(state, props.reflectionId);
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
          <h1 class="${`${shell.headerTitle} ${shell.headerTitleEllipsis}`}">
            ${props.reflectionId ? "Edit reflection" : `Reflection on ${props.displayRef}`}
          </h1>
        </div>
        <div class="${shell.headerTrailing}" aria-hidden="true"></div>
      </header>
      <div class="${shell.main}">
        <div class="${shell.shellContent}">
          <div class="${styles.editorWrap}">
            <textarea
              id="${TEXTAREA_ID}"
              placeholder="What is the Lord showing you in this passage?"
              class="${styles.textarea}"
              rows="6"
              value="${() => state.text}"
              @input="${(e: Event) => noteHandleInput(state, e)}"
              @keyup="${(e: Event) =>
                noteCursorFromEvent(state, e.target as HTMLTextAreaElement)}"
              @click="${(e: Event) =>
                noteCursorFromEvent(state, e.target as HTMLTextAreaElement)}"
              @keydown="${(e: Event) =>
                noteHandleKey(state, e as KeyboardEvent, () => noteSuggestions(state))}"
            ></textarea>
            ${() => noteSuggestionList(state)}
          </div>
          <p class="${styles.hint}">
            Type [[ to reference a passage or topic. Bible references and known topics are
            auto-linked.
          </p>
          <button
            class="${styles.saveBtn}"
            disabled="${() => state.saving}"
            @click="${() => void noteSave(state, props)}"
          >
            ${IconCheck({ size: ICON_PX.inline })}
            ${() => (state.saving ? " Saving..." : " Save Reflection")}
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

async function noteBootstrap(
  state: { text: string; entities: Entity[] },
  reflectionId?: string,
) {
  const [all, , existing] = await Promise.all([
    getAllEntities(),
    loadCanonicalTopics(),
    reflectionId ? getReflection(reflectionId) : Promise.resolve(null),
  ]);
  state.entities = all;
  if (existing) state.text = existing.body;
}

function noteHandleInput(state: { text: string; cursorPos: number; selectedIdx: number }, e: Event) {
  const ta = e.currentTarget as HTMLTextAreaElement;
  state.text = ta.value;
  state.cursorPos = ta.selectionStart;
  state.selectedIdx = 0;
}

function noteCursorFromEvent(state: { cursorPos: number }, ta: HTMLTextAreaElement) {
  state.cursorPos = ta.selectionStart;
}

function noteSuggestions(state: {
  text: string;
  cursorPos: number;
  entities: Entity[];
}): Suggestion[] {
  const ctx = getWikiLinkContext(state.text, state.cursorPos);
  if (!ctx) return [];

  const q = ctx.query.trim();
  const results: Suggestion[] = [];

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

  const ql = q.toLowerCase();
  const matched = state.entities.filter((e) => {
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
        e.type === "person" ? IconUser : e.type === "place" ? IconMapPin : IconBookOpen,
    });
  }

  return results.slice(0, 8);
}

function noteSuggestionList(state: {
  text: string;
  cursorPos: number;
  entities: Entity[];
  selectedIdx: number;
}): ArrowTemplate {
  return html`${() => {
    const sugs = noteSuggestions(state);
    if (sugs.length === 0) return html``;
    return html`<div class="${styles.autocomplete}">
      ${sugs.map((s, i) =>
        html`<button
          type="button"
          class="${styles.suggestionItem}"
          data-active="${i === state.selectedIdx ? "true" : undefined}"
          @click="${() => noteApplySuggestion(state, sugs[i]!)}"
        >
          <span class="${styles.suggestionIcon}">${s.icon({ size: ICON_PX.compact })}</span>
          <span class="${styles.suggestionLabel}">${s.label}</span>
          <span class="${styles.suggestionType}">${s.type === "passage" ? "passage" : "topic"}</span>
        </button>`,
      )}
    </div>`;
  }}`;
}

function noteApplySuggestion(state: { text: string; cursorPos: number }, s: Suggestion) {
  const ctx = getWikiLinkContext(state.text, state.cursorPos);
  const ta = document.getElementById(TEXTAREA_ID) as HTMLTextAreaElement | null;
  if (!ctx || !ta) return;

  hapticTrigger();
  const { text: newText, cursor: newCursor } = applyWikiLinkSuggestion(
    state.text,
    ctx.start,
    ctx.end,
    s.insertText,
  );
  state.text = newText;

  requestAnimationFrame(() => {
    ta.selectionStart = newCursor;
    ta.selectionEnd = newCursor;
    ta.focus();
  });
  state.cursorPos = newCursor;
}

function noteHandleKey(
  state: { text: string; cursorPos: number; selectedIdx: number },
  e: KeyboardEvent,
  getSugs: () => Suggestion[],
) {
  const sugs = getSugs();
  const ta = e.target as HTMLTextAreaElement;
  const ctx = getWikiLinkContext(ta.value, ta.selectionStart);
  if (sugs.length > 0 && ctx) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.selectedIdx = Math.min(state.selectedIdx + 1, sugs.length - 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      state.selectedIdx = Math.max(state.selectedIdx - 1, 0);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      noteApplySuggestion(state, sugs[state.selectedIdx]!);
      return;
    }
    if (e.key === "Escape") {
      state.cursorPos = -1;
      return;
    }
  }
}

async function noteSave(
  state: { text: string; saving: boolean; entities: Entity[] },
  props: {
    passageId: string;
    reflectionId?: string;
    onBack: () => void;
    onSaved: () => void;
  },
) {
  hapticTrigger();
  if (!state.text.trim()) {
    props.onBack();
    return;
  }
  state.saving = true;
  try {
    const block = await getBlock(props.passageId);
    if (!block) {
      state.saving = false;
      return;
    }
    const noteText = state.text.trim();
    let reflectionId = props.reflectionId;

    if (reflectionId) {
      await deleteLinksForReflection(reflectionId);
      await updateReflection(reflectionId, noteText);
    } else {
      reflectionId = await createReflection(block.id, noteText);
    }

    const parsed = parseWikiLinks(noteText);
    for (const link of parsed) {
      await noteProcessLink(block.id, reflectionId, link.text, noteText);
    }

    await noteAutoLinkPassages(block.id, reflectionId, noteText, state.entities);
    await noteAutoLinkEntities(block.id, reflectionId, noteText, state.entities);

    props.onSaved();
  } catch {
    state.saving = false;
  }
}

async function noteProcessLink(
  blockId: string,
  reflectionId: string,
  linkText: string,
  fullText: string,
) {
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
}

async function noteAutoLinkPassages(
  blockId: string,
  reflectionId: string,
  fullText: string,
  _entities: Entity[],
) {
  const bracketRanges = getBracketRanges(fullText);
  const isInBracket = (idx: number) => bracketRanges.some(([s, e]) => idx >= s && idx < e);

  try {
    const passages = findAnyPassage(fullText, { multiple: true });
    if (!Array.isArray(passages)) return;

    for (const p of passages) {
      const bookName = OSIS_BOOK_NAMES[p.start.book as OsisBookCode] ?? p.start.book;
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
    /* findAnyPassage can throw */
  }
}

async function noteAutoLinkEntities(
  blockId: string,
  reflectionId: string,
  fullText: string,
  entities: Entity[],
) {
  const bracketRanges = getBracketRanges(fullText);
  const isInBracket = (idx: number) => bracketRanges.some(([s, e]) => idx >= s && idx < e);

  for (const entity of entities) {
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

        await noteProcessLink(blockId, reflectionId, name, fullText);
        break;
      }
    }
  }
}
