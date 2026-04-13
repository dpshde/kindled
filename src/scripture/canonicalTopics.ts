/**
 * Canonical topic → passage suggestions. Data file is served from
 * `public/data/canonical-topics.json` (copied from selah-tools exedra-search).
 */
import { tryParsePassage, OSIS_BOOK_NAMES, type ParsedPassage } from "grab-bcv";

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
