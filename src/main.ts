import "./index.css";
import { mountApp } from "./app/mount-app";
import { initHostedSync } from "./sync/hosted-sync";
import { initTheme } from "./ui/theme";

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
initTheme();
mountApp(root);

// Initialise hosted sync after mount so local content can render immediately
// and then reconcile with the user's hosted vault in the background.
void initHostedSync();

if (!("__TAURI_INTERNALS__" in window) && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
