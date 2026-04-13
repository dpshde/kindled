import { describe, expect, it } from "vitest";
import { applyWikiLinkSuggestion } from "./wikiLinkAutocomplete";

describe("applyWikiLinkSuggestion", () => {
  it("wraps insert when no closing brackets yet", () => {
    const t = "Hello [[Mat";
    const openIdx = t.indexOf("[[");
    const queryEnd = t.length;
    const r = applyWikiLinkSuggestion(t, openIdx, queryEnd, "Matthew 13:13");
    expect(r.text).toBe("Hello [[Matthew 13:13]]");
    expect(r.cursor).toBe(openIdx + 2 + "Matthew 13:13".length);
  });

  it("replaces inner text only when ]] already exists after cursor", () => {
    const t = "Hello [[Matthew 13:13]]";
    const openIdx = t.indexOf("[[");
    const cursorBeforeClose = openIdx + 2 + "Matthew 13:13".length;
    const r = applyWikiLinkSuggestion(t, openIdx, cursorBeforeClose, "John 1:1");
    expect(r.text).toBe("Hello [[John 1:1]]");
    expect(r.cursor).toBe(openIdx + 2 + "John 1:1".length);
  });

  it("does not accumulate extra brackets on repeated picks", () => {
    let text = "x [[M";
    let openIdx = text.indexOf("[[");
    let queryEnd = text.length;
    let r = applyWikiLinkSuggestion(text, openIdx, queryEnd, "Matthew 13:13");
    text = r.text;
    expect(text).toBe("x [[Matthew 13:13]]");

    openIdx = text.indexOf("[[");
    queryEnd = openIdx + 2 + "Matthew 13:13".length;
    r = applyWikiLinkSuggestion(text, openIdx, queryEnd, "Luke 2:1");
    text = r.text;
    expect(text).toBe("x [[Luke 2:1]]");
    expect(text).not.toMatch(/\]\]{3,}/);
  });

  it("preserves trailing text after existing closer", () => {
    const t = "[[Matt]] rest";
    const openIdx = 0;
    const cursorBeforeClose = 2 + "Matt".length;
    const r = applyWikiLinkSuggestion(t, openIdx, cursorBeforeClose, "Matthew 1:1");
    expect(r.text).toBe("[[Matthew 1:1]] rest");
  });
});
