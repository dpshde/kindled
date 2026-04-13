import type { Verse } from "../db";
import { parseRef } from "./RefNormalizer";
import { getChapterVerses, getBook } from "./BibleLoader";

export interface ResolvedPassage {
  ref: string;
  displayRef: string;
  translation: string;
  verses: Verse[];
  routeUrl: string;
}

// Map lowercase book codes from RefNormalizer to BSB.jsonl ref prefix format
const BSB_CODE_MAP: Record<string, string> = {
  gen: "Gen", exo: "Exod", lev: "Lev", num: "Num", deu: "Deut",
  jos: "Josh", jdg: "Judg", rut: "Rut", "1sa": "1Sam", "2sa": "2Sam",
  "1ki": "1Kgs", "2ki": "2Kgs", "1ch": "1Chr", "2ch": "2Chr", ezr: "Ezra",
  neh: "Neh", est: "Esth", job: "Job", psa: "Ps", pro: "Prov",
  ecc: "Eccl", sng: "Song", isa: "Isa", jer: "Jer", lam: "Lam",
  ezk: "Ezek", dan: "Dan", hos: "Hos", jol: "Joel", amo: "Amos",
  oba: "Obad", jon: "Jonah", mic: "Mic", nah: "Nah", hab: "Hab",
  zep: "Zeph", hag: "Hag", zec: "Zech", mal: "Mal", mat: "Matt",
  mrk: "Mark", luk: "Luke", jhn: "John", act: "Acts", rom: "Rom",
  "1co": "1Cor", "2co": "2Cor", gal: "Gal", eph: "Eph", php: "Phil",
  col: "Col", "1th": "1Thess", "2th": "2Thess", "1ti": "1Tim", "2ti": "2Tim",
  tit: "Titus", phm: "Phlm", heb: "Heb", jas: "Jas", "1pe": "1Pet",
  "2pe": "2Pet", "1jn": "1John", "2jn": "2John", "3jn": "3John", jud: "Jude", rev: "Rev",
};

function normalizeBookCode(code: string): string {
  return BSB_CODE_MAP[code.toLowerCase()] ?? code;
}

export async function resolvePassage(
  input: string,
  translation = "BSB",
): Promise<ResolvedPassage | null> {
  const parsed = parseRef(input);
  if (!parsed) return null;

  const routeUrl = `https://route.bible/${parsed.canonical}`;

  try {
    const bookCode = normalizeBookCode(parsed.book);
    const chapter = parsed.chapter;

    let verses: Verse[] = [];

    if (parsed.verseStart != null) {
      const endVerse = parsed.verseEnd ?? parsed.verseStart;
      const chapterVerses = await getChapterVerses(bookCode, chapter);
      verses = chapterVerses
        .filter((v) => {
          const vn = parseInt(v.verseNum, 10);
          return vn >= parsed.verseStart! && vn <= endVerse;
        })
        .map((v) => ({ number: parseInt(v.verseNum, 10), text: v.text }));
    } else {
      const chapterVerses = await getChapterVerses(bookCode, chapter);
      verses = chapterVerses.map((v) => ({
        number: parseInt(v.verseNum, 10),
        text: v.text,
      }));
    }

    // Build a proper display ref
    const book = await getBook(bookCode);
    const bookName = book?.name ?? parsed.book;
    let displayRef: string;
    if (parsed.verseStart != null && parsed.verseEnd != null) {
      displayRef = `${bookName} ${chapter}:${parsed.verseStart}-${parsed.verseEnd}`;
    } else if (parsed.verseStart != null) {
      displayRef = `${bookName} ${chapter}:${parsed.verseStart}`;
    } else {
      displayRef = `${bookName} ${chapter}`;
    }

    return {
      ref: parsed.canonical,
      displayRef,
      translation,
      verses,
      routeUrl,
    };
  } catch {
    return {
      ref: parsed.canonical,
      displayRef: parsed.display,
      translation,
      verses: [],
      routeUrl,
    };
  }
}
