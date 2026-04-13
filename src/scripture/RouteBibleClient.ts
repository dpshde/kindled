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

// Map OSIS book codes (grab-bcv) to BSB.jsonl ref prefixes
const OSIS_TO_BSB: Record<string, string> = {
  GEN: "Gen", EXO: "Exod", LEV: "Lev", NUM: "Num", DEU: "Deut",
  JOS: "Josh", JDG: "Judg", RUT: "Rut", "1SA": "1Sam", "2SA": "2Sam",
  "1KI": "1Kgs", "2KI": "2Kgs", "1CH": "1Chr", "2CH": "2Chr", EZR: "Ezra",
  NEH: "Neh", EST: "Esth", JOB: "Job", PSA: "Ps", PRO: "Prov",
  ECC: "Eccl", SNG: "Song", ISA: "Isa", JER: "Jer", LAM: "Lam",
  EZK: "Ezek", DAN: "Dan", HOS: "Hos", JOL: "Joel", AMO: "Amos",
  OBA: "Obad", JON: "Jonah", MIC: "Mic", NAM: "Nah", HAB: "Hab",
  ZEP: "Zeph", HAG: "Hag", ZEC: "Zech", MAL: "Mal", MAT: "Matt",
  MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts", ROM: "Rom",
  "1CO": "1Cor", "2CO": "2Cor", GAL: "Gal", EPH: "Eph", PHP: "Phil",
  COL: "Col", "1TH": "1Thess", "2TH": "2Thess", "1TI": "1Tim", "2TI": "2Tim",
  TIT: "Titus", PHM: "Phlm", HEB: "Heb", JAS: "Jas", "1PE": "1Pet",
  "2PE": "2Pet", "1JN": "1John", "2JN": "2John", "3JN": "3John", JUD: "Jude", REV: "Rev",
};

function osisToBsb(osis: string): string {
  return OSIS_TO_BSB[osis] ?? osis;
}

export async function resolvePassage(
  input: string,
  translation = "BSB",
): Promise<ResolvedPassage | null> {
  const result = tryParsePassage(input);
  if (!result.ok) return null;

  const passage = result.value;
  const osisBook = passage.start.book as OsisBookCode;
  const bsbBook = osisToBsb(osisBook);
  const chapter = passage.start.chapter;
  const verseStart = passage.start.verse;
  const verseEnd = passage.end.verse;

  const routeUrl = `https://route.bible/${passage.canonical}`;

  try {
    let verses: Verse[] = [];

    const chapterVerses = await getChapterVerses(bsbBook, chapter);

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

    // Build display ref
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
