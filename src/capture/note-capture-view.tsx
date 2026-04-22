import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  type JSX,
} from "solid-js";
import {
  getBlock,
  getReflection,
  getReflectionsForBlock,
  createReflection,
  updateReflection,
  createLink,
  deleteLinksForReflection,
  deleteReflection,
  createBlock,
  getAllEntities,
  getLinksForReflection,
  saveScripturePassageFromCapture,
  type Entity,
  type Reflection,
  type Link,
  type Block,
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
  IconBookOpen,
  IconCheck,
  IconFire,
  IconMapPin,
  IconPencilSimple,
  IconTrash,
  IconUser,
  type IconProps,
} from "../ui/icons/icons";
import shell from "../ui/app-shell.module.css";
import { applyWikiLinkSuggestion } from "./wikiLinkAutocomplete";
import styles from "./NoteCapture.module.css";
import { hapticLight, hapticSave, hapticWarning } from "../haptics";
import { getBracketRanges, getWikiLinkContext } from "./note-capture-wiki";

const TEXTAREA_ID = "note-capture-textarea";

interface Suggestion {
  label: string;
  insertText: string;
  type: "passage" | "entity";
  icon: (p?: IconProps) => JSX.Element;
}

export function NoteCaptureView(props: {
  passageId: string;
  displayRef: string;
  reflectionId?: string;
  onBack: () => void;
  onNavigateHome: () => void;
  onSaved: () => void;
  onEditReflection?: (id: string) => void;
  onNavigate?: (passageId: string) => void;
}): JSX.Element {
  const [text, setText] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [entities, setEntities] = createSignal<Entity[]>([]);
  const [cursorPos, setCursorPos] = createSignal(0);
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  const [pastReflections, setPastReflections] = createSignal<Reflection[]>([]);
  const [reflectionLinks, setReflectionLinks] = createSignal<Record<string, Link[]>>({});
  const [linkedBlocks, setLinkedBlocks] = createSignal<Record<string, Block>>({});

  createEffect(() => {
    void noteBootstrap();
  });

  async function noteBootstrap() {
    const [all, , existing, past] = await Promise.all([
      getAllEntities(),
      loadCanonicalTopics(),
      props.reflectionId ? getReflection(props.reflectionId) : Promise.resolve(null),
      getReflectionsForBlock(props.passageId),
    ]);
    setEntities(all);
    const others = past.filter((r) => r.id !== props.reflectionId);
    setPastReflections(others);
    if (existing) setText(existing.body);

    // Load links + linked blocks for past reflections
    const linksMap: Record<string, Link[]> = {};
    const blocksMap: Record<string, Block> = {};
    for (const r of others) {
      const links = await getLinksForReflection(r.id);
      linksMap[r.id] = links;
      for (const l of links) {
        if (!blocksMap[l.to_block]) {
          const blk = await getBlock(l.to_block);
          if (blk) blocksMap[l.to_block] = blk;
        }
      }
    }
    setReflectionLinks(linksMap);
    setLinkedBlocks(blocksMap);
  }

  function getSuggestions(): Suggestion[] {
    const t = text();
    const cp = cursorPos();
    const ents = entities();
    const ctx = getWikiLinkContext(t, cp);
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
    const matched = ents.filter((e) => {
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
        icon: e.type === "person" ? IconUser : e.type === "place" ? IconMapPin : IconBookOpen,
      });
    }

    return results.slice(0, 8);
  }

  function applySuggestion(s: Suggestion) {
    const ctx = getWikiLinkContext(text(), cursorPos());
    const ta = document.getElementById(TEXTAREA_ID) as HTMLTextAreaElement | null;
    if (!ctx || !ta) return;

    hapticLight();
    const { text: newText, cursor: newCursor } = applyWikiLinkSuggestion(
      text(),
      ctx.start,
      ctx.end,
      s.insertText,
    );
    setText(newText);

    requestAnimationFrame(() => {
      ta.selectionStart = newCursor;
      ta.selectionEnd = newCursor;
      ta.focus();
    });
    setCursorPos(newCursor);
  }

  function handleKey(e: KeyboardEvent) {
    const sugs = getSuggestions();
    const ta = e.target as HTMLTextAreaElement;
    const ctx = getWikiLinkContext(ta.value, ta.selectionStart);
    if (sugs.length > 0 && ctx) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(Math.min(selectedIdx() + 1, sugs.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(Math.max(selectedIdx() - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(sugs[selectedIdx()]!);
        return;
      }
      if (e.key === "Escape") {
        setCursorPos(-1);
        return;
      }
    }
  }

  async function handleSave() {
    hapticSave();
    const t = text();
    if (!t.trim()) {
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
      const noteText = t.trim();
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

      await noteAutoLinkPassages(block.id, reflectionId, noteText, entities());
      await noteAutoLinkEntities(block.id, reflectionId, noteText, entities());

      props.onSaved();
    } catch {
      setSaving(false);
    }
  }

  const suggestions = () => getSuggestions();
  const showSuggestions = () => suggestions().length > 0;

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
            <h1 class={`${shell.headerTitle} ${shell.headerTitleEllipsis}`}>
              {props.reflectionId ? "Edit reflection" : `Reflection on ${props.displayRef}`}
            </h1>
          </div>
          <div class={shell.headerActions} />
        </header>
        <div class={shell.main}>
          <div class={shell.shellContent}>
            <div class={styles.editorWrap}>
              <textarea
                id={TEXTAREA_ID}
                placeholder="What is the Lord showing you in this passage?"
                class={styles.textarea}
                rows={6}
                value={text()}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  setText(ta.value);
                  setCursorPos(ta.selectionStart);
                  setSelectedIdx(0);
                }}
                onKeyUp={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
                onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
                onKeyDown={(e) => handleKey(e)}
              />
              {showSuggestions() && (
                <div class={styles.autocomplete}>
                  {suggestions().map((s, i) => (
                    <button
                      type="button"
                      class={styles.suggestionItem}
                      data-active={i === selectedIdx() ? "true" : undefined}
                      onClick={() => applySuggestion(s)}
                    >
                      <span class={styles.suggestionIcon}>{s.icon({ size: ICON_PX.compact })}</span>
                      <span class={styles.suggestionLabel}>{s.label}</span>
                      <span class={styles.suggestionType}>
                        {s.type === "passage" ? "passage" : "topic"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p class={styles.hint}>
              Type [[ to reference a passage or topic. Bible references and known topics are
              auto-linked.
            </p>
            <button
              class={styles.saveBtn}
              disabled={saving()}
              onClick={() => void handleSave()}
            >
              <IconCheck size={ICON_PX.inline} />
              {saving() ? " Saving..." : " Save Reflection"}
            </button>
            <Show when={pastReflections().length > 0}>
              <div class={styles.pastReflections}>
                <p class={styles.pastReflectionsTitle}>Previous reflections</p>
                <ul class={styles.pastReflectionsList}>
                  <For each={pastReflections()}>
                    {(r) => {
                      const links = () => reflectionLinks()[r.id] ?? [];
                      return (
                        <li class={styles.pastReflectionCard}>
                          <div class={styles.pastReflectionBody}>
                            <InlineLinkedText
                              body={r.body}
                              links={links()}
                              blocks={linkedBlocks()}
                              onNavigate={props.onNavigate}
                            />
                          </div>
                          <div class={styles.pastReflectionFooter}>
                            <span class={styles.pastReflectionDate}>
                              {formatReflectionDate(r.modified_at)}
                            </span>
                            <div class={styles.pastReflectionActions}>
                              <button
                                type="button"
                                class={styles.pastReflectionActionBtn}
                                onClick={() => {
                                  hapticLight();
                                  props.onEditReflection?.(r.id);
                                }}
                                aria-label="Edit reflection"
                              >
                                <IconPencilSimple size={ICON_PX.compact} />
                              </button>
                              <button
                                type="button"
                                class={styles.pastReflectionActionDanger}
                                onClick={async () => {
                                  hapticWarning();
                                  await deleteReflection(r.id);
                                  setPastReflections(pastReflections().filter((x) => x.id !== r.id));
                                }}
                                aria-label="Delete reflection"
                              >
                                <IconTrash size={ICON_PX.compact} />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineLinkedText(props: {
  body: string;
  links: Link[];
  blocks: Record<string, Block>;
  onNavigate?: (passageId: string) => void;
}): JSX.Element {
  const linkMap = createMemo(() => {
    const map: Record<string, Link> = {};
    for (const l of props.links) map[l.link_text] = l;
    return map;
  });

  return (
    <>
      <For each={splitBodyOnWikiLinks(props.body)}>
        {(seg) => {
          if (seg.kind === "text") return <>{seg.value}</>;
          return <InlineLinkSegment seg={seg} linkMap={linkMap} blocks={props.blocks} onNavigate={props.onNavigate} />;
        }}
      </For>
    </>
  );
}

function InlineLinkSegment(props: {
  seg: BodySegment;
  linkMap: () => Record<string, Link>;
  blocks: Record<string, Block>;
  onNavigate?: (passageId: string) => void;
}): JSX.Element {
  const resolved = createMemo(() => {
    const link = props.linkMap()[props.seg.value];
    const block = link ? props.blocks[link.to_block] : undefined;
    const label = block?.scripture_display_ref ?? block?.entity_name ?? props.seg.value;
    const targetId = link?.to_block;
    return { link, label, targetId };
  });

  return (
    <Show when={resolved().targetId && props.onNavigate} fallback={<span class={styles.inlineLink}>{resolved().label}</span>}>
      <button
        type="button"
        class={styles.inlineLink}
        onClick={() => props.onNavigate?.(resolved().targetId!)}
      >
        {resolved().label}
      </button>
    </Show>
  );
}

interface BodySegment {
  kind: "text" | "link";
  value: string;
}

function splitBodyOnWikiLinks(body: string): BodySegment[] {
  const re = /\[\[([^\]]+)\]\]/g;
  const parts: BodySegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: body.slice(last, m.index) });
    parts.push({ kind: "link", value: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ kind: "text", value: body.slice(last) });
  return parts;
}

function formatReflectionDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
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
    const { blockId: targetId } = await saveScripturePassageFromCapture({
      content: passageResult.verses.map((v) => v.text).join(" "),
      scripture_ref: passageResult.ref,
      scripture_display_ref: passageResult.displayRef,
      scripture_translation: passageResult.translation,
      scripture_verses: passageResult.verses,
      source: "auto",
      tags: [],
    });

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

      const { blockId: targetId } = await saveScripturePassageFromCapture({
        content: resolved.verses.map((v) => v.text).join(" "),
        scripture_ref: resolved.ref,
        scripture_display_ref: resolved.displayRef,
        scripture_translation: resolved.translation,
        scripture_verses: resolved.verses,
        source: "auto",
        tags: [],
      });

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
