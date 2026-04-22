import "./index.css";
import { mountApp } from "./app/mount-app";
import { initFileSync, pullFromFileSync, getSyncState } from "./sync/file-sync";

const userAgent = navigator.userAgent;
if (/iPhone|iPad|iPod/.test(userAgent)) {
  document.documentElement.dataset.platform = "ios";
} else if (/Android/.test(userAgent)) {
  document.documentElement.dataset.platform = "android";
} else if ("__TAURI_INTERNALS__" in window) {
  // In Tauri, detect desktop platform
  if (userAgent.includes("Mac") || userAgent.includes("macOS")) {
    document.documentElement.dataset.platform = "macos";
  } else if (userAgent.includes("Windows")) {
    document.documentElement.dataset.platform = "windows";
  } else {
    document.documentElement.dataset.platform = "linux";
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
mountApp(root);

// Initialise file-backed sync (no-op if no file attached).
// Must run after mountApp so the DB is ready when a pull is triggered.
void (async () => {
  await initFileSync();

  // If we have an attached file with permission, pull data from it
  // to ensure the JSON file remains the source of truth on refresh.
  if (getSyncState().status === "attached") {
    await pullFromFileSync();
  }
})();

if (!("__TAURI_INTERNALS__" in window) && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
