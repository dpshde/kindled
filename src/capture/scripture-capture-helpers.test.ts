import { describe, expect, it } from "vitest";
import {
  normalizePassageTyping,
  parseCapturePassage,
  parseInputToPassage,
} from "./scripture-capture-helpers";

describe("normalizePassageTyping", () => {
  it("normalizes en dash and runs of spaces", () => {
    expect(normalizePassageTyping("phil  4  11\u201313")).toBe("phil 4 11-13");
  });
});

describe("parseInputToPassage", () => {
  it("parses John 3:16", () => {
    const p = parseInputToPassage("John 3:16");
    expect(p).not.toBeNull();
    expect(p?.canonical).toMatch(/JHN|John/i);
  });

  it("parses spaced abbreviations like phil 4 11-13", () => {
    const p = parseInputToPassage("phil 4 11-13");
    expect(p?.canonical).toBe("PHP.4.11-13");
    expect(p?.start.chapter).toBe(4);
    expect(p?.start.verse).toBe(11);
    expect(p?.end.verse).toBe(13);
  });

  it("parses the screenshot case rom 5 3-6", () => {
    const p = parseInputToPassage("rom 5 3-6");
    expect(p?.canonical).toBe("ROM.5.3-6");
    expect(p?.start.chapter).toBe(5);
    expect(p?.start.verse).toBe(3);
    expect(p?.end.verse).toBe(6);
  });
});

describe("parseCapturePassage", () => {
  it("uses selected book context for chapter/verse-only input", () => {
    const p = parseCapturePassage("5 3-6", {
      book: "ROM",
      chapter: "",
      startVerse: "",
      endVerse: "",
    });
    expect(p?.canonical).toBe("ROM.5.3-6");
  });

  it("uses selected chapter context for verse-only input", () => {
    const p = parseCapturePassage("3-6", {
      book: "ROM",
      chapter: "5",
      startVerse: "",
      endVerse: "",
    });
    expect(p?.canonical).toBe("ROM.5.3-6");
  });
});
