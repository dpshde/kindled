import { describe, expect, it } from "vitest";
import { splitLegacyReflectionBodiesFromContent } from "./reflections";

describe("splitLegacyReflectionBodiesFromContent", () => {
  it("returns whole content as head when no legacy markers", () => {
    const s = "In the beginning God created.";
    expect(splitLegacyReflectionBodiesFromContent(s)).toEqual({
      head: s,
      bodies: [],
    });
  });

  it("extracts dated segments after passage text", () => {
    const s =
      "Verse text here.\n\n[4/13/2026] First thought\n\n[4/14/2026] Second thought";
    const { head, bodies } = splitLegacyReflectionBodiesFromContent(s);
    expect(head).toBe("Verse text here.");
    expect(bodies).toEqual(["First thought", "Second thought"]);
  });
});
