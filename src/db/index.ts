export { getDb, Database } from "./connection";
export {
  createBlock,
  getBlock,
  getAllBlocks,
  updateBlockContent,
  deleteBlock,
  searchBlocks,
  findScriptureBlockByCanonicalRef,
  updateScripturePassageData,
  saveScripturePassageFromCapture,
} from "./blocks";
export { createEntity, getEntity, getAllEntities, findEntityByName, addBlockMention, updateEntityFamiliarity } from "./entities";
export {
  createLink,
  getOutgoingLinks,
  getBacklinks,
  deleteLinksFrom,
  deleteLinksForReflection,
  getConnectedBlockIds,
} from "./links";
export {
  getLifeStage,
  ensureLifeStage,
  stokeBlock,
  nudgeBlock,
  deepenBlock,
  emberBlock,
  snoozeBlock,
  recordLinger,
  incrementNotes,
  getDailyKindling,
  prioritizeBlockForReview,
  peekClientKindlingIdsCache,
  setClientKindlingIdsCache,
  invalidateClientKindlingIdsCache,
} from "./ritual";
export {
  getReflectionsForBlock,
  getReflection,
  createReflection,
  updateReflection,
  deleteReflection,
  ensureLegacyReflectionsMigrated,
} from "./reflections";
export { splitLegacyReflectionBodiesFromContent } from "./reflections";
export type { Block, BlockType, Entity, EntityType, LifeStage, LifeStageRecord, Link, Verse, Reflection } from "./types";
