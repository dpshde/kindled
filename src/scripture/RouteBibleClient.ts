import type { Verse } from "../db";
import { parseRef } from "./RefNormalizer";

const ROUTE_BIBLE_BASE = "https://route.bible";

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
  const parsed = parseRef(input);
  if (!parsed) return null;

  const routeUrl = `${ROUTE_BIBLE_BASE}/${parsed.canonical}`;

  try {
    // Try fetching from route.bible's static kjv.jsonl
    // For V1, we use a simplified local approach with fetch to route.bible
    const response = await fetch(`${routeUrl}?format=json&translation=${translation}`);
    if (!response.ok) {
      // Fallback: return the ref without verse text
      return {
        ref: parsed.canonical,
        displayRef: parsed.display,
        translation,
        verses: [],
        routeUrl,
      };
    }

    const data = await response.json();
    const verses: Verse[] = (data?.verses ?? []).map(
      (v: { verse: number; text: string }) => ({
        number: v.verse,
        text: v.text,
      }),
    );

    return {
      ref: parsed.canonical,
      displayRef: parsed.display,
      translation,
      verses,
      routeUrl,
    };
  } catch {
    // Offline or network error — return ref without text
    return {
      ref: parsed.canonical,
      displayRef: parsed.display,
      translation,
      verses: [],
      routeUrl,
    };
  }
}
