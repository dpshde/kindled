/**
 * E2E tests for file-backed sync.
 *
 * Tests the full sync flow: attach → auto-import → push → reconnect → detach.
 * Mocks both the wa-sqlite Database and the File System Access API handle store.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// ── State shared between mocks and tests ──────────────────────────────────────

let sqlLog: string[] = [];
let storedHandle: FileSystemFileHandle | null = null;
let fakeFileContent: string = "";

// ── Mock: wa-sqlite Database ──────────────────────────────────────────────────

vi.mock("../db/connection", () => ({
  getDb: () =>
    Promise.resolve({
      run: (...args: unknown[]) => {
        sqlLog.push(args[0] as string);
      },
      exec: (sql: string) => {
        sqlLog.push(sql);
      },
      query: () => Promise.resolve([]),
      queryOne: () => Promise.resolve(null),
      close: () => {},
    }),
  Database: {},
}));

vi.mock("../db/schema", () => ({
  SCHEMA_VERSION: 3,
  allMigrations: () => [],
}));

vi.mock("../db/export", () => ({
  exportAllData: () =>
    Promise.resolve({
      format: "kindled",
      version: 1,
      exported_at: new Date().toISOString(),
      schema_version: 3,
      counts: { blocks: 0, entities: 0, links: 0, reflections: 0, life_stages: 0 },
      data: {
        blocks: [{ id: "blk_local", type: "note", content: "Local data" }],
        entities: [],
        links: [],
        reflections: [],
        life_stages: [],
      },
    }),
}));

// ── Mock: file-handle-store ───────────────────────────────────────────────────
//
// We can't use real IndexedDB in Node because FileSystemFileHandle
// can't be structured-cloned. Instead we mock the store with a simple variable.

vi.mock("./file-handle-store", () => ({
  isFileSystemAccessSupported: () => true,
  storeHandle: vi.fn(async (h: FileSystemFileHandle) => {
    storedHandle = h;
  }),
  loadHandle: vi.fn(async () => storedHandle),
  clearHandle: vi.fn(async () => {
    storedHandle = null;
  }),
  pickExistingFile: vi.fn(),
  createNewFile: vi.fn(),
  readFile: vi.fn(async () => {
    if (!fakeFileContent.trim()) return null;
    try {
      return JSON.parse(fakeFileContent);
    } catch {
      return null;
    }
  }),
  writeFile: vi.fn(async (_h: unknown, data: unknown) => {
    fakeFileContent = JSON.stringify(data);
  }),
  queryHandlePermission: vi.fn(async () => "granted"),
  requestHandlePermission: vi.fn(async () => "granted"),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeExport(n = 1): string {
  const blocks = Array.from({ length: n }, (_, i) => ({
    id: `blk_${i}`,
    type: "note",
    content: `Block ${i}`,
    scripture_ref: null,
    scripture_display_ref: null,
    scripture_translation: null,
    scripture_verses: null,
    entity_type: null,
    entity_id: null,
    entity_name: null,
    entity_aliases: null,
    entity_description: null,
    source: "manual",
    captured_at: "2025-01-01T00:00:00Z",
    modified_at: "2025-01-01T00:00:00Z",
    tags: "[]",
  }));
  return JSON.stringify({
    format: "kindled",
    version: 1,
    exported_at: "2025-06-01T00:00:00Z",
    schema_version: 3,
    counts: { blocks: n, entities: 0, links: 0, reflections: 0, life_stages: 0 },
    data: { blocks, entities: [], links: [], reflections: [], life_stages: [] },
  });
}

function fakeHandle(name: string): FileSystemFileHandle {
  return { name, kind: "file" } as unknown as FileSystemFileHandle;
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

// ── Imports (after mocks registered) ──────────────────────────────────────────

import { initFileSync, attachFile, createFile, detachFile, pullFromFileSync, __resetFileSyncForTests } from "./file-sync";
import * as storeMock from "./file-handle-store";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("file sync e2e", () => {
  beforeEach(() => {
    __resetFileSyncForTests();
    sqlLog = [];
    storedHandle = null;
    fakeFileContent = "";
  });

  // ── 1 ──────────────────────────────────────────────────────────────────────

  it("starts idle when no file was previously attached", async () => {
    const state = await initFileSync();
    expect(state.status).toBe("idle");
    expect(state.fileName).toBeNull();
  });

  // ── 2 ──────────────────────────────────────────────────────────────────────

  it("creates a new file and seeds it with current data", async () => {
    const handle = fakeHandle("kindled-sync.json");
    (storeMock.createNewFile as Mock).mockResolvedValueOnce(handle);

    const state = await createFile();
    expect(state.status).toBe("attached");
    expect(state.fileName).toBe("kindled-sync.json");

    // createFile should auto-push
    await flush();
    expect(storeMock.writeFile).toHaveBeenCalled();

    // The written data should be a valid export
    const writtenArg = (storeMock.writeFile as Mock).mock.calls[0][1];
    expect(writtenArg.format).toBe("kindled");
  });

  // ── 3 ──────────────────────────────────────────────────────────────────────

  it("auto-imports data from an existing file on attach", async () => {
    fakeFileContent = makeExport(2);
    const handle = fakeHandle("my-sync.json");
    (storeMock.pickExistingFile as Mock).mockResolvedValueOnce(handle);

    const state = await attachFile();
    expect(state.status).toBe("attached");

    await flush();

    const insertSqls = sqlLog.filter((s) =>
      s.includes("INSERT OR IGNORE INTO blocks"),
    );
    expect(insertSqls.length).toBe(2);
  });

  // ── 4 ──────────────────────────────────────────────────────────────────────

  it("persists handle so initFileSync reconnects", async () => {
    fakeFileContent = makeExport();
    const handle = fakeHandle("persisted.json");
    (storeMock.pickExistingFile as Mock).mockResolvedValueOnce(handle);
    await attachFile();
    await flush();

    // initFileSync should find the stored handle
    const state = await initFileSync();
    expect(state.status).toBe("attached");
    expect(state.fileName).toBe("persisted.json");
  });

  // ── 4b ─────────────────────────────────────────────────────────────────────

  it("auto-imports from file on init when handle is already attached", async () => {
    // Simulate: user has a stored handle and file contains data
    fakeFileContent = makeExport(3);
    storedHandle = fakeHandle("already-attached.json");

    // initFileSync finds the handle and grants permission
    const state = await initFileSync();
    expect(state.status).toBe("attached");

    // Manually trigger pullFromFileSync (as main.ts now does)
    const result = await pullFromFileSync();
    await flush();

    expect(result.imported).toBe(true);
    expect(result.counts.blocks).toBe(3);

    const insertSqls = sqlLog.filter((s) =>
      s.includes("INSERT OR IGNORE INTO blocks"),
    );
    expect(insertSqls.length).toBe(3);
  });

  it("auto-pulls newly added file records when the window regains focus", async () => {
    const listeners = new Map<string, Set<(e: Event) => void>>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = {
      addEventListener: (type: string, fn: (e: Event) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      dispatchEvent: (event: Event) => {
        for (const fn of listeners.get(event.type) ?? []) fn(event);
      },
    };

    storedHandle = fakeHandle("focus-refresh.json");
    await initFileSync();
    await pullFromFileSync();
    sqlLog = [];

    fakeFileContent = makeExport(2);
    ((globalThis as { window: { dispatchEvent: (event: Event) => void } }).window).dispatchEvent(new Event("focus"));
    await flush();
    await flush();

    const insertSqls = sqlLog.filter((s) =>
      s.includes("INSERT OR IGNORE INTO blocks"),
    );
    expect(insertSqls.length).toBe(2);

    (globalThis as { window?: unknown }).window = prevWindow;
  });

  it("does not re-import the same file snapshot twice", async () => {
    fakeFileContent = makeExport(2);
    storedHandle = fakeHandle("same-file.json");

    await initFileSync();
    const first = await pullFromFileSync();
    sqlLog = [];
    const second = await pullFromFileSync();
    await flush();

    expect(first.imported).toBe(true);
    expect(second.imported).toBe(false);
    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO blocks")).length).toBe(0);
  });

  it("stops auto-pulling after detach", async () => {
    const listeners = new Map<string, Set<(e: Event) => void>>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = {
      addEventListener: (type: string, fn: (e: Event) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      dispatchEvent: (event: Event) => {
        for (const fn of listeners.get(event.type) ?? []) fn(event);
      },
    };

    storedHandle = fakeHandle("detach-refresh.json");
    fakeFileContent = makeExport(1);
    await initFileSync();
    await pullFromFileSync();
    await detachFile();
    sqlLog = [];

    fakeFileContent = makeExport(3);
    ((globalThis as { window: { dispatchEvent: (event: Event) => void } }).window).dispatchEvent(new Event("focus"));
    await flush();
    await flush();

    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO blocks")).length).toBe(0);

    (globalThis as { window?: unknown }).window = prevWindow;
  });

  // ── 5 ──────────────────────────────────────────────────────────────────────

  it("detaches and returns to idle state", async () => {
    fakeFileContent = makeExport();
    const handle = fakeHandle("temp.json");
    (storeMock.pickExistingFile as Mock).mockResolvedValueOnce(handle);
    await attachFile();
    await flush();

    await detachFile();
    await flush();

    const state = await initFileSync();
    expect(state.status).toBe("idle");
  });

  // ── 6 ──────────────────────────────────────────────────────────────────────

  it("handles an empty file gracefully", async () => {
    fakeFileContent = "";
    const handle = fakeHandle("empty.json");
    (storeMock.pickExistingFile as Mock).mockResolvedValueOnce(handle);

    const state = await attachFile();
    expect(state.status).toBe("attached");

    await flush();
    expect(
      sqlLog.filter((s) => s.includes("INSERT OR IGNORE")).length,
    ).toBe(0);
  });

  // ── 7 ──────────────────────────────────────────────────────────────────────

  it("handles corrupt JSON without crashing", async () => {
    fakeFileContent = "{{not json}}";
    const handle = fakeHandle("bad.json");
    (storeMock.pickExistingFile as Mock).mockResolvedValueOnce(handle);

    const state = await attachFile();
    expect(state.status).toBe("attached");

    await flush();
    expect(
      sqlLog.filter((s) => s.includes("INSERT OR IGNORE")).length,
    ).toBe(0);
  });

  // ── 8 ──────────────────────────────────────────────────────────────────────

  it("imports all five table types", async () => {
    fakeFileContent = JSON.stringify({
      format: "kindled",
      version: 1,
      exported_at: "2025-06-01T00:00:00Z",
      schema_version: 3,
      counts: { blocks: 1, entities: 1, links: 1, reflections: 1, life_stages: 1 },
      data: {
        blocks: [
          {
            id: "blk_0", type: "note", content: "Test",
            scripture_ref: null, scripture_display_ref: null,
            scripture_translation: null, scripture_verses: null,
            entity_type: null, entity_id: null, entity_name: null,
            entity_aliases: null, entity_description: null,
            source: "manual", captured_at: "2025-01-01T00:00:00Z",
            modified_at: "2025-01-01T00:00:00Z", tags: "[]",
          },
        ],
        entities: [
          {
            id: "ent_0", type: "person", name: "Moses",
            aliases: "[]", description: "", key_passages: "[]",
            mentioned_in: "[]", connected_entities: "[]",
            familiarity: 0, last_studied: null, next_suggested: null,
          },
        ],
        links: [
          {
            id: "lnk_0", from_block: "blk_0", to_block: "blk_0",
            link_text: "test", context: "", created_at: "2025-01-01T00:00:00Z",
            is_entity_link: false, reflection_id: null,
          },
        ],
        reflections: [
          {
            id: "ref_0", block_id: "blk_0", body: "A thought",
            created_at: "2025-01-01T00:00:00Z", modified_at: "2025-01-01T00:00:00Z",
          },
        ],
        life_stages: [
          {
            block_id: "blk_0", stage: "flame", kindled_at: "2025-01-01T00:00:00Z",
            last_reviewed: null, next_review_at: "2025-01-08T00:00:00Z",
            review_count: 1, settledness: 5, linger_seconds: 10,
            notes_added: 0, connections_made: 0,
          },
        ],
      },
    });

    const handle = fakeHandle("full.json");
    (storeMock.pickExistingFile as Mock).mockResolvedValueOnce(handle);

    await attachFile();
    await flush();

    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO blocks")).length).toBe(1);
    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO entities")).length).toBe(1);
    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO links")).length).toBe(1);
    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO reflections")).length).toBe(1);
    expect(sqlLog.filter((s) => s.includes("INSERT OR IGNORE INTO life_stages")).length).toBe(1);
  });
});
