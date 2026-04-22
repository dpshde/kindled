import { getDb } from "../db/connection";
import type { KindledExport } from "../db/export";
import type { Block, Entity, Link, Reflection, LifeStageRecord } from "../db/types";
import { listDeletedRecords, type DeletedRecord } from "../db/tombstones";
import { withLocalDatabaseChangeSuppressed } from "./local-change-bus";

export interface SyncEntityRow extends Entity {
  updated_at: string;
}

export interface SyncLifeStageRow extends LifeStageRecord {
  updated_at: string;
}

export interface SyncSnapshot {
  blocks: Block[];
  entities: SyncEntityRow[];
  links: Link[];
  reflections: Reflection[];
  life_stages: SyncLifeStageRow[];
  deleted_records: DeletedRecord[];
}

function parseJsonField<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToBlock(row: Record<string, string>): Block {
  return {
    id: row.id,
    type: row.type as Block["type"],
    content: row.content,
    scripture_ref: row.scripture_ref || undefined,
    scripture_display_ref: row.scripture_display_ref || undefined,
    scripture_translation: row.scripture_translation || undefined,
    scripture_verses: parseJsonField(row.scripture_verses, []),
    entity_type: (row.entity_type as Block["entity_type"]) || undefined,
    entity_id: row.entity_id || undefined,
    entity_name: row.entity_name || undefined,
    entity_aliases: parseJsonField(row.entity_aliases, []),
    entity_description: row.entity_description || undefined,
    source: row.source || undefined,
    captured_at: row.captured_at,
    modified_at: row.modified_at,
    tags: parseJsonField(row.tags, []),
  };
}

function rowToEntity(row: Record<string, string>): SyncEntityRow {
  return {
    id: row.id,
    type: row.type as Entity["type"],
    name: row.name,
    aliases: parseJsonField(row.aliases, []),
    description: row.description ?? "",
    key_passages: parseJsonField(row.key_passages, []),
    mentioned_in: parseJsonField(row.mentioned_in, []),
    connected_entities: parseJsonField(row.connected_entities, []),
    familiarity: parseInt(row.familiarity, 10),
    last_studied: row.last_studied || undefined,
    next_suggested: row.next_suggested || undefined,
    updated_at: row.updated_at,
  };
}

function rowToLink(row: Record<string, string>): Link {
  return {
    id: row.id,
    from_block: row.from_block,
    to_block: row.to_block,
    link_text: row.link_text,
    context: row.context,
    created_at: row.created_at,
    is_entity_link: row.is_entity_link === "1",
    reflection_id: row.reflection_id || null,
  };
}

function rowToReflection(row: Record<string, string>): Reflection {
  return {
    id: row.id,
    block_id: row.block_id,
    body: row.body,
    created_at: row.created_at,
    modified_at: row.modified_at,
  };
}

function rowToLifeStage(row: Record<string, string>): SyncLifeStageRow {
  return {
    block_id: row.block_id,
    stage: row.stage as LifeStageRecord["stage"],
    kindled_at: row.kindled_at,
    last_reviewed: row.last_reviewed || undefined,
    next_review_at: row.next_review_at,
    review_count: parseInt(row.review_count, 10),
    settledness: parseInt(row.settledness, 10),
    linger_seconds: parseFloat(row.linger_seconds),
    notes_added: parseInt(row.notes_added, 10),
    connections_made: parseInt(row.connections_made, 10),
    updated_at: row.updated_at,
  };
}

export function rowTimestamp(
  table: DeletedRecord["table_name"] | "deleted_records",
  row: Block | SyncEntityRow | Link | Reflection | SyncLifeStageRow | DeletedRecord,
): string {
  switch (table) {
    case "blocks":
      return (row as Block).modified_at;
    case "entities":
      return (row as SyncEntityRow).updated_at;
    case "links":
      return (row as Link).created_at;
    case "reflections":
      return (row as Reflection).modified_at;
    case "life_stages":
      return (row as SyncLifeStageRow).updated_at;
    case "deleted_records":
      return (row as DeletedRecord).deleted_at;
  }
}

