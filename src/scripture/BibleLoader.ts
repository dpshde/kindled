// Bible data loader — loads per-book JSONL on demand from /data/bible/<book>.jsonl

import { OSIS_BOOK_CODES, OSIS_BOOK_NAMES, type OsisBookCode } from "grab-bcv";
import { BSB_PREFIX_TO_OSIS } from "./osisBsbPrefix";

export interface BibleVerse {
  ref: string;
  book: string;
  chapter: string;
  verseNum: string;
  text: string;
  events?: string[];
  entities?: string[];
}

export interface BibleBook {
  name: string;
  code: OsisBookCode;
  chapters: number;
  versesPerChapter: Record<number, number>;
}

const verseCache = new Map<string, BibleVerse>();
const bookIndex = new Map<OsisBookCode, BibleBook>();
const bookLoadPromises = new Map<string, Promise<void>>();

const osisOrder = new Map(OSIS_BOOK_CODES.map((c, i) => [c, i]));

function osisToFileKey(osis: OsisBookCode): string {
  return osis.toLowerCase();
}

async function loadBook(osis: OsisBookCode): Promise<void> {
  const key = osisToFileKey(osis);
  if (bookLoadPromises.has(key)) return bookLoadPromises.get(key)!;

  const promise = (async () => {
    try {
      const url = `/data/bible/${key}.json`;
      console.log("[BibleLoader] loadBook:start", { osis, key, url });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      console.log("[BibleLoader] loadBook:response", {
        key,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });
      if (!response.ok) {
        console.error(`[BibleLoader] Failed to load ${key}: ${response.status} ${response.statusText}`);
        return;
      }

      const text = await response.text();
      const lines = text.trim().split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const raw: BibleVerse = JSON.parse(line);
          const filePrefix = raw.ref.split(".")[0];
          const mapped = BSB_PREFIX_TO_OSIS.get(filePrefix);
          if (!mapped) continue;

          const osisRef = `${mapped}.${raw.chapter}.${raw.verseNum}`;
          const verse: BibleVerse = { ...raw, ref: osisRef };
          verseCache.set(osisRef, verse);

          if (!bookIndex.has(mapped)) {
            bookIndex.set(mapped, {
              name: verse.book,
              code: mapped,
              chapters: 0,
              versesPerChapter: {},
            });
          }
          const book = bookIndex.get(mapped)!;
          const chapter = parseInt(verse.chapter, 10);
          const verseNum = parseInt(verse.verseNum, 10);

          if (chapter > book.chapters) book.chapters = chapter;
          if (!book.versesPerChapter[chapter] || verseNum > book.versesPerChapter[chapter]) {
            book.versesPerChapter[chapter] = verseNum;
          }
        } catch {
          // Skip malformed lines
        }
      }
      console.log("[BibleLoader] loadBook:loaded", {
        key,
        lineCount: lines.length,
        cachedVerses: Array.from(verseCache.keys()).filter((ref) => ref.startsWith(`${osis}.`)).length,
        chapters: bookIndex.get(osis)?.chapters ?? 0,
      });
    } catch (e) {
      console.error(`[BibleLoader] Error loading ${key}:`, e);
    }
  })();

  bookLoadPromises.set(key, promise);
  return promise;
}

/**
 * No-op kept for backward compat. Bible data is now loaded lazily per-book.
 * Calling this does not fetch anything.
 */
export async function loadBibleData(): Promise<void> {}

/** `ref` is OSIS form, e.g. `RUT.1.3` */
export async function getVerse(ref: string): Promise<BibleVerse | null> {
  const osis = ref.split(".")[0] as OsisBookCode;
  await loadBook(osis);
  return verseCache.get(ref) ?? null;
}

