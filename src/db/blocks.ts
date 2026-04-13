import { getDb } from "./connection";
import { ensureLifeStage, prioritizeBlockForReview } from "./ritual";
import type { Block, BlockType, Verse } from "./types";

function generateId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function jsonField(val: unknown): string {
  return JSON.stringify(val ?? []);
}

function parseJsonField<T>(val: string | undefined | null, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function blockFromRow(r: Record<string, string>): Block {
  return {
    id: r.id,
    type: r.type as BlockType,
    content: r.content,
    scripture_ref: r.scripture_ref ?? undefined,
    scripture_display_ref: r.scripture_display_ref ?? undefined,
    scripture_translation: r.scripture_translation ?? undefined,
    scripture_verses: parseJsonField<Verse[]>(r.scripture_verses, []),
    entity_type: (r.entity_type as Block["entity_type"]) ?? undefined,
    entity_id: r.entity_id ?? undefined,
    entity_name: r.entity_name ?? undefined,
    entity_aliases: parseJsonField<string[]>(r.entity_aliases, []),
    entity_description: r.entity_description ?? undefined,
    source: r.source ?? undefined,
    captured_at: r.captured_at,
    modified_at: r.modified_at,
    tags: parseJsonField<string[]>(r.tags, []),
  };
}

export async function createBlock(
  block: Omit<Block, "id" | "captured_at" | "modified_at"> &
    Partial<Pick<Block, "id">>,
): Promise<string> {
  const db = await getDb();
  const id = block.id ?? generateId();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO blocks (id, type, content, scripture_ref, scripture_display_ref, scripture_translation, scripture_verses, entity_type, entity_id, entity_name, entity_aliases, entity_description, source, captured_at, modified_at, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    block.type,
    block.content,
    block.scripture_ref ?? null,
    block.scripture_display_ref ?? null,
    block.scripture_translation ?? null,
    block.scripture_verses ? JSON.stringify(block.scripture_verses) : null,
    block.entity_type ?? null,
    block.entity_id ?? null,
    block.entity_name ?? null,
    block.entity_aliases ? JSON.stringify(block.entity_aliases) : null,
    block.entity_description ?? null,
    block.source ?? "manual",
    now,
    now,
    jsonField(block.tags),
  );

  await db.run(
    `INSERT INTO life_stages (block_id, stage, kindled_at, next_review_at) VALUES (?, 'spark', ?, ?)`,
    id,
    now,
    now,
  );

  return id;
}

export async function getBlock(id: string): Promise<Block | null> {
  const db = await getDb();
  const safeId = id.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM blocks WHERE id = '${safeId}'`,
  );
  if (rows.length === 0) return null;
  return blockFromRow(rows[0]);
}

export async function findScriptureBlockByCanonicalRef(
  canonicalRef: string,
): Promise<Block | null> {
  const trimmed = canonicalRef.trim();
  if (!trimmed) return null;
  const db = await getDb();
  const safe = trimmed.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM blocks WHERE type = 'scripture' AND scripture_ref = '${safe}' LIMIT 1`,
  );
  if (rows.length === 0) return null;
  return blockFromRow(rows[0]);
}

export async function updateScripturePassageData(
  id: string,
  data: {
    content: string;
    scripture_display_ref: string;
    scripture_translation: string;
    scripture_verses: Verse[];
  },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `UPDATE blocks SET content = ?, scripture_display_ref = ?, scripture_translation = ?, scripture_verses = ?, modified_at = ? WHERE id = ?`,
    data.content,
    data.scripture_display_ref,
    data.scripture_translation,
    JSON.stringify(data.scripture_verses),
    now,
    id,
  );
}

/**
 * Add a scripture block, or if the same canonical ref already exists, refresh its text
 * and move it to the front of the review queue (no duplicate rows).
 */
export async function saveScripturePassageFromCapture(params: {
  content: string;
  scripture_ref: string;
  scripture_display_ref: string;
  scripture_translation: string;
  scripture_verses: Verse[];
  source?: string;
  tags?: string[];
}): Promise<{ blockId: string; alreadyExisted: boolean }> {
  const existing = await findScriptureBlockByCanonicalRef(params.scripture_ref);
  if (existing) {
    await ensureLifeStage(existing.id);
    await updateScripturePassageData(existing.id, {
      content: params.content,
      scripture_display_ref: params.scripture_display_ref,
      scripture_translation: params.scripture_translation,
      scripture_verses: params.scripture_verses,
    });
    await prioritizeBlockForReview(existing.id);
    return { blockId: existing.id, alreadyExisted: true };
  }

  const id = await createBlock({
    type: "scripture",
    content: params.content,
    scripture_ref: params.scripture_ref,
    scripture_display_ref: params.scripture_display_ref,
    scripture_translation: params.scripture_translation,
    scripture_verses: params.scripture_verses,
    source: params.source ?? "manual",
    tags: params.tags ?? [],
  });
  return { blockId: id, alreadyExisted: false };
}

export async function getAllBlocks(): Promise<Block[]> {
  const db = await getDb();
  const rows = await db.query<Record<string, string>>(
    `SELECT b.* FROM blocks b
     INNER JOIN life_stages ls ON b.id = ls.block_id
     ORDER BY ls.next_review_at ASC, b.captured_at DESC`,
  );

  return rows.map((r) => blockFromRow(r));
}

export async function updateBlockContent(
  id: string,
  content: string,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE blocks SET content = ?, modified_at = ? WHERE id = ?`,
    content,
    new Date().toISOString(),
    id,
  );
}

export async function deleteBlock(id: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM life_stages WHERE block_id = ?`, id);
  await db.run(`DELETE FROM links WHERE from_block = ? OR to_block = ?`, id, id);
  await db.run(`DELETE FROM blocks WHERE id = ?`, id);
}

export async function searchBlocks(query: string): Promise<Block[]> {
  const db = await getDb();
  const safeQuery = query.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT b.* FROM blocks b
     INNER JOIN life_stages ls ON b.id = ls.block_id
     WHERE
     b.content LIKE '%${safeQuery}%'
     OR b.scripture_display_ref LIKE '%${safeQuery}%'
     OR b.entity_name LIKE '%${safeQuery}%'
     ORDER BY ls.next_review_at ASC, b.captured_at DESC`,
  );

  return rows.map((r) => blockFromRow(r));
}
