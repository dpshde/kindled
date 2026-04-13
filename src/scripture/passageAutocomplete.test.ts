import { describe, expect, it } from "vitest";
import { autocompletePassage } from "grab-bcv";
import { bookLookupKey, filterRedundantBookSuggestions } from "./passageAutocomplete";

describe("bookLookupKey", () => {
  it("strips non-alphanumerics and lowercases", () => {
    expect(bookLookupKey("1 Samuel")).toBe("1samuel");
    expect(bookLookupKey("  Ruth  ")).toBe("ruth");
  });
});

describe("filterRedundantBookSuggestions", () => {
  it("removes book row when query equals display name", () => {
    const raw = autocompletePassage("Ruth", { limit: 6 });
    expect(raw.some((s) => s.kind === "book")).toBe(true);
    const filtered = filterRedundantBookSuggestions("Ruth", raw);
    expect(filtered.filter((s) => s.kind === "book")).toEqual([]);
  });

  it("keeps suggestions for partial book names", () => {
    const raw = autocompletePassage("Ru", { limit: 6 });
    const filtered = filterRedundantBookSuggestions("Ru", raw);
    expect(filtered.length).toBe(raw.length);
  });

  it("keeps chapter / verse suggestions", () => {
    const raw = autocompletePassage("Ruth 1", { limit: 6 });
    expect(raw.length).toBeGreaterThan(0);
    const filtered = filterRedundantBookSuggestions("Ruth 1", raw);
    expect(filtered).toEqual(raw);
  });

  it("keeps First Samuel when display is 1 Samuel", () => {
    const raw = autocompletePassage("First Samuel", { limit: 6 });
    expect(raw.length).toBeGreaterThan(0);
    const filtered = filterRedundantBookSuggestions("First Samuel", raw);
    expect(filtered).toEqual(raw);
  });
});
