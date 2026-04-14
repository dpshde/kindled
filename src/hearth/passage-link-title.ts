import type { Block, Link } from "../db/types";

export function linkEndpointLabel(
  link: Link,
  direction: "from" | "to",
  linkedBlocks: Readonly<Record<string, Block>>,
): string {
  const id = direction === "from" ? link.from_block : link.to_block;
  const blk = linkedBlocks[id];
  return blk?.scripture_display_ref ?? blk?.entity_name ?? blk?.content.slice(0, 40) ?? id;
}
