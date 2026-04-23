import { createClient, type Client } from "@libsql/client/web";
import { allMigrations, SCHEMA_VERSION } from "../db/schema";
import type { SyncSnapshot } from "./snapshot";
import { snapshotChecksum } from "./snapshot";

export interface VaultSyncConfig {
  databaseName: string;
  url: string;
  authToken: string;
}

function toStringRecord(row: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    next[key] = value == null ? "" : String(value);
  }
  return next;
}

function parseJsonField<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createRemoteVaultClient(config: VaultSyncConfig): Client {
  return createClient({
    url: config.url,
    authToken: config.authToken,
    intMode: "number",
    readYourWrites: true,
  });
}

async function getRemoteSchemaVersion(client: Client): Promise<number> {
  const exists = await client.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'`,
  );
  if (exists.rows.length === 0) return 0;
  const versionRs = await client.execute(
    `SELECT value FROM schema_meta WHERE key = 'schema_version' LIMIT 1`,
  );
  const first = versionRs.rows[0] as Record<string, unknown> | undefined;
  return parseInt(String(first?.value ?? 0), 10);
}

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column|duplicate column name/i.test(message);
}

async function executeMigrationStatement(client: Client, sql: string): Promise<void> {
  if (!sql.trim()) return;
  try {
    await client.execute(sql);
  } catch (error) {
    // Ignore duplicate column errors - column already exists
    if (isDuplicateColumnError(error)) {
      return;
    }
    throw error;
  }
}

export async function ensureRemoteSchema(client: Client): Promise<void> {
  const currentVersion = await getRemoteSchemaVersion(client);
  if (currentVersion >= SCHEMA_VERSION) return;

  for (const sql of allMigrations()) {
    await executeMigrationStatement(client, sql);
  }
  await client.execute({
    sql: `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)`,
    args: [String(SCHEMA_VERSION)],
  });
}

export async function loadRemoteSnapshot(client: Client): Promise<SyncSnapshot> {
  const [blocksRs, entitiesRs, linksRs, reflectionsRs, lifeStagesRs, deletedRs] = await Promise.all([
    client.execute(`SELECT * FROM blocks ORDER BY captured_at ASC`),
    client.execute(`SELECT * FROM entities ORDER BY name ASC`),
    client.execute(`SELECT * FROM links ORDER BY created_at ASC`),
    client.execute(`SELECT * FROM reflections ORDER BY created_at ASC`),
    client.execute(`SELECT * FROM life_stages ORDER BY kindled_at ASC`),
    client.execute(`SELECT * FROM deleted_records ORDER BY deleted_at ASC`),
  ]);

  return {
    blocks: blocksRs.rows.map((row) => {
      const r = toStringRecord(row as Record<string, unknown>);
      return {
        id: r.id,
        type: r.type as SyncSnapshot["blocks"][number]["type"],
        content: r.content,
        scripture_ref: r.scripture_ref || undefined,
        scripture_display_ref: r.scripture_display_ref || undefined,
        scripture_translation: r.scripture_translation || undefined,
        scripture_verses: parseJsonField(r.scripture_verses, []),
        entity_type: (r.entity_type as SyncSnapshot["blocks"][number]["entity_type"]) || undefined,
        entity_id: r.entity_id || undefined,
        entity_name: r.entity_name || undefined,
        entity_aliases: parseJsonField(r.entity_aliases, []),
        entity_description: r.entity_description || undefined,
        source: r.source || undefined,
        captured_at: r.captured_at,
        modified_at: r.modified_at,
        tags: parseJsonField(r.tags, []),
      };
    }),
    entities: entitiesRs.rows.map((row) => {
      const r = toStringRecord(row as Record<string, unknown>);
      return {
        id: r.id,
        type: r.type as SyncSnapshot["entities"][number]["type"],
        name: r.name,
        aliases: parseJsonField(r.aliases, []),
        description: r.description ?? "",
        key_passages: parseJsonField(r.key_passages, []),
        mentioned_in: parseJsonField(r.mentioned_in, []),
        connected_entities: parseJsonField(r.connected_entities, []),
        familiarity: parseInt(r.familiarity, 10),
        last_studied: r.last_studied || undefined,
        next_suggested: r.next_suggested || undefined,
        updated_at: r.updated_at,
      };
    }),
    links: linksRs.rows.map((row) => {
      const r = toStringRecord(row as Record<string, unknown>);
      return {
        id: r.id,
        from_block: r.from_block,
        to_block: r.to_block,
        link_text: r.link_text,
        context: r.context,
        created_at: r.created_at,
        is_entity_link: r.is_entity_link === "1",
        reflection_id: r.reflection_id || null,
      };
    }),
    reflections: reflectionsRs.rows.map((row) => {
      const r = toStringRecord(row as Record<string, unknown>);
      return {
        id: r.id,
        block_id: r.block_id,
        body: r.body,
        created_at: r.created_at,
        modified_at: r.modified_at,
      };
    }),
    life_stages: lifeStagesRs.rows.map((row) => {
      const r = toStringRecord(row as Record<string, unknown>);
      return {
        block_id: r.block_id,
        stage: r.stage as SyncSnapshot["life_stages"][number]["stage"],
        kindled_at: r.kindled_at,
        last_reviewed: r.last_reviewed || undefined,
        next_review_at: r.next_review_at,
        review_count: parseInt(r.review_count, 10),
        settledness: parseInt(r.settledness, 10),
        linger_seconds: parseFloat(r.linger_seconds),
        notes_added: parseInt(r.notes_added, 10),
        connections_made: parseInt(r.connections_made, 10),
        updated_at: r.updated_at,
      };
    }),
    deleted_records: deletedRs.rows.map((row) => {
      const r = toStringRecord(row as Record<string, unknown>);
      return {
        table_name: r.table_name as SyncSnapshot["deleted_records"][number]["table_name"],
        record_id: r.record_id,
        deleted_at: r.deleted_at,
      };
    }),
  };
}

