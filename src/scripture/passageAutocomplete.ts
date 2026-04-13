import {
  resolveBookAlias,
  OSIS_BOOK_NAMES,
  type AutocompletePassageSuggestion,
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
