/**
 * Tauri-native file store: uses OS open/save dialogs so the user can choose
 * the sync JSON file location (for example iCloud Drive / Files / shared storage).
 *
 * We persist the selected path in localStorage, but the Tauri dialog-granted
 * filesystem scope may need to be re-confirmed on a later launch. In that case
 * `queryHandlePermission()` reports `"prompt"` so the UI can ask the user to
 * browse to the file again.
 */

import {
  BaseDirectory,
  exists,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { open, save } from "@tauri-apps/plugin-dialog";

const DEFAULT_SYNC_FILE = "kindled-sync.json";
const META_KEY = "kindled_sync_ref";
const LEGACY_META_KEY = "kindled_sync_filename";

type TauriScope = "absolute" | "appData";

/** Check whether we're inside a Tauri runtime. */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

/** A lightweight stand-in for FileSystemFileHandle. */
export interface TauriFileRef {
  name: string;
  kind: "file";
  path: string;
  scope: TauriScope;
}

interface StoredTauriFileRef {
  path: string;
  name?: string;
  scope?: TauriScope;
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const tail = normalized.split("?")[0]?.split("#")[0] ?? normalized;
  const last = tail.slice(tail.lastIndexOf("/") + 1);
  return decodeURIComponent(last || DEFAULT_SYNC_FILE);
}

function makeRef(path: string, scope: TauriScope = "absolute"): TauriFileRef {
  return {
    name: fileNameFromPath(path),
    kind: "file",
    path,
    scope,
  };
}

function fileOptions(ref: TauriFileRef): { baseDir: BaseDirectory } | undefined {
  return ref.scope === "appData"
    ? { baseDir: BaseDirectory.AppData }
    : undefined;
}

function readStoredRef(): StoredTauriFileRef | null {
  const raw = localStorage.getItem(META_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredTauriFileRef;
      if (typeof parsed?.path === "string" && parsed.path) return parsed;
    } catch {
      // Fall through to legacy support below.
    }
  }

  const legacy = localStorage.getItem(LEGACY_META_KEY);
  if (!legacy) return null;
  return {
    path: legacy,
    name: legacy,
    scope: legacy === DEFAULT_SYNC_FILE ? "appData" : "absolute",
  };
}

function preferredDialogPath(): string {
  return readStoredRef()?.path ?? DEFAULT_SYNC_FILE;
}

async function canAccess(ref: TauriFileRef): Promise<boolean> {
  try {
    return await exists(ref.path, fileOptions(ref));
  } catch {
    return false;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return true;
}

export async function queryHandlePermission(
  ref: TauriFileRef,
): Promise<PermissionState> {
  return (await canAccess(ref)) ? "granted" : "prompt";
}

export async function requestHandlePermission(
  ref: TauriFileRef,
): Promise<PermissionState> {
  if (await canAccess(ref)) return "granted";

  const selected = await open({
    title: "Choose Kindled sync file",
    defaultPath: ref.path || preferredDialogPath(),
    filters: [{ name: "Kindled sync file", extensions: ["json"] }],
    multiple: false,
    directory: false,
    pickerMode: "document",
    fileAccessMode: "scoped",
  });

  if (!selected || Array.isArray(selected)) return "denied";

  const next = makeRef(selected);
  ref.path = next.path;
  ref.name = next.name;
  ref.scope = next.scope;
  await storeHandle(ref);
  return "granted";
}

export async function storeHandle(ref: TauriFileRef): Promise<void> {
  const stored: StoredTauriFileRef = {
    path: ref.path,
    name: ref.name,
    scope: ref.scope,
  };
  localStorage.setItem(META_KEY, JSON.stringify(stored));
  localStorage.removeItem(LEGACY_META_KEY);
}

export async function loadHandle(): Promise<TauriFileRef | null> {
  const stored = readStoredRef();
  if (!stored?.path) return null;
  return {
    name: stored.name || fileNameFromPath(stored.path),
    kind: "file",
    path: stored.path,
    scope: stored.scope ?? "absolute",
  };
}

export async function clearHandle(): Promise<void> {
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(LEGACY_META_KEY);
}

export async function pickExistingFile(): Promise<TauriFileRef | null> {
  const selected = await open({
    title: "Choose Kindled sync file",
    defaultPath: preferredDialogPath(),
    filters: [{ name: "Kindled sync file", extensions: ["json"] }],
    multiple: false,
    directory: false,
    pickerMode: "document",
    fileAccessMode: "scoped",
  });

  if (!selected || Array.isArray(selected)) return null;
  return makeRef(selected);
}

export async function createNewFile(): Promise<TauriFileRef | null> {
  const selected = await save({
    title: "Create Kindled sync file",
    defaultPath: preferredDialogPath(),
    filters: [{ name: "Kindled sync file", extensions: ["json"] }],
  });

  if (!selected) return null;

  await writeTextFile(selected, "");
  return makeRef(selected);
}

export async function readFile<T>(ref: TauriFileRef): Promise<T | null> {
  try {
    const fileExists = await exists(ref.path, fileOptions(ref));
    if (!fileExists) return null;

    const text = await readTextFile(ref.path, fileOptions(ref));
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeFile(
  ref: TauriFileRef,
  data: unknown,
): Promise<void> {
  await writeTextFile(ref.path, JSON.stringify(data, null, 2), fileOptions(ref));
}
