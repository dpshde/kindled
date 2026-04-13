import { describe, expect, it } from "vitest";
import { OSIS_BOOK_CODES } from "grab-bcv";
import { BSB_PREFIX_TO_OSIS, OSIS_TO_BSB_PREFIX } from "./osisBsbPrefix";

describe("osisBsbPrefix", () => {
  it("maps every OSIS book to a distinct BSB file prefix", () => {
    const seen = new Set<string>();
    for (const osis of OSIS_BOOK_CODES) {
      const prefix = OSIS_TO_BSB_PREFIX[osis];
      expect(prefix).toBeTruthy();
      expect(seen.has(prefix)).toBe(false);
      seen.add(prefix);
      expect(BSB_PREFIX_TO_OSIS.get(prefix)).toBe(osis);
    }
  });
});
