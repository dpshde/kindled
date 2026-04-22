/**
 * File-backed sync: keeps a local JSON file in sync with the wa-sqlite database.
 *
 * Adapts at runtime:
 *   - Browser: uses File System Access API (file-handle-store.ts)
 *   - Tauri:   uses native open/save dialogs plus @tauri-apps/plugin-fs (tauri-file-store.ts)
 *
 * Flow:
 *   1. User "attaches" a file via the OS file picker.
 *   2. On session start: auto-import from file (merge into local DB).
 *   3. After every local write → debounce-export to file (2s).
 *   4. On visibility change (tab becomes active) → re-read and merge.
 */

import { getDb } from "../db/connection";
import { exportAllData, type KindledExport } from "../db/export";
import { SCHEMA_VERSION } from "../db/schema";
import { isTauriRuntime, type TauriFileRef } from "./tauri-file-store";
import * as browserStore from "./file-handle-store";
import * as tauriStore from "./tauri-file-store";

/** Runtime-selected file store (Tauri native FS vs browser File System Access). */
const fs = () => (isTauriRuntime() ? tauriStore : browserStore);

/** Union handle type: browser FileSystemFileHandle or Tauri lightweight ref. */
type AnyHandle = FileSystemFileHandle | TauriFileRef;

// ── Public types ──────────────────────────────────────────────────────────────

export type SyncStatus =
  | "idle" /** no file attached */
  | "attached" /** file handle stored, permission OK */
  | "needs-permission" /** handle stored but permission revoked */
  | "unsupported"; /** browser doesn't have File System Access API */

export interface SyncState {
  status: SyncStatus;
  fileName: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
}

// ── Singleton state ───────────────────────────────────────────────────────────

let currentHandle: AnyHandle | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let autoPullWatching = false;
let pullInFlight: Promise<{ imported: boolean; counts: Record<string, number> }> | null = null;
let pushSuppressionDepth = 0;
let lastObservedFileStamp: string | null = null;
const DEBOUNCE_MS = 2000;
const POLL_MS = 15000;

const listeners = new Set<(state: SyncState) => void>();
let snapshot: SyncState = {
  status: "idle",
  fileName: null,
  lastSyncedAt: null,
  syncing: false,
};

function emit(update: Partial<SyncState>) {
  snapshot = { ...snapshot, ...update };
  for (const fn of listeners) fn(snapshot);
}

/** Subscribe to sync state changes. Returns unsubscribe fn. */
export function onSyncStateChange(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  fn(snapshot); // deliver current state immediately
  return () => listeners.delete(fn);
}

export function getSyncState(): SyncState {
  return { ...snapshot };
}

function makeFileStamp(data: KindledExport): string {
  return [
    data.exported_at,
    data.schema_version,
    data.counts.blocks,
    data.counts.entities,
    data.counts.links,
    data.counts.reflections,
    data.counts.life_stages,
  ].join("|");
}

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function canAutoPull(): boolean {
  return !!currentHandle && snapshot.status === "attached" && !snapshot.syncing && isDocumentVisible();
}

async function maybeAutoPull(): Promise<void> {
  if (!canAutoPull()) return;
  try {
    await pullFromFileSync();
  } catch {
    // Ignore background sync failures; surfaced on explicit actions instead.
  }
}

function ensureAutoPullWatching(): void {
  if (autoPullWatching || typeof window === "undefined") return;
  autoPullWatching = true;

  const onVisibility = () => {
    if (isDocumentVisible()) void maybeAutoPull();
  };

  window.addEventListener("focus", () => void maybeAutoPull());
  window.addEventListener("pageshow", () => void maybeAutoPull());
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  window.addEventListener("online", () => void maybeAutoPull());

  pollTimer = setInterval(() => {
    void maybeAutoPull();
  }, POLL_MS);
}

function withPushSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  pushSuppressionDepth += 1;
  return fn().finally(() => {
    pushSuppressionDepth = Math.max(0, pushSuppressionDepth - 1);
  });
}

// ── Init (call once at boot) ──────────────────────────────────────────────────

/**
 * Check for a previously-stored file handle. If found, verify permission.
 * Does NOT auto-import — call `pullFromFileSync()` separately after DB init.
 */
