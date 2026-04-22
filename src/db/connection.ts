import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import * as SQLite from "wa-sqlite";
import { SCHEMA_VERSION, allMigrations } from "./schema";
import { notifyLocalDatabaseChange } from "../sync/local-change-bus";

type Sqlite3 = ReturnType<typeof SQLite.Factory>;

let dbInstance: Database | null = null;
/** Ensures only one DB init runs; parallel getDb() must not open SQLite twice. */
let initPromise: Promise<Database> | null = null;

export class Database {
  private sqlite3: Sqlite3;
  private db: number;
  private isClosed = false;
  /** wa-sqlite-async is not safe for concurrent interleaved calls on one connection. */
  private mutexChain: Promise<void> = Promise.resolve();

  private constructor(sqlite3: Sqlite3, db: number) {
    this.sqlite3 = sqlite3;
    this.db = db;
  }

  private async withMutex<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.mutexChain;
    let release!: () => void;
    this.mutexChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  static async init(): Promise<Database> {
    if (dbInstance) return dbInstance;
    if (!initPromise) {
      initPromise = (async () => {
        const module = await SQLiteESMFactory();
        const sqlite3 = SQLite.Factory(module);

        const db = await sqlite3.open_v2("kindled_fire");
        const instance = new Database(sqlite3, db);
        await instance.runMigrations();
        dbInstance = instance;
        return instance;
      })();
    }
    try {
      return await initPromise;
    } catch (err) {
      initPromise = null;
      throw err;
    }
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
    // Check if schema_meta table exists first (it won't on fresh DB)
    let exists = false;
    await this.sqlite3.exec(
      this.db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'",
      (_row, _cols) => {
        exists = true;
      },
    );
    if (!exists) return 0;

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
    if (this.isClosed) return;
    return this.withMutex(async () => {
      await this.sqlite3.exec(this.db, sql);
      notifyLocalDatabaseChange();
    });
  }

  async query<T = Record<string, string>>(sql: string): Promise<T[]> {
    if (this.isClosed) return [];
    return this.withMutex(async () => {
      const rows: T[] = [];

      await this.sqlite3.exec(this.db, sql, (row, cols) => {
        const obj: Record<string, string> = {};
        cols.forEach((col, i) => {
          obj[col] = String(row[i] ?? "");
        });
        rows.push(obj as T);
      });

      return rows;
    });
  }

  async queryOne<T = Record<string, string>>(sql: string): Promise<T | null> {
    const rows = await this.query<T>(sql);
    return rows.length > 0 ? rows[0] : null;
  }

  async run(sql: string, ...params: unknown[]): Promise<void> {
    if (this.isClosed) return;
    return this.withMutex(async () => {
      await this.sqlite3.run(this.db, sql, params as (string | number | null)[]);
      notifyLocalDatabaseChange();
    });
  }

  async close(): Promise<void> {
    return this.withMutex(async () => {
      if (this.isClosed) return;
      this.isClosed = true;
      await this.sqlite3.close(this.db);
      dbInstance = null;
      initPromise = null;
    });
  }
}

export async function getDb(): Promise<Database> {
  return Database.init();
}
