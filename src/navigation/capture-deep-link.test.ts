import { describe, expect, it } from "vitest";
import { peekCaptureRefFromSearch } from "./capture-deep-link";

describe("peekCaptureRefFromSearch", () => {
  it("reads ref", () => {
    expect(peekCaptureRefFromSearch("?ref=John%203%3A16")).toBe("John 3:16");
  });

  it("reads passage alias", () => {
    expect(peekCaptureRefFromSearch("?passage=Ruth+1%3A1")).toBe("Ruth 1:1");
  });

  it("reads q alias", () => {
    expect(peekCaptureRefFromSearch("?q=Ps%2023")).toBe("Ps 23");
  });

  it("prefers ref when multiple present", () => {
    expect(peekCaptureRefFromSearch("?q=Gen+1&ref=Exo+1%3A1")).toBe("Exo 1:1");
  });

  it("returns null when missing", () => {
    expect(peekCaptureRefFromSearch("")).toBeNull();
    expect(peekCaptureRefFromSearch("?other=1")).toBeNull();
  });
});
