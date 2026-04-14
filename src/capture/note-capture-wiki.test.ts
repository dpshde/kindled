import { describe, expect, it } from "vitest";
import { getWikiLinkContext } from "./note-capture-wiki";

describe("getWikiLinkContext", () => {
  it("returns query inside open wiki link", () => {
    expect(getWikiLinkContext("Hello [[Gen 1:1", 15)).toEqual({
      query: "Gen 1:1",
      start: 6,
      end: 15,
    });
  });

  it("returns null when link is closed before cursor", () => {
    expect(getWikiLinkContext("[[x]] ", 8)).toBeNull();
  });
});
