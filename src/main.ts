import "./index.css";
import { mountApp } from "./app/mount-app";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
mountApp(root);
