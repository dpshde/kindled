/**
 * Native share helpers.
 *
 * Tauri (macOS/iOS): invokes Rust `share_url` / `share_text` commands that
 * present the OS-native share sheet (NSSharingServicePicker / UIActivityViewController).
 *
 * Browser: falls back to the Web Share API (`navigator.share`) when available,
 * otherwise copies to clipboard.
 */

import { isTauriRuntime } from "../sync/tauri-file-store";

export async function shareUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("share_url", { url });
    return;
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ url });
    return;
  }

  // Last resort: copy to clipboard
  await navigator.clipboard.writeText(url);
}

export async function shareText(text: string): Promise<void> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("share_text", { text });
    return;
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ text });
    return;
  }

  await navigator.clipboard.writeText(text);
}
