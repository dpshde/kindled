import { describe, expect, it } from "vitest";
import { OSIS_BOOK_CODES } from "grab-bcv";
import { OSIS_BOOK_PICKER_LABEL } from "./book-picker-labels";

describe("OSIS_BOOK_PICKER_LABEL", () => {
  it("defines a non-empty shorthand for every OSIS book", () => {
    for (const code of OSIS_BOOK_CODES) {
      const label = OSIS_BOOK_PICKER_LABEL[code];
      expect(label).toBeTruthy();
      expect(label.length).toBeLessThan(12);
    }
  });
});
