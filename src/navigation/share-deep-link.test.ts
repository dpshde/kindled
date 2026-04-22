import { describe, expect, it } from "vitest";
import { peekShareRefFromSearch } from "./share-deep-link";

describe("peekShareRefFromSearch", () => {
  it("reads ref", () => {
    expect(peekShareRefFromSearch("?ref=John%203%3A16")).toBe("John 3:16");
  });

  it("reads passage alias", () => {
    expect(peekShareRefFromSearch("?passage=Ruth+1%3A1")).toBe("Ruth 1:1");
  });

  it("reads q alias", () => {
    expect(peekShareRefFromSearch("?q=Ps%2023")).toBe("Ps 23");
  });

  it("prefers ref when multiple present", () => {
    expect(peekShareRefFromSearch("?q=Gen+1&ref=Exo+1%3A1")).toBe("Exo 1:1");
  });

  it("returns null when missing", () => {
    expect(peekShareRefFromSearch("")).toBeNull();
    expect(peekShareRefFromSearch("?other=1")).toBeNull();
  });
});