function isoMs(value: string | undefined | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function pickNewer<T>(current: T | undefined, next: T, getTime: (row: T) => string): T {
  if (!current) return next;
  return isoMs(getTime(next)) >= isoMs(getTime(current)) ? next : current;
}

function mergeByKey<T>(
  rowsA: T[],
  rowsB: T[],
  keyOf: (row: T) => string,
  timeOf: (row: T) => string,
): T[] {
  const merged = new Map<string, T>();
  for (const row of [...rowsA, ...rowsB]) {
    const key = keyOf(row);
    merged.set(key, pickNewer(merged.get(key), row, timeOf));
  }
  return [...merged.values()];
}

function mergeDeletedRecords(a: DeletedRecord[], b: DeletedRecord[]): DeletedRecord[] {
  return mergeByKey(
    a,
    b,
    (row) => `${row.table_name}:${row.record_id}`,
    (row) => row.deleted_at,
  );
}

function applyDeletes<T>(
  table: DeletedRecord["table_name"],
  rows: T[],
  keyOf: (row: T) => string,
  deleted: DeletedRecord[],
): T[] {
  const deletedMap = new Map<string, DeletedRecord>();
  for (const entry of deleted) {
    if (entry.table_name !== table) continue;
    deletedMap.set(entry.record_id, entry);
  }
  return rows.filter((row) => {
    const deletedRecord = deletedMap.get(keyOf(row));
    if (!deletedRecord) return true;
    return isoMs(rowTimestamp(table, row as never)) > isoMs(deletedRecord.deleted_at);
  });
}

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  const deleted_records = mergeDeletedRecords(local.deleted_records, remote.deleted_records);

  const blocks = applyDeletes(
    "blocks",
    mergeByKey(local.blocks, remote.blocks, (row) => row.id, (row) => row.modified_at),
    (row) => row.id,
    deleted_records,
  );
  const entities = applyDeletes(
    "entities",
    mergeByKey(local.entities, remote.entities, (row) => row.id, (row) => row.updated_at),
    (row) => row.id,
    deleted_records,
  );
  const links = applyDeletes(
    "links",
    mergeByKey(local.links, remote.links, (row) => row.id, (row) => row.created_at),
    (row) => row.id,
    deleted_records,
  );
  const reflections = applyDeletes(
    "reflections",
    mergeByKey(local.reflections, remote.reflections, (row) => row.id, (row) => row.modified_at),
    (row) => row.id,
    deleted_records,
  );
  const life_stages = applyDeletes(
    "life_stages",
    mergeByKey(local.life_stages, remote.life_stages, (row) => row.block_id, (row) => row.updated_at),
    (row) => row.block_id,
    deleted_records,
  );

  return {
    blocks,
    entities,
    links,
    reflections,
    life_stages,
    deleted_records,
  };
}

export async function loadLocalSnapshot(): Promise<SyncSnapshot> {
  const db = await getDb();
  const [blockRows, entityRows, linkRows, reflectionRows, lifeStageRows, deleted_records] = await Promise.all([
    db.query<Record<string, string>>(`SELECT * FROM blocks ORDER BY captured_at ASC`),
    db.query<Record<string, string>>(`SELECT * FROM entities ORDER BY name ASC`),
    db.query<Record<string, string>>(`SELECT * FROM links ORDER BY created_at ASC`),
    db.query<Record<string, string>>(`SELECT * FROM reflections ORDER BY created_at ASC`),
    db.query<Record<string, string>>(`SELECT * FROM life_stages ORDER BY kindled_at ASC`),
    listDeletedRecords(),
  ]);

  return {
    blocks: blockRows.map(rowToBlock),
    entities: entityRows.map(rowToEntity),
    links: linkRows.map(rowToLink),
    reflections: reflectionRows.map(rowToReflection),
    life_stages: lifeStageRows.map(rowToLifeStage),
    deleted_records,
  };
}

