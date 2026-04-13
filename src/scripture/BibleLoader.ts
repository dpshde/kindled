// Bible data loader — streams BSB.jsonl, indexes verses by OSIS ref (e.g. RUT.1.3)

import { OSIS_BOOK_CODES, type OsisBookCode } from "grab-bcv";
import { BSB_PREFIX_TO_OSIS } from "./osisBsbPrefix";

export interface BibleVerse {
  /** OSIS-style ref matching grab-bcv canonical segments, e.g. `RUT.1.3` */
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
  /** OSIS book code (e.g. `RUT`) */
  code: OsisBookCode;
  chapters: number;
  versesPerChapter: Record<number, number>;
}

let verseCache: Map<string, BibleVerse> | null = null;
let bookIndex: Map<OsisBookCode, BibleBook> | null = null;
let loadPromise: Promise<void> | null = null;

const osisOrder = new Map(OSIS_BOOK_CODES.map((c, i) => [c, i]));

export async function loadBibleData(): Promise<void> {
  if (loadPromise) return loadPromise;
  if (verseCache) return;

  loadPromise = (async () => {
    const response = await fetch("/bsb.jsonl");
    if (!response.ok) throw new Error("Failed to load Bible data");

    const text = await response.text();
    const lines = text.trim().split("\n");

    verseCache = new Map();
    bookIndex = new Map();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const raw: BibleVerse = JSON.parse(line);
        const filePrefix = raw.ref.split(".")[0];
        const osis = BSB_PREFIX_TO_OSIS.get(filePrefix);
        if (!osis) continue;

        const osisRef = `${osis}.${raw.chapter}.${raw.verseNum}`;
        const verse: BibleVerse = { ...raw, ref: osisRef };
        verseCache.set(osisRef, verse);

        if (!bookIndex.has(osis)) {
          bookIndex.set(osis, {
            name: verse.book,
            code: osis,
            chapters: 0,
            versesPerChapter: {},
          });
        }
        const book = bookIndex.get(osis)!;
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
  })();

  return loadPromise;
}

/** `ref` is OSIS form, e.g. `RUT.1.3` */
export async function getVerse(ref: string): Promise<BibleVerse | null> {
  await loadBibleData();
  return verseCache?.get(ref) ?? null;
}

/** `osisBook` is an OSIS book code, e.g. `RUT` */
export async function getChapterVerses(
  osisBook: OsisBookCode | string,
  chapter: number,
): Promise<BibleVerse[]> {
  await loadBibleData();
  const verses: BibleVerse[] = [];

  const book = bookIndex?.get(osisBook as OsisBookCode);
  if (!book) return verses;

  const maxVerse = book.versesPerChapter[chapter] ?? 0;
  for (let i = 1; i <= maxVerse; i++) {
    const ref = `${osisBook}.${chapter}.${i}`;
    const verse = verseCache?.get(ref);
    if (verse) verses.push(verse);
  }

  return verses;
}

export async function getBooks(): Promise<BibleBook[]> {
  await loadBibleData();
  return Array.from(bookIndex?.values() ?? []).sort((a, b) => {
    const ia = osisOrder.get(a.code) ?? 999;
    const ib = osisOrder.get(b.code) ?? 999;
    return ia - ib;
  });
}

export async function getBook(nameOrOsis: string): Promise<BibleBook | null> {
  await loadBibleData();
  if (bookIndex?.has(nameOrOsis as OsisBookCode)) {
    return bookIndex.get(nameOrOsis as OsisBookCode)!;
  }
  for (const book of bookIndex?.values() ?? []) {
    if (book.name.toLowerCase() === nameOrOsis.toLowerCase()) return book;
  }
  return null;
}

export async function parseAndFetch(
  input: string,
): Promise<{ verses: BibleVerse[]; display: string } | null> {
  await loadBibleData();

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

  const verses: BibleVerse[] = [];
  const maxChapterVerse = book.versesPerChapter[chapter] ?? 0;
  const actualEnd = endVerse ?? maxChapterVerse;

  for (let v = startVerse; v <= actualEnd && v <= maxChapterVerse; v++) {
    const ref = `${book.code}.${chapter}.${v}`;
    const verse = verseCache?.get(ref);
    if (verse) verses.push(verse);
  }

  const display =
    endVerse && endVerse !== startVerse
      ? `${book.name} ${chapter}:${startVerse}-${actualEnd}`
      : `${book.name} ${chapter}:${startVerse}`;

  return { verses, display };
}
