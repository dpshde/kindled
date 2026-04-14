import { describe, expect, it } from "vitest";
import type { Block } from "../db/types";
import { routeBibleHandoffUrl } from "./RouteBibleClient";

function scriptureBlock(
  partial: Pick<
    Block,
    "scripture_ref" | "scripture_display_ref" | "scripture_translation"
  > &
 Partial<Block>,
): Block {
  return {
    id: "b1",
    type: "scripture",
    content: "",
    captured_at: "",
    modified_at: "",
    tags: [],
    ...partial,
  };
}

describe("routeBibleHandoffUrl", () => {
  it("builds URL from OSIS scripture_ref", () => {
    const u = routeBibleHandoffUrl(
      scriptureBlock({
        scripture_ref: "PHP.4.11-14",
        scripture_display_ref: "Philippians 4:11-14",
        scripture_translation: "BSB",
      }),
    );
    expect(u).toBe(
      "https://route.bible/php.4.11-14?v=BSB&src=kindled",
    );
  });

  it("falls back to display ref when scripture_ref missing", () => {
    const u = routeBibleHandoffUrl(
      scriptureBlock({
        scripture_display_ref: "John 3:16",
      }),
    );
    expect(u).toMatch(/^https:\/\/route\.bible\/jhn\.3\.16\?src=kindled$/);
  });

  it("parses display ref with trailing translation token via findAnyPassage", () => {
    const u = routeBibleHandoffUrl(
      scriptureBlock({
        scripture_display_ref: "Philippians 4:11-14 BSB",
        scripture_translation: "BSB",
      }),
    );
    expect(u).toBe(
      "https://route.bible/php.4.11-14?v=BSB&src=kindled",
    );
  });

  it("returns null when unparseable", () => {
    expect(
      routeBibleHandoffUrl(
        scriptureBlock({ scripture_display_ref: "not a passage xyz" }),
      ),
    ).toBe(null);
  });
});
