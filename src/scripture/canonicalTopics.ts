/**
 * Canonical topic → passage suggestions. Data file is served from
 * `public/data/canonical-topics.json` (copied from selah-tools exedra-search).
 */
import {
  tryParsePassage,
  OSIS_BOOK_NAMES,
  type OsisBookCode,
  type ParsedPassage,
} from "grab-bcv";
import type { TopicPassageLocationFilter } from "./passageAutocomplete";

export interface CanonicalTopic {
  id: string;
  label: string;
  normalizedLabel: string;
  aliases: string[];
  description: string;
  topRefs: string[];
  sourceRowCount: number;
}

let cache: CanonicalTopic[] | null = null;
let loadPromise: Promise<CanonicalTopic[]> | null = null;

/** Curated topic → passage row for autocomplete when a book is already chosen. */
export type TopicPassagePick = {
  topicLabel: string;
  refOsis: string;
  insertText: string;
  label: string;
};

const MAX_PICKS_PER_BOOK = 120;
let bookTopicIndex: Map<OsisBookCode, TopicPassagePick[]> | null = null;

function buildBookTopicIndex(topics: CanonicalTopic[]): Map<OsisBookCode, TopicPassagePick[]> {
  const byBook = new Map<OsisBookCode, Map<string, TopicPassagePick>>();

  for (const topic of topics) {
    for (const ref of topic.topRefs) {
      const p = tryParsePassage(ref.toLowerCase());
      if (!p.ok) continue;
      const book = p.value.start.book;
      const insertText = topRefToInput(ref);
      const m = byBook.get(book) ?? new Map();
      if (!m.has(insertText)) {
        m.set(insertText, {
          topicLabel: topic.label,
          refOsis: ref,
          insertText,
          label: `${insertText} (${topic.label})`,
        });
      }
      byBook.set(book, m);
    }
  }

  const out = new Map<OsisBookCode, TopicPassagePick[]>();
  for (const [book, picks] of byBook) {
    const arr = [...picks.values()].slice(0, MAX_PICKS_PER_BOOK);
    arr.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    out.set(book, arr);
  }
  return out;
}

function pickMatchesLocation(
  pick: TopicPassagePick,
  book: OsisBookCode,
  loc: TopicPassageLocationFilter,
): boolean {
  const parsed = tryParsePassage(pick.refOsis.toLowerCase());
  if (!parsed.ok) return false;
  const v = parsed.value;
  if (v.start.book !== book || v.end.book !== book) return false;

  if (loc.chapter == null) return true;

  const ch = loc.chapter;
  if (v.start.chapter > ch || v.end.chapter < ch) return false;

  const pref = loc.versePrefix;
  if (pref == null || pref.length === 0) return true;

  if (v.start.chapter !== ch || v.end.chapter !== ch) {
    return true;
  }

  const sv = v.start.verse;
  const ev = v.end.verse ?? sv;
  if (sv == null) return true;

  if (String(sv).startsWith(pref) || (ev != null && String(ev).startsWith(pref))) {
    return true;
  }

  const lo = sv;
  const hi = ev ?? sv;
  for (let n = lo; n <= hi; n++) {
    if (String(n).startsWith(pref)) return true;
  }
  return false;
}

/** Passages from canonical topics whose OSIS ref starts in the given book (after topics load). */
export function getTopicPassagePicksForBook(
  book: OsisBookCode,
  limit: number,
  location?: TopicPassageLocationFilter,
): TopicPassagePick[] {
  if (!bookTopicIndex) return [];
  const picks = bookTopicIndex.get(book) ?? [];
  const narrow =
    location?.chapter != null || (location?.versePrefix != null && location.versePrefix.length > 0);
  if (!narrow) return picks.slice(0, limit);
  return picks.filter((p) => pickMatchesLocation(p, book, location!)).slice(0, limit);
}

export async function loadCanonicalTopics(): Promise<CanonicalTopic[]> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = fetch("/data/canonical-topics.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Topics HTTP ${r.status}`);
        return r.json() as Promise<CanonicalTopic[]>;
      })
      .then((data) => {
        cache = data;
        bookTopicIndex = buildBookTopicIndex(data);
        return data;
      });
  }
  return loadPromise;
}

export function searchCanonicalTopics(
  topics: CanonicalTopic[],
  query: string,
  limit: number,
): CanonicalTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const out: CanonicalTopic[] = [];
  for (const t of topics) {
    if (
      t.normalizedLabel.includes(q) ||
      t.label.toLowerCase().includes(q) ||
      t.aliases.some((a) => a.toLowerCase().includes(q))
    ) {
      out.push(t);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function displayFromParsed(p: ParsedPassage): string {
  const bookName = OSIS_BOOK_NAMES[p.start.book] ?? p.start.book;
  const hasVerse = p.start.verse != null;
  if (hasVerse && p.end.verse != null && p.start.verse !== p.end.verse) {
    return `${bookName} ${p.start.chapter}:${p.start.verse}-${p.end.verse}`;
  }
  if (hasVerse) {
    return `${bookName} ${p.start.chapter}:${p.start.verse}`;
  }
  return `${bookName} ${p.start.chapter}`;
}

/** Human reference string for inputs (matches passage picker / grab-bcv). */
export function topRefToInput(ref: string): string {
  const p = tryParsePassage(ref.toLowerCase());
  if (!p.ok) return ref;
  return displayFromParsed(p.value);
}
