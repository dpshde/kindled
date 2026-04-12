import { getDb } from "./connection";
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
}): Promise<string> {
  const db = await getDb();
  const id = generateId();

  await db.run(
    `INSERT INTO links (id, from_block, to_block, link_text, context, created_at, is_entity_link) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    link.from_block,
    link.to_block,
    link.link_text,
    link.context ?? "",
    new Date().toISOString(),
    link.is_entity_link ? 1 : 0,
  );

  // Update connections_made on the source block's life stage
  await db.run(
    `UPDATE life_stages SET connections_made = connections_made + 1 WHERE block_id = ?`,
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
  }));
}

export async function deleteLinksFrom(blockId: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM links WHERE from_block = ?`, blockId);
}

export async function getConnectedBlockIds(blockId: string): Promise<string[]> {
  const outgoing = await getOutgoingLinks(blockId);
  const back = await getBacklinks(blockId);
  const ids = new Set<string>();
  for (const l of outgoing) ids.add(l.to_block);
  for (const l of back) ids.add(l.from_block);
  return [...ids];
}
