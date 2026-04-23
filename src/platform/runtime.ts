export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Open an external URL in the system browser.
 *
 * Uses the Tauri shell plugin when available, falls back to `window.open`.
 * Works reliably on macOS Tauri, iOS Tauri, and plain web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch {
      // shell.open may fail on some mobile runtimes; fall through
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
