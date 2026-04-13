import type { Verse } from "../db";
import { tryParsePassage, OSIS_BOOK_NAMES, type OsisBookCode } from "grab-bcv";
import { getChapterVerses } from "./BibleLoader";

export interface ResolvedPassage {
  ref: string;
  displayRef: string;
  translation: string;
  verses: Verse[];
  routeUrl: string;
}

export async function resolvePassage(
  input: string,
  translation = "BSB",
): Promise<ResolvedPassage | null> {
  const result = tryParsePassage(input);
  if (!result.ok) return null;

  const passage = result.value;
  const osisBook = passage.start.book as OsisBookCode;
  const chapter = passage.start.chapter;
  const verseStart = passage.start.verse;
  const verseEnd = passage.end.verse;

  const routeUrl = `https://route.bible/${passage.canonical}`;

  try {
    let verses: Verse[] = [];

    const chapterVerses = await getChapterVerses(osisBook, chapter);

    if (verseStart != null) {
      const endVerse = verseEnd ?? verseStart;
      verses = chapterVerses
        .filter((v) => {
          const vn = parseInt(v.verseNum, 10);
          return vn >= verseStart && vn <= endVerse;
        })
        .map((v) => ({ number: parseInt(v.verseNum, 10), text: v.text }));
    } else {
      verses = chapterVerses.map((v) => ({
        number: parseInt(v.verseNum, 10),
        text: v.text,
      }));
    }

    const bookName = OSIS_BOOK_NAMES[osisBook] ?? osisBook;
    let displayRef: string;
    if (verseStart != null && verseEnd != null && verseStart !== verseEnd) {
      displayRef = `${bookName} ${chapter}:${verseStart}-${verseEnd}`;
    } else if (verseStart != null) {
      displayRef = `${bookName} ${chapter}:${verseStart}`;
    } else {
      displayRef = `${bookName} ${chapter}`;
    }

    return {
      ref: passage.canonical,
      displayRef,
      translation,
      verses,
      routeUrl,
    };
  } catch {
    const bookName = OSIS_BOOK_NAMES[osisBook] ?? osisBook;
    return {
      ref: passage.canonical,
      displayRef: `${bookName} ${chapter}`,
      translation,
      verses: [],
      routeUrl,
    };
  }
}