export async function initFileSync(): Promise<SyncState> {
  ensureAutoPullWatching();

  if (!fs().isFileSystemAccessSupported()) {
    emit({ status: "unsupported", fileName: null, syncing: false });
    return snapshot;
  }

  const handle = await fs().loadHandle();
  if (!handle) {
    emit({ status: "idle", fileName: null, syncing: false });
    return snapshot;
  }

  currentHandle = handle;
  const perm = await fs().queryHandlePermission(handle as never);
  if (perm === "granted") {
    emit({
      status: "attached",
      fileName: handle.name,
      syncing: false,
      lastSyncedAt: snapshot.lastSyncedAt,
    });
  } else {
    emit({
      status: "needs-permission",
      fileName: handle.name,
      syncing: false,
    });
  }

  return snapshot;
}

// ── Attach / Detach ───────────────────────────────────────────────────────────

/** Open the OS file picker to select an existing sync file and auto-import. */
export async function attachFile(): Promise<SyncState> {
  if (!fs().isFileSystemAccessSupported()) {
    emit({ status: "unsupported" });
    return snapshot;
  }

  const handle = await fs().pickExistingFile();
  if (!handle) return snapshot; // user cancelled

  await finalizeAttach(handle);
  await pullFromFileSync();
  return snapshot;
}

/** Open the OS save picker to create a new sync file and seed it with current data. */
export async function createFile(): Promise<SyncState> {
  if (!fs().isFileSystemAccessSupported()) {
    emit({ status: "unsupported" });
    return snapshot;
  }

  const handle = await fs().createNewFile();
  if (!handle) return snapshot; // user cancelled

  await finalizeAttach(handle);
  await pushToFileSync();
  return snapshot;
}

/** Common attach finalization — request permission, store handle, emit state. */
async function finalizeAttach(handle: AnyHandle): Promise<SyncState> {
  ensureAutoPullWatching();

  const perm = await fs().requestHandlePermission(handle as never);
  if (perm !== "granted") {
    emit({ status: "needs-permission", fileName: handle.name });
    return snapshot;
  }

  currentHandle = handle;
  await fs().storeHandle(handle as never);
  emit({ status: "attached", fileName: handle.name, syncing: false });
  return snapshot;
}

/** Remove the file handle and stop syncing. */
export async function detachFile(): Promise<void> {
  if (debounceTimer) clearTimeout(debounceTimer);
  currentHandle = null;
  lastObservedFileStamp = null;
  await fs().clearHandle();
  emit({ status: "idle", fileName: null, lastSyncedAt: null, syncing: false });
}

/** Re-request permission for a stored handle (e.g. after browser revoked it). */
export async function grantPermission(): Promise<SyncState> {
  if (!currentHandle) return snapshot;
  const perm = await fs().requestHandlePermission(currentHandle as never);
  if (perm === "granted") {
    emit({ status: "attached", fileName: currentHandle.name });
  }
  return snapshot;
}

// ── Pull (file → local DB) ────────────────────────────────────────────────────

/**
 * Read the sync file and import its data into the local wa-sqlite DB.
 * This is the "pull" operation — use after iCloud sync brings in changes
 * from another device.
 *
 * Strategy: import missing rows by primary key. Existing local rows are kept
 * as-is. This is intentionally non-destructive: pull behaves like an import,
 * not a replace.
 */
export async function pullFromFileSync(): Promise<{
  imported: boolean;
  counts: Record<string, number>;
}> {
  if (!currentHandle) return { imported: false, counts: {} };
  if (pullInFlight) return pullInFlight;

  pullInFlight = (async () => {
    emit({ syncing: true });

    try {
      const fileData = await fs().readFile<KindledExport>(currentHandle as never);
      if (!fileData || fileData.format !== "kindled") {
        emit({ syncing: false });
        return { imported: false, counts: {} };
      }

      const nextStamp = makeFileStamp(fileData);
      if (nextStamp === lastObservedFileStamp) {
        emit({ syncing: false });
        return { imported: false, counts: {} };
      }

      const counts = await withPushSuppressed(() => importExportData(fileData));
      lastObservedFileStamp = nextStamp;
      const now = new Date().toISOString();
      emit({ lastSyncedAt: now, syncing: false });
      return { imported: true, counts };
    } catch (err) {
      emit({ syncing: false });
      throw err;
    } finally {
      pullInFlight = null;
    }
  })();

  return pullInFlight;
}

// ── Push (local DB → file) ────────────────────────────────────────────────────

/** Export local DB and write to the sync file immediately. */
export async function pushToFileSync(): Promise<void> {
  if (!currentHandle) return;
  emit({ syncing: true });
  try {
    const payload = await exportAllData();
    await fs().writeFile(currentHandle as never, payload);
    lastObservedFileStamp = makeFileStamp(payload);
    const now = new Date().toISOString();
    emit({ lastSyncedAt: now, syncing: false });
  } catch (err) {
    emit({ syncing: false });
    throw err;
  }
}

