type ChangeListener = () => void;

const listeners = new Set<ChangeListener>();
let suppressionDepth = 0;

export function onLocalDatabaseChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalDatabaseChange(): void {
  if (suppressionDepth > 0) return;
  for (const listener of listeners) listener();
}

export async function withLocalDatabaseChangeSuppressed<T>(
  fn: () => Promise<T>,
): Promise<T> {
  suppressionDepth += 1;
  try {
    return await fn();
  } finally {
    suppressionDepth = Math.max(0, suppressionDepth - 1);
  }
}
