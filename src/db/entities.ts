import { getDb } from "./connection";
import type { Entity, EntityType } from "./types";

export async function createEntity(
  entity: Omit<Entity, "mentioned_in" | "connected_entities"> &
    Partial<Pick<Entity, "mentioned_in" | "connected_entities">>,
): Promise<string> {
  const db = await getDb();
  const id = entity.id ?? `ent_${entity.type.charAt(0)}_${entity.name.toLowerCase().replace(/\s+/g, "_")}`;

  const now = new Date().toISOString();

  await db.run(
    `INSERT OR REPLACE INTO entities (id, type, name, aliases, description, key_passages, mentioned_in, connected_entities, familiarity, last_studied, next_suggested, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    entity.type,
    entity.name,
    JSON.stringify(entity.aliases ?? []),
    entity.description ?? "",
    JSON.stringify(entity.key_passages ?? []),
    JSON.stringify(entity.mentioned_in ?? []),
    JSON.stringify(entity.connected_entities ?? []),
    entity.familiarity ?? 0,
    entity.last_studied ?? null,
    entity.next_suggested ?? null,
    now,
  );

  return id;
}

export async function getEntity(id: string): Promise<Entity | null> {
  const db = await getDb();
  const safeId = id.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM entities WHERE id = '${safeId}'`,
  );
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    type: r.type as EntityType,
    name: r.name,
    aliases: JSON.parse(r.aliases || "[]"),
    description: r.description,
    key_passages: JSON.parse(r.key_passages || "[]"),
    mentioned_in: JSON.parse(r.mentioned_in || "[]"),
    connected_entities: JSON.parse(r.connected_entities || "[]"),
    familiarity: parseInt(r.familiarity, 10),
    last_studied: r.last_studied ?? undefined,
    next_suggested: r.next_suggested ?? undefined,
  };
}

export async function getAllEntities(): Promise<Entity[]> {
  const db = await getDb();
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM entities ORDER BY name`,
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type as EntityType,
    name: r.name,
    aliases: JSON.parse(r.aliases || "[]"),
    description: r.description,
    key_passages: JSON.parse(r.key_passages || "[]"),
    mentioned_in: JSON.parse(r.mentioned_in || "[]"),
    connected_entities: JSON.parse(r.connected_entities || "[]"),
    familiarity: parseInt(r.familiarity, 10),
    last_studied: r.last_studied ?? undefined,
    next_suggested: r.next_suggested ?? undefined,
  }));
}

export async function findEntityByName(name: string): Promise<Entity | null> {
  const db = await getDb();
  const safeName = name.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM entities WHERE name = '${safeName}' COLLATE NOCASE`,
  );
  if (rows.length > 0) {
    const r = rows[0];
    return {
      id: r.id,
      type: r.type as EntityType,
      name: r.name,
      aliases: JSON.parse(r.aliases || "[]"),
      description: r.description,
      key_passages: JSON.parse(r.key_passages || "[]"),
      mentioned_in: JSON.parse(r.mentioned_in || "[]"),
      connected_entities: JSON.parse(r.connected_entities || "[]"),
      familiarity: parseInt(r.familiarity, 10),
      last_studied: r.last_studied ?? undefined,
      next_suggested: r.next_suggested ?? undefined,
    };
  }

  // Also check aliases
  const allEntities = await getAllEntities();
  return (
    allEntities.find((e) =>
      e.aliases.some((a) => a.toLowerCase() === name.toLowerCase()),
    ) ?? null
  );
}

export async function addBlockMention(
  entityId: string,
  blockId: string,
): Promise<void> {
  const entity = await getEntity(entityId);
  if (!entity) return;

  const mentioned = new Set(entity.mentioned_in);
  mentioned.add(blockId);

  const db = await getDb();
  await db.run(
    `UPDATE entities SET mentioned_in = ?, updated_at = ? WHERE id = ?`,
    JSON.stringify([...mentioned]),
    new Date().toISOString(),
    entityId,
  );
}

export async function updateEntityFamiliarity(
  entityId: string,
  delta: number,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `UPDATE entities SET familiarity = MIN(100, MAX(0, familiarity + ?)), last_studied = ?, updated_at = ? WHERE id = ?`,
    delta,
    now,
    now,
    entityId,
  );
}