/**
 * Schedule a debounced push. Call this after any DB write to keep the file
 * in sync without hammering the filesystem on rapid edits.
 */
export function schedulePush(): void {
  if (!currentHandle || pushSuppressionDepth > 0) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void pushToFileSync(), DEBOUNCE_MS);
}

export function __resetFileSyncForTests(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (pollTimer) clearInterval(pollTimer);
  currentHandle = null;
  debounceTimer = undefined;
  pollTimer = undefined;
  autoPullWatching = false;
  pullInFlight = null;
  pushSuppressionDepth = 0;
  lastObservedFileStamp = null;
  snapshot = {
    status: "idle",
    fileName: null,
    lastSyncedAt: null,
    syncing: false,
  };
  listeners.clear();
}

// ── Import logic ──────────────────────────────────────────────────────────────

async function importExportData(
  data: KindledExport,
): Promise<Record<string, number>> {
  const db = await getDb();
  const counts: Record<string, number> = {};

  // --- blocks ---
  let blockCount = 0;
  for (const b of data.data.blocks) {
    await db.run(
      `INSERT OR IGNORE INTO blocks (
        id, type, content,
        scripture_ref, scripture_display_ref, scripture_translation, scripture_verses,
        entity_type, entity_id, entity_name, entity_aliases, entity_description,
        source, captured_at, modified_at, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      b.id,
      b.type,
      b.content,
      b.scripture_ref ?? null,
      b.scripture_display_ref ?? null,
      b.scripture_translation ?? null,
      b.scripture_verses ? JSON.stringify(b.scripture_verses) : null,
      b.entity_type ?? null,
      b.entity_id ?? null,
      b.entity_name ?? null,
      b.entity_aliases ? JSON.stringify(b.entity_aliases) : null,
      b.entity_description ?? null,
      b.source ?? "manual",
      b.captured_at,
      b.modified_at,
      JSON.stringify(b.tags ?? []),
    );
    blockCount++;
  }
  counts.blocks = blockCount;

  // --- entities ---
  let entityCount = 0;
  for (const e of data.data.entities) {
    await db.run(
      `INSERT OR IGNORE INTO entities (
        id, type, name, aliases, description, key_passages,
        mentioned_in, connected_entities, familiarity, last_studied, next_suggested
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e.id,
      e.type,
      e.name,
      JSON.stringify(e.aliases ?? []),
      e.description ?? "",
      JSON.stringify(e.key_passages ?? []),
      JSON.stringify(e.mentioned_in ?? []),
      JSON.stringify(e.connected_entities ?? []),
      e.familiarity ?? 0,
      e.last_studied ?? null,
      e.next_suggested ?? null,
    );
    entityCount++;
  }
  counts.entities = entityCount;

  // --- links ---
  let linkCount = 0;
  for (const l of data.data.links) {
    await db.run(
      `INSERT OR IGNORE INTO links (
        id, from_block, to_block, link_text, context, created_at, is_entity_link, reflection_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      l.id,
      l.from_block,
      l.to_block,
      l.link_text,
      l.context,
      l.created_at,
      l.is_entity_link ? 1 : 0,
      l.reflection_id ?? null,
    );
    linkCount++;
  }
  counts.links = linkCount;

  // --- reflections ---
  let reflectionCount = 0;
  for (const r of data.data.reflections) {
    await db.run(
      `INSERT OR IGNORE INTO reflections (id, block_id, body, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      r.id,
      r.block_id,
      r.body,
      r.created_at,
      r.modified_at,
    );
    reflectionCount++;
  }
  counts.reflections = reflectionCount;

  // --- life_stages ---
  let stageCount = 0;
  for (const ls of data.data.life_stages) {
    await db.run(
      `INSERT OR IGNORE INTO life_stages (
        block_id, stage, kindled_at, last_reviewed, next_review_at,
        review_count, settledness, linger_seconds, notes_added, connections_made
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ls.block_id,
      ls.stage,
      ls.kindled_at,
      ls.last_reviewed ?? null,
      ls.next_review_at,
      ls.review_count,
      ls.settledness,
      ls.linger_seconds,
      ls.notes_added,
      ls.connections_made,
    );
    stageCount++;
  }
  counts.life_stages = stageCount;

  // Ensure schema version is at least what the file expects
  if (data.schema_version > 0) {
    await db.exec(
      `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '${Math.max(SCHEMA_VERSION, data.schema_version)}')`,
    );
  }

  return counts;
}
