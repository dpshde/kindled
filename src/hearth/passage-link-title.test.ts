import { describe, expect, it } from "vitest";
import type { Block, Link } from "../db/types";
import { linkEndpointLabel } from "./passage-link-title";

function link(from: string, to: string): Link {
  return {
    id: "l1",
    from_block: from,
    to_block: to,
    link_text: "",
    context: "",
    created_at: "",
    is_entity_link: false,
    reflection_id: null,
  };
}

describe("linkEndpointLabel", () => {
  it("uses scripture ref when present", () => {
    const blocks: Record<string, Block> = {
      b2: {
        id: "b2",
        type: "scripture",
        content: "",
        captured_at: "",
        modified_at: "",
        scripture_display_ref: "John 3:16",
        tags: [],
      },
    };
    expect(linkEndpointLabel(link("b1", "b2"), "to", blocks)).toBe("John 3:16");
  });

  it("falls back to block id when unknown", () => {
    expect(linkEndpointLabel(link("b1", "missing"), "to", {})).toBe("missing");
  });
});
