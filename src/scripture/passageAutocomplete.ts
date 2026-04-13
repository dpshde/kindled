import {
  resolveBookAlias,
  OSIS_BOOK_CODES,
  OSIS_BOOK_NAMES,
  type AutocompletePassageSuggestion,
  type OsisBookCode,
} from "grab-bcv";

/** Same normalization grab-bcv uses for book name / alias lookup keys. */
export function bookLookupKey(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * When the query already matches a book's canonical display name (case, spacing,
 * punctuation insensitive), omit redundant `book` suggestions for that title.
 */
export function filterRedundantBookSuggestions(
  query: string,
  suggestions: AutocompletePassageSuggestion[],
): AutocompletePassageSuggestion[] {
  const q = query.trim();
  if (!q) return suggestions;

  const resolved = resolveBookAlias(q);
  if (!resolved) return suggestions;

  const displayName = OSIS_BOOK_NAMES[resolved];
  if (!displayName) return suggestions;

  if (bookLookupKey(q) !== bookLookupKey(displayName)) return suggestions;

  return suggestions.filter((s) => !(s.kind === "book" && s.canonical === resolved));
}

const numericOrEmptyRest = /^[\d\s:\-.]*$/;

function matchBookLongestPrefix(trimmed: string): { book: OsisBookCode; rest: string } | null {
  const lower = trimmed.toLowerCase();
  const books = [...OSIS_BOOK_CODES].sort(
    (a, b) => OSIS_BOOK_NAMES[b].length - OSIS_BOOK_NAMES[a].length,
  );
  for (const code of books) {
    const name = OSIS_BOOK_NAMES[code];
    const nl = name.toLowerCase();
    if (lower === nl) return { book: code, rest: "" };
    if (lower.startsWith(nl + " ")) {
      return { book: code, rest: trimmed.slice(name.length + 1) };
    }
  }
  return null;
}

/** Text after the book name when in topic-passage mode (chapter:verse tail). */
function resolveTopicPassageBookAndRest(q: string): { book: OsisBookCode; rest: string } | null {
  const t = q.trim();
  if (!t) return null;

  const exact = resolveBookAlias(t);
  if (exact) {
    const display = OSIS_BOOK_NAMES[exact];
    if (bookLookupKey(t) === bookLookupKey(display)) {
      return { book: exact, rest: "" };
    }
  }

  const prefixMatch = matchBookLongestPrefix(t);
  if (prefixMatch && numericOrEmptyRest.test(prefixMatch.rest)) {
    return { book: prefixMatch.book, rest: prefixMatch.rest };
  }

  const stemMatch = t.match(/^(.+?)\s+(\d[\d\s:\-.]*)$/);
  if (stemMatch) {
    const book = resolveBookAlias(stemMatch[1].trim());
    if (book) return { book, rest: stemMatch[2] };
  }

  return null;
}

/**
 * When the user has typed a Bible book (and optional chapter/verse numerals), prefer
 * curated topic passages instead of grab-bcv chapter/verse rows (often unhelpful noise).
 */
export function topicPassageBookContext(q: string): OsisBookCode | null {
  return resolveTopicPassageBookAndRest(q)?.book ?? null;
}

/** Optional narrowing once a chapter (and optional verse prefix) appears after the book. */
export type TopicPassageLocationFilter = {
  chapter?: number;
  versePrefix?: string;
};

/** Parse `8`, `8:`, `8:1`, `8:10-12` tail (segment after book name) for filtering topic picks. */
export function parseChapterVerseTail(rest: string): TopicPassageLocationFilter {
  const s = rest.trim();
  if (!s) return {};
  const m = s.match(/^(\d+)(?::(\d*))?/);
  if (!m) return {};
  const chapter = parseInt(m[1], 10);
  if (Number.isNaN(chapter)) return {};
  if (m[2] === undefined) {
    return { chapter };
  }
  if (m[2] === "") {
    return { chapter };
  }
  return { chapter, versePrefix: m[2] };
}

/**
 * Book + optional chapter/verse prefix for filtering topic suggestions (e.g. `Luke 8:` → chapter 8).
 */
export function topicPassageQueryFilter(
  q: string,
): ({ book: OsisBookCode } & TopicPassageLocationFilter) | null {
  const br = resolveTopicPassageBookAndRest(q);
  if (!br) return null;
  const loc = parseChapterVerseTail(br.rest);
  return { book: br.book, ...loc };
}
