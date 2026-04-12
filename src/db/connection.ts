import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import * as SQLite from "wa-sqlite";
import { SCHEMA_VERSION, allMigrations } from "./schema";

type Sqlite3 = ReturnType<typeof SQLite.Factory>;

let dbInstance: Database | null = null;

export class Database {
  private sqlite3: Sqlite3;
  private db: number;
  private constructor(sqlite3: Sqlite3, db: number) {
    this.sqlite3 = sqlite3;
    this.db = db;
  }

  static async init(): Promise<Database> {
    if (dbInstance) return dbInstance;

    const module = await SQLiteESMFactory();
    const sqlite3 = SQLite.Factory(module);

    const db = await sqlite3.open_v2("kindled");
    const instance = new Database(sqlite3, db);
    await instance.runMigrations();
    dbInstance = instance;
    return instance;
  }

  private async runMigrations(): Promise<void> {
    const currentVersion = await this.getUserVersion();
    if (currentVersion >= SCHEMA_VERSION) return;

    for (const sql of allMigrations()) {
      await this.sqlite3.exec(this.db, sql);
    }
    await this.setUserVersion(SCHEMA_VERSION);
  }

  private async getUserVersion(): Promise<number> {
    let version = 0;
    await this.sqlite3.exec(
      this.db,
      "SELECT value FROM schema_meta WHERE key = 'schema_version'",
      (row, _columns) => {
        version = parseInt(String(row[0]), 10);
      },
    );
    return version;
  }

  private async setUserVersion(version: number): Promise<void> {
    await this.sqlite3.exec(
      this.db,
      `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '${version}')`,
    );
  }

  async exec(sql: string): Promise<void> {
    await this.sqlite3.exec(this.db, sql);
  }

  async query<T = Record<string, string>>(sql: string): Promise<T[]> {
    const rows: T[] = [];

    await this.sqlite3.exec(this.db, sql, (row, cols) => {
      const obj: Record<string, string> = {};
      cols.forEach((col, i) => {
        obj[col] = String(row[i] ?? "");
      });
      rows.push(obj as T);
    });

    return rows;
  }

  async queryOne<T = Record<string, string>>(sql: string): Promise<T | null> {
    const rows = await this.query<T>(sql);
    return rows.length > 0 ? rows[0] : null;
  }

  async run(sql: string, ...params: unknown[]): Promise<void> {
    await this.sqlite3.run(this.db, sql, params as (string | number | null)[]);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite3.close(this.db);
      dbInstance = null;
    }
  }
}

export async function getDb(): Promise<Database> {
  return Database.init();
}
