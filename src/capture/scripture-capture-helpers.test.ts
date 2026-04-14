import { describe, expect, it } from "vitest";
import {
  normalizePassageTyping,
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
});
