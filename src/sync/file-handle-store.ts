/**
 * Persists a File System Access API handle in IndexedDB so the user
 * only has to pick the file once. The granted `readwrite` permission
 * is re-checked on each session start.
 */

const DB_NAME = "kindled_sync";
const STORE = "handles";
const KEY = "sync_file_handle";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Verify the browser supports File System Access API. */
export function isFileSystemAccessSupported(): boolean {
  return "showOpenFilePicker" in globalThis && "showSaveFilePicker" in globalThis;
}

/**
 * Check whether a previously-stored handle still has read/write permission.
 * Returns `"granted"`, `"prompt"`, or `"denied"`.
 */
export async function queryHandlePermission(
  handle: FileSystemFileHandle,
): Promise<PermissionState> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  return handle.queryPermission(opts);
}

/**
 * Request read/write permission from the user for a stored handle.
 * Returns `"granted"` or `"denied"`.
 */
export async function requestHandlePermission(
  handle: FileSystemFileHandle,
): Promise<PermissionState> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  return handle.requestPermission(opts);
}

/** Persist a file handle for future sessions. */
export async function storeHandle(
  handle: FileSystemFileHandle,
): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve the previously stored handle (or null). */
export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Remove the stored handle (detach). */
export async function clearHandle(): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Open a file picker so the user can choose their existing sync file. */
export async function pickExistingFile(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = await (globalThis as unknown as { showOpenFilePicker: typeof window.showOpenFilePicker }).showOpenFilePicker({
      types: [
        {
          description: "Kindled sync file",
          accept: { "application/json": [".json"] },
        },
      ],
      multiple: false,
    });
    return handle ?? null;
  } catch {
    // User cancelled the picker
    return null;
  }
}

/** Open a save picker so the user can create a new sync file. */
export async function createNewFile(): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await (globalThis as unknown as { showSaveFilePicker?: typeof window.showSaveFilePicker }).showSaveFilePicker!({
      suggestedName: "kindled-sync.json",
      types: [
        {
          description: "Kindled sync file",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    return handle ?? null;
  } catch {
    // User cancelled the picker
    return null;
  }
}

/** Read the JSON content from a handle. Returns parsed object or null. */
export async function readFile<T>(handle: FileSystemFileHandle): Promise<T | null> {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Write JSON content to a handle. */
export async function writeFile(
  handle: FileSystemFileHandle,
  data: unknown,
): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(data, null, 2));
  } finally {
    await writable.close();
  }
}