type StatementArgs = Array<string | number | null>;

export async function replaceRemoteSnapshot(client: Client, snapshot: SyncSnapshot): Promise<void> {
  const statements: Array<string | { sql: string; args: StatementArgs }> = [
    `DELETE FROM deleted_records`,
    `DELETE FROM links`,
    `DELETE FROM reflections`,
    `DELETE FROM life_stages`,
    `DELETE FROM entities`,
    `DELETE FROM blocks`,
  ];

  for (const block of snapshot.blocks) {
    statements.push({
      sql: `INSERT INTO blocks (id, type, content, scripture_ref, scripture_display_ref, scripture_translation, scripture_verses, entity_type, entity_id, entity_name, entity_aliases, entity_description, source, captured_at, modified_at, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
      ],
    });
  }

  for (const entity of snapshot.entities) {
    statements.push({
      sql: `INSERT INTO entities (id, type, name, aliases, description, key_passages, mentioned_in, connected_entities, familiarity, last_studied, next_suggested, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
      ],
    });
  }

  for (const reflection of snapshot.reflections) {
    statements.push({
      sql: `INSERT INTO reflections (id, block_id, body, created_at, modified_at) VALUES (?, ?, ?, ?, ?)`,
      args: [reflection.id, reflection.block_id, reflection.body, reflection.created_at, reflection.modified_at],
    });
  }

  for (const lifeStage of snapshot.life_stages) {
    statements.push({
      sql: `INSERT INTO life_stages (block_id, stage, kindled_at, last_reviewed, next_review_at, review_count, settledness, linger_seconds, notes_added, connections_made, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
      ],
    });
  }

  for (const link of snapshot.links) {
    statements.push({
      sql: `INSERT INTO links (id, from_block, to_block, link_text, context, created_at, is_entity_link, reflection_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        link.id,
        link.from_block,
        link.to_block,
        link.link_text,
        link.context,
        link.created_at,
        link.is_entity_link ? 1 : 0,
        link.reflection_id ?? null,
      ],
    });
  }

  for (const deleted of snapshot.deleted_records) {
    statements.push({
      sql: `INSERT INTO deleted_records (table_name, record_id, deleted_at) VALUES (?, ?, ?)`,
      args: [deleted.table_name, deleted.record_id, deleted.deleted_at],
    });
  }

  await client.batch(statements, "write");
}

export function remoteSnapshotStamp(snapshot: SyncSnapshot): string {
  return snapshotChecksum(snapshot);
}
