import {
  tryParsePassage,
  findAnyPassage,
  OSIS_BOOK_NAMES,
  BOOK_CHAPTER_COUNTS,
  BOOK_VERSE_COUNTS,
  type OsisBookCode,
  type ParsedPassage,
} from "grab-bcv";

export interface StructuredDraft {
  book: OsisBookCode | "";
  chapter: string;
  startVerse: string;
  endVerse: string;
}

export function buildNumericOptions(max: number, start = 1): string[] {
  return Array.from({ length: Math.max(max - start + 1, 0) }, (_, i) => String(i + start));
}

export function draftFromParsed(p: ParsedPassage): StructuredDraft {
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

export function displayFromParsed(p: ParsedPassage): { display: string; canonical: string } {
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

/** Normalize typed refs so grab-bcv sees a stable shape (dashes, spaces). */
export function normalizePassageTyping(val: string): string {
  return val
    .trim()
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

export function parseInputToPassage(val: string): ParsedPassage | null {
  const trimmed = normalizePassageTyping(val);
  if (!trimmed) return null;
  const strict = tryParsePassage(trimmed);
  if (strict.ok) return strict.value;
  return findAnyPassage(trimmed);
}

export function buildRefString(d: StructuredDraft): string {
  if (!d.book) return "";
  const name = OSIS_BOOK_NAMES[d.book as OsisBookCode];
  if (!d.chapter) return name;
  if (!d.startVerse) return `${name} ${d.chapter}`;
  return d.endVerse
    ? `${name} ${d.chapter}:${d.startVerse}-${d.endVerse}`
    : `${name} ${d.chapter}:${d.startVerse}`;
}

export function scriptureBook(draft: StructuredDraft): OsisBookCode | null {
  return draft.book || null;
}

export function scriptureChapterCount(draft: StructuredDraft): number {
  const b = scriptureBook(draft);
  return b ? BOOK_CHAPTER_COUNTS[b] : 0;
}

export function scriptureBoundedChapter(draft: StructuredDraft): string {
  const ch = parseInt(draft.chapter, 10);
  const max = scriptureChapterCount(draft);
  return ch > 0 && max > 0 ? String(Math.min(ch, max)) : "";
}

export function scriptureVerseCount(draft: StructuredDraft): number {
  const b = scriptureBook(draft);
  const bc = scriptureBoundedChapter(draft);
  if (!b || !bc) return 0;
  return BOOK_VERSE_COUNTS[b]?.[parseInt(bc, 10)] ?? 0;
}
