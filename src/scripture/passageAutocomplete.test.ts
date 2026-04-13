import { describe, expect, it } from "vitest";
import { autocompletePassage } from "grab-bcv";
import {
  bookLookupKey,
  filterRedundantBookSuggestions,
  parseChapterVerseTail,
  topicPassageBookContext,
  topicPassageQueryFilter,
} from "./passageAutocomplete";

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

describe("topicPassageBookContext", () => {
  it("returns book when query is exact display name", () => {
    expect(topicPassageBookContext("Matthew")).toBe("MAT");
    expect(topicPassageBookContext("Ruth")).toBe("RUT");
  });

  it("returns book when display name is followed by chapter/verse numerals", () => {
    expect(topicPassageBookContext("Matthew 5")).toBe("MAT");
    expect(topicPassageBookContext("Matthew 5:3")).toBe("MAT");
    expect(topicPassageBookContext("Ruth 1")).toBe("RUT");
  });

  it("returns null for partial book names", () => {
    expect(topicPassageBookContext("Mat")).toBeNull();
    expect(topicPassageBookContext("Ru")).toBeNull();
  });

  it("returns null when non-numeric text follows the book", () => {
    expect(topicPassageBookContext("Matthew foo")).toBeNull();
  });

  it("resolves abbreviated book plus chapter", () => {
    expect(topicPassageBookContext("1 Cor 1")).toBe("1CO");
    expect(topicPassageBookContext("Psalm 23")).toBe("PSA");
  });
});

describe("parseChapterVerseTail", () => {
  it("parses chapter only, chapter with colon, and chapter:verse", () => {
    expect(parseChapterVerseTail("8")).toEqual({ chapter: 8 });
    expect(parseChapterVerseTail("8:")).toEqual({ chapter: 8 });
    expect(parseChapterVerseTail("8:1")).toEqual({ chapter: 8, versePrefix: "1" });
    expect(parseChapterVerseTail(" 8:10-12")).toEqual({ chapter: 8, versePrefix: "10" });
  });
});

describe("topicPassageQueryFilter", () => {
  it("includes chapter after book name for topic narrowing", () => {
    expect(topicPassageQueryFilter("Luke 8:")).toEqual({
      book: "LUK",
      chapter: 8,
    });
    expect(topicPassageQueryFilter("Luke 8:1")).toEqual({
      book: "LUK",
      chapter: 8,
      versePrefix: "1",
    });
  });

  it("book only yields no location keys", () => {
    expect(topicPassageQueryFilter("Luke")).toEqual({ book: "LUK" });
  });
});
