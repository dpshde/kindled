import { describe, expect, it } from "vitest";
import { parseInputToPassage } from "./scripture-capture-helpers";

describe("parseInputToPassage", () => {
  it("parses John 3:16", () => {
    const p = parseInputToPassage("John 3:16");
    expect(p).not.toBeNull();
    expect(p?.canonical).toMatch(/JHN|John/i);
  });
});
