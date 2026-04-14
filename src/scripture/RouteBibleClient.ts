import type { Block, Verse } from "../db";
import {
  findAnyPassage,
  tryParsePassage,
  OSIS_BOOK_NAMES,
  parseToResolverPath,
  type OsisBookCode,
  type ParsedPassage,
} from "grab-bcv";
import { getChapterVerses } from "./BibleLoader";

const ROUTE_BIBLE_ORIGIN = "https://route.bible";

function parsedPassageForRouteHandoff(
  scripture_ref: string | undefined,
  scripture_display_ref: string | undefined,
): ParsedPassage | null {
  const ref = scripture_ref?.trim();
  if (ref) {
    const r = tryParsePassage(ref);
    if (r.ok) return r.value;
  }
  const disp = scripture_display_ref?.trim();
  if (!disp) return null;
  const strict = tryParsePassage(disp);
  if (strict.ok) return strict.value;
  return findAnyPassage(disp);
}

/** Portable outbound URL for route.bible (launcher / web handoff). */
export function routeBibleHandoffUrl(
  b: Pick<Block, "scripture_ref" | "scripture_display_ref" | "scripture_translation">,
): string | null {
  const parsed = parsedPassageForRouteHandoff(b.scripture_ref, b.scripture_display_ref);
  if (!parsed) return null;
  const path = parseToResolverPath(parsed);
  const url = new URL(path, ROUTE_BIBLE_ORIGIN);
  const tr = b.scripture_translation?.trim();
  if (tr) url.searchParams.set("v", tr.toUpperCase());
  url.searchParams.set("src", "kindled");
  return url.toString();
}

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