export async function applySnapshotToLocal(snapshot: SyncSnapshot): Promise<void> {
  const db = await getDb();
  await withLocalDatabaseChangeSuppressed(async () => {
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`DELETE FROM deleted_records`);
      await db.run(`DELETE FROM links`);
      await db.run(`DELETE FROM reflections`);
      await db.run(`DELETE FROM life_stages`);
      await db.run(`DELETE FROM entities`);
      await db.run(`DELETE FROM blocks`);

      for (const block of snapshot.blocks) {
        await db.run(
          `INSERT INTO blocks (id, type, content, scripture_ref, scripture_display_ref, scripture_translation, scripture_verses, entity_type, entity_id, entity_name, entity_aliases, entity_description, source, captured_at, modified_at, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          block.id,
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
          block.captured_at,
          block.modified_at,
          JSON.stringify(block.tags ?? []),
        );
      }

      for (const entity of snapshot.entities) {
        await db.run(
          `INSERT INTO entities (id, type, name, aliases, description, key_passages, mentioned_in, connected_entities, familiarity, last_studied, next_suggested, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          entity.id,
          entity.type,
          entity.name,
          JSON.stringify(entity.aliases ?? []),
          entity.description ?? "",
          JSON.stringify(entity.key_passages ?? []),
          JSON.stringify(entity.mentioned_in ?? []),
          JSON.stringify(entity.connected_entities ?? []),
          entity.familiarity,
          entity.last_studied ?? null,
          entity.next_suggested ?? null,
          entity.updated_at,
        );
      }

      for (const reflection of snapshot.reflections) {
        await db.run(
          `INSERT INTO reflections (id, block_id, body, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?)`,
          reflection.id,
          reflection.block_id,
          reflection.body,
          reflection.created_at,
          reflection.modified_at,
        );
      }

      for (const lifeStage of snapshot.life_stages) {
        await db.run(
          `INSERT INTO life_stages (block_id, stage, kindled_at, last_reviewed, next_review_at, review_count, settledness, linger_seconds, notes_added, connections_made, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          lifeStage.block_id,
          lifeStage.stage,
          lifeStage.kindled_at,
          lifeStage.last_reviewed ?? null,
          lifeStage.next_review_at,
          lifeStage.review_count,
          lifeStage.settledness,
          lifeStage.linger_seconds,
          lifeStage.notes_added,
          lifeStage.connections_made,
          lifeStage.updated_at,
        );
      }

      for (const link of snapshot.links) {
        await db.run(
          `INSERT INTO links (id, from_block, to_block, link_text, context, created_at, is_entity_link, reflection_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          link.id,
          link.from_block,
          link.to_block,
          link.link_text,
          link.context,
          link.created_at,
          link.is_entity_link ? 1 : 0,
          link.reflection_id ?? null,
        );
      }

      for (const deleted of snapshot.deleted_records) {
        await db.run(
          `INSERT INTO deleted_records (table_name, record_id, deleted_at) VALUES (?, ?, ?)`,
          deleted.table_name,
          deleted.record_id,
          deleted.deleted_at,
        );
      }

      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  });
}

export function normalizeLegacyExportToSnapshot(payload: KindledExport): SyncSnapshot {
  return {
    blocks: payload.data.blocks,
    entities: payload.data.entities.map((entity) => ({
      ...entity,
      updated_at: payload.exported_at,
    })),
    links: payload.data.links,
    reflections: payload.data.reflections,
    life_stages: payload.data.life_stages.map((lifeStage) => ({
      ...lifeStage,
      updated_at: payload.exported_at,
    })),
    deleted_records: [],
  };
}

export function isSnapshotEmpty(snapshot: SyncSnapshot): boolean {
  return (
    snapshot.blocks.length === 0 &&
    snapshot.entities.length === 0 &&
    snapshot.links.length === 0 &&
    snapshot.reflections.length === 0 &&
    snapshot.life_stages.length === 0 &&
    snapshot.deleted_records.length === 0
  );
}

export function snapshotChecksum(snapshot: SyncSnapshot): string {
  return JSON.stringify({
    blocks: snapshot.blocks.map((row) => [row.id, row.modified_at]),
    entities: snapshot.entities.map((row) => [row.id, row.updated_at]),
    links: snapshot.links.map((row) => [row.id, row.created_at]),
    reflections: snapshot.reflections.map((row) => [row.id, row.modified_at]),
    life_stages: snapshot.life_stages.map((row) => [row.block_id, row.updated_at]),
    deleted_records: snapshot.deleted_records.map((row) => [row.table_name, row.record_id, row.deleted_at]),
  });
}
