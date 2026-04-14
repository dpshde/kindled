import { getDb } from "../db/connection";

/** Resolve existing scripture block id by ref (plain TS). */
export async function findScriptureBlockByRef(ref: string): Promise<string | null> {
  const db = await getDb();
  const safeRef = ref.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT id FROM blocks WHERE scripture_ref = '${safeRef}' LIMIT 1`,
  );
  return rows.length > 0 ? rows[0].id : null;
}
