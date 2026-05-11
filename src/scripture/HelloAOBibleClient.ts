import type { Verse } from "../db";
import { tryParsePassage, OSIS_BOOK_NAMES, type OsisBookCode } from "grab-bcv";
import type { ResolvedPassage } from "./RouteBibleClient";

export interface TranslationInfo {
  id: string;
  name: string;
  shortName: string;
  englishName: string;
  language: string;
  numberOfBooks: number;
}

let translationsCache: TranslationInfo[] | null = null;

export async function fetchAvailableTranslations(): Promise<TranslationInfo[]> {
  if (translationsCache) return translationsCache;
  try {
    const res = await fetch(
      "https://bible.helloao.org/api/available_translations.json",
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list: TranslationInfo[] = (data.translations ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      englishName: t.englishName,
      language: t.language,
      numberOfBooks: t.numberOfBooks ?? 0,
    }));
    // Sort: English first, then by english name
    list.sort((a, b) => {
      const aEng = a.language === "eng" ? 0 : 1;
      const bEng = b.language === "eng" ? 0 : 1;
      if (aEng !== bEng) return aEng - bEng;
      return a.englishName.localeCompare(b.englishName);
    });
    translationsCache = list;
    return list;
  } catch (e) {
    console.error("[HelloAOBible] Failed to fetch translations:", e);
    return [];
  }
}

function flattenVerseContent(content: unknown[]): string {
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        if ("text" in obj && typeof obj.text === "string") return obj.text;
      }
      return "";
    })
    .join("")
    .trim();
}

export async function fetchPassageFromHelloAO(
  translationId: string,
  bookId: string,
  chapter: number,
  verseStart?: number,
  verseEnd?: number,
): Promise<Verse[]> {
  const url = `https://bible.helloao.org/api/${encodeURIComponent(translationId)}/${encodeURIComponent(bookId)}/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const data = await res.json();
  const chapterContent = data?.chapter?.content ?? [];
  const verses: Verse[] = [];

  for (const item of chapterContent) {
    if (item.type === "verse" && typeof item.number === "number") {
      const text = flattenVerseContent(item.content ?? []);
      if (text) {
        verses.push({ number: item.number, text });
      }
    }
  }

  if (verseStart != null) {
    const end = verseEnd ?? verseStart;
    return verses.filter((v) => v.number >= verseStart && v.number <= end);
  }

  return verses;
}

export function formatTranslationId(id: string): string {
  return id
    .split("_")
    .map((part) => part.toUpperCase())
    .join(" ");
}

export async function resolvePassageFromHelloAO(
  input: string,
  translation = "BSB",
): Promise<ResolvedPassage | null> {
  const result = tryParsePassage(input);
  if (!result.ok) {
    return null;
  }

  const passage = result.value;
  const osisBook = passage.start.book as OsisBookCode;
  const chapter = passage.start.chapter;
  const verseStart = passage.start.verse;
  const verseEnd = passage.end.verse;

  try {
    const verses = await fetchPassageFromHelloAO(
      translation,
      osisBook,
      chapter,
      verseStart ?? undefined,
      verseEnd ?? undefined,
    );

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
      routeUrl: `https://route.bible/${passage.canonical}`,
    };
  } catch (e) {
    console.error("[HelloAOBible] resolvePassage failed:", e);
    return null;
  }
}
