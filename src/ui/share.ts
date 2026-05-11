/**
 * Native share helpers.
 *
 * Native (macOS/iOS): invokes zero-native `share.url` / `share.text` commands
 * that present the OS-native share sheet.
 *
 * Browser: falls back to the Web Share API (`navigator.share`) when available,
 * otherwise copies to clipboard.
 */

import { isNativeRuntime } from "../platform/runtime";

export async function shareUrl(url: string): Promise<void> {
  if (isNativeRuntime()) {
    await window.zero!.invoke("share.url", { url });
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
  if (isNativeRuntime()) {
    await window.zero!.invoke("share.text", { text });
    return;
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ text });
    return;
  }

  await navigator.clipboard.writeText(text);
}
