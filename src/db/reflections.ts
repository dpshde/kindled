import { getDb } from "./connection";
import { deleteLinksForReflection } from "./links";
import type { Reflection } from "./types";

function generateReflectionId(): string {
  return `rfl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeSqlId(id: string): string {
  return id.replace(/'/g, "''");
}

function rowToReflection(r: Record<string, string>): Reflection {
  return {
    id: r.id,
    block_id: r.block_id,
    body: r.body,
    created_at: r.created_at,
    modified_at: r.modified_at,
  };
}

/** Split legacy notes appended to scripture `content` as `\n\n[date] body`. */
export function splitLegacyReflectionBodiesFromContent(content: string): {
  head: string;
  bodies: string[];
} {
  const idx = content.search(/\n\n\[/);
  if (idx === -1) return { head: content, bodies: [] };
  const head = content.slice(0, idx).trimEnd();
  const tail = content.slice(idx + 2);
  const parts = tail
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bodies: string[] = [];
  for (const p of parts) {
    if (!p.startsWith("[")) continue;
    const m = p.match(/^\[[^\]]+\]\s*(.*)$/s);
    if (m) bodies.push(m[1].trim());
  }
  return { head, bodies };
}

async function syncNotesAddedForBlock(blockId: string): Promise<void> {
  const db = await getDb();
  const safe = escapeSqlId(blockId);
  const rows = await db.query<{ c: string }>(
    `SELECT COUNT(*) as c FROM reflections WHERE block_id = '${safe}'`,
  );
  const n = parseInt(rows[0]?.c ?? "0", 10);
  await db.run(
    `UPDATE life_stages SET notes_added = ? WHERE block_id = ?`,
    n,
    blockId,
  );
}

let legacyMigrationPromise: Promise<void> | null = null;

async function runLegacyReflectionMigration(): Promise<void> {
  const db = await getDb();
  const flag = await db.queryOne<{ value: string }>(
    `SELECT value FROM schema_meta WHERE key = 'legacy_reflections_migrated'`,
  );
  if (flag?.value === "1") return;

  const rows = await db.query<Record<string, string>>(
    `SELECT id, content FROM blocks WHERE type = 'scripture'`,
  );

  for (const row of rows) {
    const { head, bodies } = splitLegacyReflectionBodiesFromContent(row.content);
    if (bodies.length === 0) continue;

    const now = new Date().toISOString();
    for (const body of bodies) {
      if (!body) continue;
      const rid = generateReflectionId();
      await db.run(
        `INSERT INTO reflections (id, block_id, body, created_at, modified_at) VALUES (?, ?, ?, ?, ?)`,
        rid,
        row.id,
        body,
        now,
        now,
      );
    }
    await db.run(
      `UPDATE blocks SET content = ?, modified_at = ? WHERE id = ?`,
      head,
      now,
      row.id,
    );
    await syncNotesAddedForBlock(row.id);
  }

  await db.run(
    `INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)`,
    "legacy_reflections_migrated",
    "1",
  );
}

export function ensureLegacyReflectionsMigrated(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = runLegacyReflectionMigration();
  }
  return legacyMigrationPromise;
}

export async function getReflectionsForBlock(blockId: string): Promise<Reflection[]> {
  await ensureLegacyReflectionsMigrated();
  const db = await getDb();
  const safe = escapeSqlId(blockId);
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM reflections WHERE block_id = '${safe}' ORDER BY modified_at DESC`,
  );
  return rows.map(rowToReflection);
}

export async function getReflection(id: string): Promise<Reflection | null> {
  await ensureLegacyReflectionsMigrated();
  const db = await getDb();
  const safe = escapeSqlId(id);
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM reflections WHERE id = '${safe}' LIMIT 1`,
  );
  if (rows.length === 0) return null;
  return rowToReflection(rows[0]);
}

export async function createReflection(blockId: string, body: string): Promise<string> {
  await ensureLegacyReflectionsMigrated();
  const db = await getDb();
  const id = generateReflectionId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO reflections (id, block_id, body, created_at, modified_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    blockId,
    body,
    now,
    now,
  );
  await syncNotesAddedForBlock(blockId);
  return id;
}

export async function updateReflection(id: string, body: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE reflections SET body = ?, modified_at = ? WHERE id = ?`,
    body,
    new Date().toISOString(),
    id,
  );
}

export async function deleteReflection(id: string): Promise<void> {
  const r = await getReflection(id);
  if (!r) return;
  await deleteLinksForReflection(id);
  const db = await getDb();
  await db.run(`DELETE FROM reflections WHERE id = ?`, id);
  await syncNotesAddedForBlock(r.block_id);
}
