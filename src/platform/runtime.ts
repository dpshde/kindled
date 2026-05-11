export function isNativeRuntime(): boolean {
  return typeof window !== "undefined" && window.zero !== undefined;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeRuntime()) {
    try {
      await window.zero!.invoke("shell.open", { url });
      return;
    } catch {
      // May fail on some runtimes; fall through to web
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