/** `osisBook` is an OSIS book code, e.g. `RUT` */
export async function getChapterVerses(
  osisBook: OsisBookCode | string,
  chapter: number,
): Promise<BibleVerse[]> {
  console.log("[BibleLoader] getChapterVerses:start", { osisBook, chapter });
  await loadBook(osisBook as OsisBookCode);
  const verses: BibleVerse[] = [];

  const book = bookIndex.get(osisBook as OsisBookCode);
  if (!book) {
    console.log("[BibleLoader] getChapterVerses:no-book-index", { osisBook, chapter });
    return verses;
  }

  const maxVerse = book.versesPerChapter[chapter] ?? 0;
  for (let i = 1; i <= maxVerse; i++) {
    const ref = `${osisBook}.${chapter}.${i}`;
    const verse = verseCache.get(ref);
    if (verse) verses.push(verse);
  }

  console.log("[BibleLoader] getChapterVerses:done", {
    osisBook,
    chapter,
    maxVerse,
    returned: verses.length,
  });
  return verses;
}

export async function getBooks(): Promise<BibleBook[]> {
  // Build the full index from known OSIS codes + names without fetching verse data
  for (const code of OSIS_BOOK_CODES) {
    if (!bookIndex.has(code)) {
      bookIndex.set(code, {
        name: OSIS_BOOK_NAMES[code] ?? code,
        code,
        chapters: 0,
        versesPerChapter: {},
      });
    }
  }
  return Array.from(bookIndex.values()).sort((a, b) => {
    const ia = osisOrder.get(a.code) ?? 999;
    const ib = osisOrder.get(b.code) ?? 999;
    return ia - ib;
  });
}

export async function getBook(nameOrOsis: string): Promise<BibleBook | null> {
  if (bookIndex.has(nameOrOsis as OsisBookCode)) {
    return bookIndex.get(nameOrOsis as OsisBookCode)!;
  }
  // Check if it's a valid OSIS code we haven't loaded yet
  if (OSIS_BOOK_CODES.includes(nameOrOsis as OsisBookCode)) {
    const code = nameOrOsis as OsisBookCode;
    if (!bookIndex.has(code)) {
      bookIndex.set(code, {
        name: OSIS_BOOK_NAMES[code] ?? code,
        code,
        chapters: 0,
        versesPerChapter: {},
      });
    }
    return bookIndex.get(code)!;
  }
  for (const book of bookIndex.values()) {
    if (book.name.toLowerCase() === nameOrOsis.toLowerCase()) return book;
  }
  // Try matching against all known book names
  for (const code of OSIS_BOOK_CODES) {
    const name = OSIS_BOOK_NAMES[code];
    if (name?.toLowerCase() === nameOrOsis.toLowerCase()) {
      if (!bookIndex.has(code)) {
        bookIndex.set(code, { name, code, chapters: 0, versesPerChapter: {} });
      }
      return bookIndex.get(code)!;
    }
  }
  return null;
}

export async function parseAndFetch(
  input: string,
): Promise<{ verses: BibleVerse[]; display: string } | null> {
  const match = input.match(/^(\d?\s*\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (!match) return null;

  const [, bookPart, chapterStr, startVerseStr, endVerseStr] = match;
  const chapter = parseInt(chapterStr, 10);
  const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : 1;
  const endVerse = endVerseStr
    ? parseInt(endVerseStr, 10)
    : startVerseStr
      ? startVerse
      : undefined;

  const book = await getBook(bookPart.trim());
  if (!book) return null;

  await loadBook(book.code);

  const verses: BibleVerse[] = [];
  const maxChapterVerse = book.versesPerChapter[chapter] ?? 0;
  const actualEnd = endVerse ?? maxChapterVerse;

  for (let v = startVerse; v <= actualEnd && v <= maxChapterVerse; v++) {
    const ref = `${book.code}.${chapter}.${v}`;
    const verse = verseCache.get(ref);
    if (verse) verses.push(verse);
  }

  const display =
    endVerse && endVerse !== startVerse
      ? `${book.name} ${chapter}:${startVerse}-${actualEnd}`
      : `${book.name} ${chapter}:${startVerse}`;

  return { verses, display };
}
