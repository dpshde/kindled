import { getDb } from "./connection";

export type SyncTableName =
  | "blocks"
  | "entities"
  | "links"
  | "reflections"
  | "life_stages";

export interface DeletedRecord {
  table_name: SyncTableName;
  record_id: string;
  deleted_at: string;
}

export async function listDeletedRecords(): Promise<DeletedRecord[]> {
  const db = await getDb();
  const rows = await db.query<Record<string, string>>(
    `SELECT table_name, record_id, deleted_at FROM deleted_records ORDER BY deleted_at ASC`,
  );
  return rows.map((row) => ({
    table_name: row.table_name as SyncTableName,
    record_id: row.record_id,
    deleted_at: row.deleted_at,
  }));
}

export async function recordDeletedRecord(
  tableName: SyncTableName,
  recordId: string,
  deletedAt = new Date().toISOString(),
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT OR REPLACE INTO deleted_records (table_name, record_id, deleted_at) VALUES (?, ?, ?)`,
    tableName,
    recordId,
    deletedAt,
  );
}

export async function recordDeletedRecords(
  entries: Array<{ table_name: SyncTableName; record_id: string }>,
  deletedAt = new Date().toISOString(),
): Promise<void> {
  const db = await getDb();
  for (const entry of entries) {
    await db.run(
      `INSERT OR REPLACE INTO deleted_records (table_name, record_id, deleted_at) VALUES (?, ?, ?)`,
      entry.table_name,
      entry.record_id,
      deletedAt,
    );
  }
}
