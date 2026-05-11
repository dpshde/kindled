import "./index.css";
import { mountApp } from "./app/mount-app";
import { getConnectedAddress, syncLocalDbWithMemoLog } from "./solana";
import { initHostedSync } from "./sync/hosted-sync";
import { initTheme } from "./ui/theme";

const userAgent = navigator.userAgent;
if (/iPhone|iPad|iPod/.test(userAgent)) {
  document.documentElement.dataset.platform = "ios";
} else if (/Android/.test(userAgent)) {
  document.documentElement.dataset.platform = "android";
} else if (window.zero !== undefined) {
  // In native shell, detect desktop platform
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

// Optional: pull scripture attestations from Solana memo history.
// Runs silently after wallet connection is detected.
setTimeout(() => {
  const address = getConnectedAddress();
  if (address) {
    syncLocalDbWithMemoLog()
      .then(({ added, newestSignature }) => {
        if (added > 0) {
          console.log(
            `[SolanaSync] Added ${added} passages from memo history (cursor: ${newestSignature})`,
          );
        }
      })
      .catch((err) => {
        console.error("[SolanaSync] Background sync failed:", err);
      });
  }
}, 8000);

if (window.zero === undefined && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
