import {
  ensureLifeStage,
  getBacklinks,
  getBlock,
  getOutgoingLinks,
  getReflectionsForBlock,
  type Block,
  type LifeStageRecord,
  type Link,
  type Reflection,
} from "../db";

export type PassageDataBundle = {
  block: Block | null;
  lifeStage: LifeStageRecord | null;
  outgoing: Link[];
  backlinks: Link[];
  linkedBlocks: Record<string, Block>;
  reflections: Reflection[];
};

/**
 * Loads passage UI data. Returns `null` if `isCancelled()` is true after any await.
 */
export async function fetchPassageBundle(
  passageId: string,
  isCancelled: () => boolean,
): Promise<PassageDataBundle | null> {
  const b = await getBlock(passageId);
  if (isCancelled()) return null;
  if (!b) {
    return {
      block: null,
      lifeStage: null,
      outgoing: [],
      backlinks: [],
      linkedBlocks: {},
      reflections: [],
    };
  }
  const [out, back] = await Promise.all([getOutgoingLinks(b.id), getBacklinks(b.id)]);
  if (isCancelled()) return null;
  const ls = await ensureLifeStage(b.id);
  if (isCancelled()) return null;
  const refl = await getReflectionsForBlock(b.id);
  if (isCancelled()) return null;
  const linkedBlocks: Record<string, Block> = {};
  const ids = new Set<string>();
  for (const l of [...out, ...back]) {
    ids.add(l.from_block);
    ids.add(l.to_block);
  }
  ids.delete(b.id);
  for (const linkId of ids) {
    const linked = await getBlock(linkId);
    if (isCancelled()) return null;
    if (linked) linkedBlocks[linkId] = linked;
  }
  return {
    block: b,
    lifeStage: ls,
    outgoing: out,
    backlinks: back,
    linkedBlocks,
    reflections: refl,
  };
}
