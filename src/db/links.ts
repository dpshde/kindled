import { getDb } from "./connection";
import { recordDeletedRecords } from "./tombstones";
import type { Link } from "./types";

function generateId(): string {
  return `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createLink(link: {
  from_block: string;
  to_block: string;
  link_text: string;
  context?: string;
  is_entity_link?: boolean;
  reflection_id?: string | null;
}): Promise<string> {
  const db = await getDb();

  // Idempotent: skip if an identical link already exists for this reflection
  if (link.reflection_id) {
    const safeReflection = link.reflection_id.replace(/'/g, "''");
    const safeFrom = link.from_block.replace(/'/g, "''");
    const safeTo = link.to_block.replace(/'/g, "''");
    const safeLinkText = link.link_text.replace(/'/g, "''");
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM links WHERE reflection_id = '${safeReflection}' AND from_block = '${safeFrom}' AND to_block = '${safeTo}' AND link_text = '${safeLinkText}' LIMIT 1`,
    );
    if (existing.length > 0) return existing[0]!.id;
  }

  const id = generateId();

  await db.run(
    `INSERT INTO links (id, from_block, to_block, link_text, context, created_at, is_entity_link, reflection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    link.from_block,
    link.to_block,
    link.link_text,
    link.context ?? "",
    new Date().toISOString(),
    link.is_entity_link ? 1 : 0,
    link.reflection_id ?? null,
  );

  // Update connections_made on the source block's life stage
  await db.run(
    `UPDATE life_stages SET connections_made = connections_made + 1, updated_at = ? WHERE block_id = ?`,
    new Date().toISOString(),
    link.from_block,
  );

  return id;
}

export async function getOutgoingLinks(blockId: string): Promise<Link[]> {
  const db = await getDb();
  const safeId = blockId.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM links WHERE from_block = '${safeId}' ORDER BY created_at DESC`,
  );

  return rows.map((r) => ({
    id: r.id,
    from_block: r.from_block,
    to_block: r.to_block,
    link_text: r.link_text,
    context: r.context,
    created_at: r.created_at,
    is_entity_link: r.is_entity_link === "1",
    reflection_id: r.reflection_id ?? null,
  }));
}

export async function getBacklinks(blockId: string): Promise<Link[]> {
  const db = await getDb();
  const safeId = blockId.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM links WHERE to_block = '${safeId}' ORDER BY created_at DESC`,
  );

  return rows.map((r) => ({
    id: r.id,
    from_block: r.from_block,
    to_block: r.to_block,
    link_text: r.link_text,
    context: r.context,
    created_at: r.created_at,
    is_entity_link: r.is_entity_link === "1",
    reflection_id: r.reflection_id ?? null,
  }));
}

/** Remove links created from one reflection; adjusts connections_made on the passage. */
export async function deleteLinksForReflection(reflectionId: string): Promise<void> {
  const db = await getDb();
  const safe = reflectionId.replace(/'/g, "''");
  const rows = await db.query<{ id: string; from_block: string }>(
    `SELECT id, from_block FROM links WHERE reflection_id = '${safe}'`,
  );
  const byBlock = new Map<string, number>();
  for (const r of rows) {
    byBlock.set(r.from_block, (byBlock.get(r.from_block) ?? 0) + 1);
  }
  if (rows.length > 0) {
    await recordDeletedRecords(rows.map((row) => ({ table_name: "links", record_id: row.id })));
  }
  await db.run(`DELETE FROM links WHERE reflection_id = ?`, reflectionId);
  for (const [blockId, n] of byBlock) {
    await db.run(
      `UPDATE life_stages SET connections_made = MAX(0, connections_made - ?), updated_at = ? WHERE block_id = ?`,
      n,
      new Date().toISOString(),
      blockId,
    );
  }
}

export async function deleteLinksFrom(blockId: string): Promise<void> {
  const db = await getDb();
  const safe = blockId.replace(/'/g, "''");
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM links WHERE from_block = '${safe}'`,
  );
  if (rows.length > 0) {
    await recordDeletedRecords(rows.map((row) => ({ table_name: "links", record_id: row.id })));
  }
  await db.run(`DELETE FROM links WHERE from_block = ?`, blockId);
}

export async function getLinksForReflection(reflectionId: string): Promise<Link[]> {
  const db = await getDb();
  const safe = reflectionId.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM links WHERE reflection_id = '${safe}' ORDER BY created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    from_block: r.from_block,
    to_block: r.to_block,
    link_text: r.link_text,
    context: r.context,
    created_at: r.created_at,
    is_entity_link: r.is_entity_link === "1",
    reflection_id: r.reflection_id ?? null,
  }));
}

export async function getConnectedBlockIds(blockId: string): Promise<string[]> {
  const outgoing = await getOutgoingLinks(blockId);
  const back = await getBacklinks(blockId);
  const ids = new Set<string>();
  for (const l of outgoing) ids.add(l.to_block);
  for (const l of back) ids.add(l.from_block);
  return [...ids];
}
