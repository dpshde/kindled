import "./index.css";
import { mountApp } from "./app/mount-app";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
mountApp(root);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
